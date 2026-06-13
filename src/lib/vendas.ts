import { Venda } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidVenda } from './validate';
import { vendasRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { atualizarProduto, getProdutoPorId } from './produtos';
import { 
  calcTotalBrutoVenda, 
  calcTaxaCartao,
  calcTotalFinal,
  calcCustoItem,
  normalizarVenda
} from './finance/calc';
import { criarLancamentosVenda } from './finance/lancamentos';
import {
  getOrRequestRange,
  consumeNext,
  formatSequenceNumber,
  generatePendingNumber
} from './sequenceRange';
import {
  canUseSalesRemoteSync,
  findRemoteVendaById,
  upsertRemoteVenda
} from '@/lib/capabilities/sales-remote-adapter';

let lastVendaError: string | null = null;

function setLastVendaError(message: string | null) {
  lastVendaError = message;
}

export function getLastVendaError(): string | null {
  return lastVendaError;
}

// Mantém compatibilidade com código existente
export function getVendas(): Venda[] {
  const items = vendasRepo.list();
  return filterValid(items, isValidVenda);
}

export async function getVendasAsync(): Promise<Venda[]> {
  const items = await vendasRepo.listAsync();
  return filterValid(items, isValidVenda);
}


export function toSupabaseVendaPayload(v: Venda) {
  const normalized = normalizarVenda(v);

  // Normalizar forma_pagamento para uppercase (DINHEIRO, PIX, DEBITO, CREDITO)
  let formaPagamento = ((normalized as any).formaPagamento || 'DINHEIRO').toUpperCase();
  
  // Mapeamento de valores legados para padronizados
  const formaPagamentoMap: Record<string, string> = {
    'DINHEIRO': 'DINHEIRO',
    'PIX': 'PIX',
    'DEBITO': 'DEBITO',
    'CREDITO': 'CREDITO',
    'BOLETO': 'BOLETO',
    'OUTRO': 'OUTRO'
  };
  
  formaPagamento = formaPagamentoMap[formaPagamento] || 'DINHEIRO';
  
  // Defaults seguros para campos de cartão
  const isCartao = formaPagamento === 'DEBITO' || formaPagamento === 'CREDITO';
  
  // Parcelas: 1 para DEBITO, ou valor da venda (default 1)
  const parcelas = formaPagamento === 'DEBITO' 
    ? 1 
    : (normalized.parcelas && normalized.parcelas > 0 ? normalized.parcelas : 1);
  
  // Taxa: 0 para DEBITO, calculada ou 0 para CREDITO
  const taxaCartaoValor = normalized.taxa_cartao_valor ?? 0;
  const taxaCartaoPercentual = normalized.taxa_cartao_percentual ?? 0;
  
  // Total final/líquido: sempre usar snapshot financeiro normalizado
  const totalFinal = normalized.total_final ?? normalized.total ?? 0;
  const totalLiquido = normalized.total_liquido ?? Math.max(0, totalFinal - taxaCartaoValor);
  
  return {
    id: normalized.id,
    store_id: (normalized as any).storeId || null,
    numero_venda_num: normalized.numero_venda_num ?? null,
    numero_venda: normalized.numero_venda ?? null,
    number_status: normalized.number_status ?? 'pending',
    number_assigned_at: normalized.number_assigned_at ?? null,
    cliente_id: normalized.clienteId ?? null,
    cliente_nome: normalized.clienteNome ?? null,
    cliente_telefone: normalized.clienteTelefone ?? null,
    // cliente_endereco, cliente_cidade e cliente_estado NÃO existem no schema do Supabase
    // Esses dados ficam apenas na tabela clientes (fazer JOIN se necessário)
    // Mantemos apenas localmente no localStorage
    itens: normalized.itens,
    total: normalized.total,
    total_bruto: normalized.total_bruto ?? normalized.total,
    desconto: normalized.desconto ?? 0,
    desconto_tipo: normalized.desconto_tipo ?? 'valor',
    total_final: totalFinal,
    taxa_cartao_valor: isCartao ? taxaCartaoValor : 0,
    taxa_cartao_percentual: isCartao ? taxaCartaoPercentual : 0,
    total_liquido: totalLiquido,
    custo_total: normalized.custo_total ?? 0,
    lucro_bruto: normalized.lucro_bruto ?? 0,
    lucro_liquido: normalized.lucro_liquido ?? 0,
    forma_pagamento: formaPagamento,
    parcelas: isCartao ? parcelas : null,
    status_pagamento: normalized.status_pagamento ?? 'pago',
    data_pagamento: normalized.data_pagamento ?? normalized.data,
    data_prevista_recebimento: normalized.data_prevista_recebimento ?? null,
    observacoes: (normalized as any).observacoes ?? null,
    vendedor: normalized.vendedor,
    created_at: normalized.data ?? new Date().toISOString(),
  };
}

async function trySyncVendaToSupabase(v: Venda): Promise<void> {
  const nextAttempts = (v.sync_attempts || 0) + 1;
  try {
    if (!await canUseSalesRemoteSync()) return;

    // ✅ PROTEÇÃO 1: Não sync se já sincronizado
    if (v.sync_status === 'synced') {
      logger.log(`[Vendas] Venda ${v.id} já sincronizada (sync_status='synced'), pulando`);
      return;
    }

    // ✅ PROTEÇÃO 2: Verificar se venda já existe no Supabase
    // IMPORTANTE: usar maybeSingle() para evitar 406 quando a venda ainda não existe.
    const { data: vendaExistente, error: checkError } = await findRemoteVendaById(v.id);

    // Se houver erro na checagem (RLS, schema, etc.), apenas loga e segue para tentar inserir.
    if (checkError) {
      logger.warn('[Vendas] Falha ao verificar venda existente no Supabase (seguindo para insert):', {
        message: checkError.message,
        code: (checkError as any).code,
        details: (checkError as any).details,
        hint: (checkError as any).hint,
        vendaId: v.id,
      });
    }
    
    if (vendaExistente) {
      logger.log(`[Vendas] Venda ${v.id} já existe no Supabase, marcando como synced`);
      
      // ✅ Marcar como sincronizada localmente
      const vendaAtualizada: Venda = {
        ...v,
        sync_status: 'synced',
        sync_at: new Date().toISOString()
      };
      await vendasRepo.upsert(vendaAtualizada);
      return;
    }

    // ✅ Marcar como 'pending' antes de tentar sync
    const vendaPending: Venda = {
      ...v,
      sync_status: 'pending',
      sync_attempts: nextAttempts
    };
    await vendasRepo.upsert(vendaPending);

    const payload = toSupabaseVendaPayload(v);

    // Preferir upsert para evitar falha por duplicidade (ex.: retry/duplo clique)
    const { error } = await upsertRemoteVenda(payload);
    if (error) {
      // ✅ Marcar como 'error' após falha
      const vendaError: Venda = {
        ...v,
        sync_status: 'error',
        sync_error: error.message || String(error),
        sync_attempts: nextAttempts
      };
      await vendasRepo.upsert(vendaError);
      
      // Log detalhado do erro do Supabase
      console.error('❌ [VENDAS] Erro ao enviar venda ao Supabase:', {
        '🔴 ERROR MESSAGE': error.message || String(error),
        '🔴 ERROR CODE': (error as any).code || 'N/A',
        '🔴 ERROR DETAILS': (error as any).details || 'N/A',
        '🔴 ERROR HINT': (error as any).hint || 'N/A',
        '📦 PAYLOAD ENVIADO': payload,
        '🆔 Venda ID': v.id,
        '🏪 Store ID': (v as any).storeId || (v as any).store_id || 'N/A',
        '💳 Forma Pagamento': payload.forma_pagamento,
        '💰 Total': payload.total,
        '💰 Total Líquido': payload.total_liquido,
        '🔢 Parcelas': payload.parcelas,
        '📊 Taxa Cartão': payload.taxa_cartao_valor,
        '🕒 Timestamp': new Date().toISOString()
      });
      
      logger.error('[Vendas] Erro ao enviar venda ao Supabase:', {
        error: error.message || String(error),
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        vendaId: v.id,
        storeId: (v as any).storeId || (v as any).store_id,
        formaPagamento: payload.forma_pagamento,
        timestamp: new Date().toISOString()
      });
      
      // ✅ NOVO: Se falhar, adicionar à outbox para retry via SyncEngine
      // Isso garante que vendas com erro de sync serão retentadas automaticamente
      logger.warn('[Vendas] ⚠️ Sync falhou, venda já está na outbox via Repository.upsert()');
      // Nota: A venda JÁ foi adicionada à outbox pelo Repository.upsert() na linha 380
      // O SyncEngine vai tentar sincronizar novamente
    } else {
      // ✅ Sucesso: Marcar como 'synced'
      const vendaSynced: Venda = {
        ...v,
        sync_status: 'synced',
        sync_at: new Date().toISOString(),
        sync_error: undefined
      };
      await vendasRepo.upsert(vendaSynced);
      
      // Sucesso - log para debug
      if (import.meta.env.DEV) {
        logger.log('[Vendas] ✅ Venda enviada ao Supabase com sucesso:', {
          vendaId: v.id,
          numero: v.numero_venda,
          total: v.total
        });
      }
    }
  } catch (e) {
    // ✅ Marcar como 'error' após exceção
    const vendaError: Venda = {
      ...v,
      sync_status: 'error',
      sync_error: e instanceof Error ? e.message : String(e),
      sync_attempts: nextAttempts
    };
    await vendasRepo.upsert(vendaError);
    
    logger.error('[Vendas] Exceção ao enviar venda ao Supabase:', {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      vendaId: v.id,
      timestamp: new Date().toISOString()
    });
  }
}


export async function criarVenda(venda: Omit<Venda, 'data' | 'id'> & { id?: string }): Promise<Venda | null> {
  setLastVendaError(null);
  // Validação básica
  if (!venda.itens || venda.itens.length === 0) {
    logger.error('Venda deve ter pelo menos um item');
    setLastVendaError('Adicione pelo menos um item antes de finalizar a venda.');
    return null;
  }

  // Validar total bruto (será calculado, mas valida se fornecido)
  const totalBrutoCalculado = calcTotalBrutoVenda(venda.itens);
  const totalBruto = venda.total > 0 ? venda.total : totalBrutoCalculado;
  
  if (venda.total > 0 && Math.abs(venda.total - totalBrutoCalculado) > 0.01) {
    // Se total fornecido não bate com cálculo, usa o calculado
    logger.warn('[Vendas] Total fornecido não corresponde ao cálculo, usando valor calculado');
  }

  if (!venda.vendedor || !venda.vendedor.trim()) {
    logger.error('Vendedor é obrigatório');
    setLastVendaError('Nao foi possivel identificar o vendedor. Feche e abra a tela novamente.');
    return null;
  }

  // Calcular campos financeiros (total_final, taxa de cartão, total_liquido)
  const desconto = venda.desconto ?? 0;
  const descontoTipo = venda.desconto_tipo ?? 'valor';

  // ✅ total_final = total bruto após desconto (antes da taxa)
  const totalFinal = Math.max(0, calcTotalFinal(totalBruto, desconto, descontoTipo));

  // ✅ Taxa de cartão vale para: cartao/debito/credito (se informado percentual)
  const isCard = ['cartao', 'debito', 'credito'].includes(venda.formaPagamento as any);
  const taxaCartaoPercentual = venda.taxa_cartao_percentual ?? 0;
  const taxaCartaoValor =
    typeof venda.taxa_cartao_valor === 'number'
      ? venda.taxa_cartao_valor
      : (isCard && taxaCartaoPercentual
          ? calcTaxaCartao(totalFinal, taxaCartaoPercentual)
          : 0);

  // ✅ total_liquido = total_final - taxa
  const totalLiquido = Math.max(0, totalFinal - taxaCartaoValor);
  // Resolver store_id dinâmico (multi-tenant)
  const storeId = requireStoreId('Vendas');
  if (!storeId) {
    setLastVendaError('A loja ativa nao foi identificada. Reabra o sistema ou troque novamente para a loja correta.');
    return null;
  }

  // ✅ CORREÇÃO CRÍTICA: ID gerado APENAS se não fornecido
  // Isso permite retry sem gerar novo ID
  const vendaId = venda.id || generateId();
  
  // ✅ VERIFICAR SE VENDA JÁ EXISTE (retry protection)
  const vendaExistente = getVendaPorId(vendaId);
  if (vendaExistente) {
    // ✅ Venda já existe: ATUALIZAR em vez de CRIAR
    logger.warn(`[Vendas] Venda ${vendaId} já existe, atualizando em vez de criar nova`);
    
    // Se já foi sincronizada (sync_status === 'synced'), não permitir alteração
    if (vendaExistente.sync_status === 'synced') {
      logger.log(`[Vendas] Venda ${vendaId} já sincronizada, retornando venda existente`);
      return vendaExistente;
    }
    
    // Atualizar venda existente (permitido apenas se não foi sincronizada)
    const vendaAtualizada: Venda = {
      ...vendaExistente,
      ...venda,
      id: vendaId, // Manter mesmo ID
      sync_status: 'pending', // Resetar para pending (precisa sync)
      sync_attempts: (vendaExistente.sync_attempts || 0) + 1
    };
    
    const updated = await vendasRepo.upsert(vendaAtualizada);
    if (!updated) {
      logger.error('[Vendas] Erro ao atualizar venda existente');
      setLastVendaError('Nao foi possivel atualizar a venda pendente. Tente novamente em alguns segundos.');
      return null;
    }
    
    return updated;
  }
  
  // Obter ou solicitar range de numeração
  const range = await getOrRequestRange('venda', storeId, 100);
  const numeroSeq = range ? consumeNext('venda', storeId) : null;
  
  // Determinar número e status
  let numero_venda: string;
  let numero_venda_num: number | undefined;
  let number_status: 'final' | 'pending';
  let number_assigned_at: string | undefined;
  
  if (numeroSeq !== null) {
    // Número final atribuído
    numero_venda_num = numeroSeq;
    numero_venda = formatSequenceNumber(numeroSeq);
    number_status = 'final';
    number_assigned_at = new Date().toISOString();
  } else {
    // Número pendente (offline ou range esgotado)
    numero_venda = generatePendingNumber();
    numero_venda_num = undefined;
    number_status = 'pending';
    number_assigned_at = undefined;
  }
  
  const novaVenda: Venda = {
    ...venda,
    id: vendaId, // ✅ Usar ID fornecido ou gerado
    data: new Date().toISOString(),
    vendedor: venda.vendedor.trim(),
    clienteNome: venda.clienteNome?.trim(),
    observacoes: venda.observacoes?.trim(),
    total: totalBruto, // Usar total bruto calculado
    total_bruto: totalBruto,
    desconto: desconto,
    desconto_tipo: descontoTipo,
    total_final: totalFinal,
    taxa_cartao_percentual: taxaCartaoPercentual,
    taxa_cartao_valor: taxaCartaoValor,
    total_liquido: totalLiquido,
    numero_venda_num,
    numero_venda,
    number_status,
    number_assigned_at,
    status_pagamento: venda.status_pagamento || 'pago', // Padrão: pago (vendas são sempre pagas na criação)
    data_pagamento: venda.data_pagamento || new Date().toISOString(), // Data de pagamento = data da venda
    storeId: storeId as any,
    sync_status: 'draft', // ✅ Novo campo: draft (ainda não sincronizado)
    sync_attempts: 0, // ✅ Novo campo: contador de tentativas
    sync_at: undefined // ✅ Novo campo: data do último sync
  };
  
  if (import.meta.env.DEV) {
    logger.log('[Vendas] Criando venda:', {
      id: novaVenda.id,
      clienteNome: novaVenda.clienteNome,
      total: novaVenda.total,
      storeId: storeId
    });
  }

  if (!isValidVenda(novaVenda)) {
    logger.error('Venda criada é inválida');
    setLastVendaError('Os dados da venda ficaram invalidos. Revise os itens, desconto e forma de pagamento.');
    return null;
  }

  // 1. Validar e atualizar estoque de produtos (produção)
// ✅ RECOMENDADO: se falhar qualquer coisa no estoque, BLOQUEIA a venda (evita caixa/estoque inconsistentes)
// Reservas temporárias evitam duas vendas “ao mesmo tempo” no mesmo dispositivo.
const RESERVAS_KEY = `reservas-estoque-temp:${storeId}`;
const deltas = new Map<string, number>(); // produtoId -> quantidade total
const originalStock: Record<string, number> = {};

const rollbackVendaCreation = async (savedVendaId?: string) => {
  const rollbackErrors: string[] = [];

  for (const [prodId, estoque] of Object.entries(originalStock)) {
    try {
      const ok = await atualizarProduto(prodId, { estoque });
      if (!ok) rollbackErrors.push(prodId);
    } catch {
      rollbackErrors.push(prodId);
    }
  }

  if (savedVendaId) {
    try {
      const removed = await vendasRepo.remove(savedVendaId);
      if (!removed) logger.error('[Vendas] Falha ao remover venda durante rollback financeiro:', { vendaId: savedVendaId });
    } catch (removeError) {
      logger.error('[Vendas] Erro ao remover venda durante rollback financeiro:', removeError);
    }
  }

  try {
    const reservasStr = localStorage.getItem(RESERVAS_KEY) || '{}';
    const reservas: Record<string, { quantidade: number; timestamp: number }> = JSON.parse(reservasStr);
    for (const [prodId, qty] of deltas.entries()) {
      if (!reservas[prodId]) continue;
      reservas[prodId].quantidade -= qty;
      if (reservas[prodId].quantidade <= 0) delete reservas[prodId];
    }
    localStorage.setItem(RESERVAS_KEY, JSON.stringify(reservas));
  } catch (cleanupError) {
    logger.warn('[Vendas] Falha ao limpar reservas temporárias no rollback:', cleanupError);
  }

  if (rollbackErrors.length > 0) {
    logger.error('[Vendas] ROLLBACK PARCIAL — produtos não revertidos:', rollbackErrors);
  }
};

try {
  // ✅ Pré-validação: todos os produtos (não-manuais) existem e agregação de quantidades
  const produtosInvalidos: Array<{ produtoId: string; index: number }> = [];
  novaVenda.itens.forEach((item, index) => {
    if (item.isManual) return;
    const pid = item.produtoId;
    if (!pid) {
      produtosInvalidos.push({ produtoId: '(sem id)', index });
      return;
    }
    const produto = getProdutoPorId(pid);
    if (!produto) {
      produtosInvalidos.push({ produtoId: pid, index });
      return;
    }
    deltas.set(produto.id, (deltas.get(produto.id) || 0) + item.quantidade);
  });

  if (produtosInvalidos.length > 0) {
    const ids = produtosInvalidos.map(p => p.produtoId).join(', ');
    const indices = produtosInvalidos.map(p => `Item ${p.index + 1}`).join(', ');

    logger.error('[Vendas] Produtos inválidos na venda (pré-validação)', {
      produtosInvalidos: ids,
      posicoes: indices,
      totalItens: novaVenda.itens.length,
      timestamp: new Date().toISOString()
    });
    setLastVendaError('Um ou mais produtos desta venda nao existem mais ou ficaram invalidos. Remova e adicione os itens novamente.');
    return null;
  }

  // Reservas atuais (previne vendas concorrentes no mesmo navegador)
  const reservasStr = localStorage.getItem(RESERVAS_KEY) || '{}';
  const reservas: Record<string, { quantidade: number; timestamp: number }> = JSON.parse(reservasStr);

  // Limpar reservas antigas (> 5 minutos)
  const now = Date.now();
  Object.keys(reservas).forEach(prodId => {
    if (now - reservas[prodId].timestamp > 5 * 60 * 1000) {
      delete reservas[prodId];
    }
  });

  // Validar estoque considerando reservas e criar novas reservas
  for (const [prodId, qty] of deltas.entries()) {
    const produto = getProdutoPorId(prodId);
    if (!produto) {
      logger.error('[Vendas] Produto não encontrado ao validar estoque (inconsistência)', { prodId });
      setLastVendaError('Um produto desta venda nao foi encontrado. Atualize a lista de produtos e tente novamente.');
      return null;
    }

    const reservasPendentes = reservas[prodId]?.quantidade || 0;
    const estoqueDisponivel = produto.estoque - reservasPendentes;

    if (estoqueDisponivel < qty) {
      logger.error('[Vendas] Estoque insuficiente ao criar venda', {
        produtoId: produto.id,
        produtoNome: produto.nome,
        estoqueReal: produto.estoque,
        reservasPendentes,
        estoqueDisponivel,
        quantidadeSolicitada: qty,
        deficit: qty - estoqueDisponivel,
        timestamp: new Date().toISOString()
      });
      setLastVendaError(`Estoque insuficiente para "${produto.nome}". Disponivel: ${estoqueDisponivel}. Ajuste a quantidade ou reponha o estoque.`);
      return null;
    }

    reservas[prodId] = {
      quantidade: reservasPendentes + qty,
      timestamp: now
    };
  }

  localStorage.setItem(RESERVAS_KEY, JSON.stringify(reservas));

  // ✅ P0-03 FIX: Fase 1 — aplicar estoque. Fase 2 — salvar venda.
  // Se Fase 2 falhar, Fase 1 é revertida (rollback completo).
  // Garante que estoque e venda nunca ficam em estados inconsistentes.

  // Fase 1: Aplicar atualização de estoque com snapshot para rollback
  for (const [prodId, qty] of deltas.entries()) {
    const produto = getProdutoPorId(prodId);
    if (!produto) throw new Error(`produto_missing:${prodId}`);

    // Snapshot do estoque original (rollback garantido)
    if (originalStock[prodId] === undefined) {
      originalStock[prodId] = produto.estoque;
    }

    const novoEstoque = produto.estoque - qty;
    const updated = await atualizarProduto(prodId, { estoque: novoEstoque });

    if (!updated) {
      throw new Error(`estoque_update_failed:${prodId}`);
    }

    if (import.meta.env.DEV) {
      logger.log(`[Vendas] Estoque atualizado: ${produto.nome} - ${produto.estoque} → ${novoEstoque}`);
    }

    // Limpar reserva após atualização
    if (reservas[prodId]) {
      reservas[prodId].quantidade -= qty;
      if (reservas[prodId].quantidade <= 0) delete reservas[prodId];
    }
  }

  localStorage.setItem(RESERVAS_KEY, JSON.stringify(reservas));

  // Fase 1 concluída: estoque decrementado. Agora tentar salvar a venda.
  // Se salvar falhar, rollback garante consistência.

} catch (error) {
  logger.error('[Vendas] Erro ao atualizar estoque (venda bloqueada):', error);
  setLastVendaError('Nao foi possivel atualizar o estoque desta venda. Nenhum item foi confirmado no caixa.');

  await rollbackVendaCreation();
  return null;
}

// 2. Salvar venda (usa Repository - salva local + adiciona à outbox)
  const saved = await vendasRepo.upsert(novaVenda);
  
  if (!saved) {
    logger.error('[Vendas] Erro ao salvar venda no repositório', {
      vendaId: novaVenda.id,
      totalItens: novaVenda.itens.length,
      total: novaVenda.total,
      clienteId: novaVenda.clienteId,
      formaPagamento: novaVenda.formaPagamento,
      timestamp: new Date().toISOString()
    });
    setLastVendaError('A venda nao foi salva localmente. Verifique a loja ativa e tente novamente.');
    await rollbackVendaCreation();
    return null;
  }
  
  if (import.meta.env.DEV) {
    logger.log('[Vendas] Venda salva:', {
      id: saved.id,
      totalLocal: vendasRepo.count()
    });
  }

  // 3. Criar lançamentos financeiros automáticos
  const financeOk = await criarLancamentosVenda(saved);
  if (!financeOk) {
    logger.error('[Vendas] Falha ao criar lançamentos financeiros. Revertendo venda e estoque.', {
      vendaId: saved.id,
      total: saved.total,
      formaPagamento: saved.formaPagamento,
      timestamp: new Date().toISOString()
    });
    setLastVendaError('A venda foi cancelada para evitar inconsistencia financeira. Tente novamente e confira o fluxo de caixa.');
    await rollbackVendaCreation(saved.id);
    return null;
  }

  // 4. Tentar enviar venda ao Supabase (sem outbox)
  await trySyncVendaToSupabase(saved);

  // 5. Disparar evento customizado para atualizar outras abas e componentes
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-venda-criada', { detail: { vendaId: saved.id } }));
    // Também disparar evento storage para compatibilidade com outras abas
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-vendas-updated',
      newValue: Date.now().toString()
    }));
  } catch (e) {
    // Ignorar erros ao disparar eventos
  }

  return saved;
}

export function getVendaPorId(id: string): Venda | null {
  return getVendas().find(v => v.id === id) || null;
}

export async function deletarVenda(id: string): Promise<boolean> {
  const venda = vendasRepo.getById(id);
  
  if (!venda) {
    logger.warn(`Venda com id ${id} não encontrada para deletar`);
    return false;
  }

  // ⚠️ ESTORNO NO FLUXO DE CAIXA (espelho)
  // Ao deletar uma venda, criamos estornos para TODOS os lançamentos vinculados (venda + taxa cartão, etc)
  try {
    const { getCurrentSession } = await import('./auth-supabase');
    const { getUsuario } = await import('./usuario');
    const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

    const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';
    const numero = venda.numero_venda || venda.id.slice(-6);

    const res = await criarEstornosEspelhoPorOrigem('venda', venda.id, usuario, `Venda #${numero} deletada`);

    // Se por algum motivo não existiam lançamentos (base antiga / falha), cria fallback
    if (res.sourceCount === 0) {
      await criarEstornoFallback(
        venda.id,
        usuario,
        'saida',
        (venda.total_final ?? venda.total_liquido ?? venda.total) || 0,
        'ESTORNO_VENDA',
        `🔄 Estorno - Venda #${numero} (fallback)`
      );
    }

    logger.log(`[Vendas] Estornos criados para venda ${id} (fontes=${res.sourceCount}, criados=${res.created})`);
  } catch (error) {
    logger.error('[Vendas] Erro ao criar estorno espelho:', error);
    // Continua com a exclusão mesmo se o estorno falhar
  }

  // Usa Repository (remove local + adiciona à outbox)
  const deleted = await vendasRepo.remove(id);
  
  if (deleted) {
    logger.log(`[Vendas] Venda deletada: ${id}`);
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-venda-deletada', { detail: { vendaId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-vendas-updated',
        newValue: Date.now().toString()
      }));
    } catch {}
  }
  
  return deleted;
}

export function getVendasPorPeriodo(dataInicio: string, dataFim: string): Venda[] {
  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      logger.warn('Datas inválidas fornecidas para filtrar vendas');
      return [];
    }

    return getVendas().filter(v => {
      try {
        const dataVenda = new Date(v.data);
        return !isNaN(dataVenda.getTime()) && dataVenda >= inicio && dataVenda <= fim;
      } catch {
        return false;
      }
    });
  } catch (error) {
    logger.error('Erro ao filtrar vendas por período:', error);
    return [];
  }
}

export function getTotalVendas(): number {
  return getVendas().reduce((sum, v) => sum + (v.total || 0), 0);
}

export function buscarVendas(termo: string): Venda[] {
  const termoLower = termo.toLowerCase();
  return getVendas().filter(v =>
    v.numero_venda?.toLowerCase().includes(termoLower) ||
    v.clienteNome?.toLowerCase().includes(termoLower) ||
    v.vendedor.toLowerCase().includes(termoLower) ||
    v.itens.some(item => item.produtoNome.toLowerCase().includes(termoLower)) ||
    termoLower && v.total.toString().includes(termoLower)
  );
}

/**
 * Ordena vendas por número decrescente (mais recente primeiro)
 * Pendentes aparecem no topo, depois por número decrescente
 */
export function ordenarVendas(vendas: Venda[]): Venda[] {
  return [...vendas].sort((a, b) => {
    // Pendentes primeiro
    if (a.number_status === 'pending' && b.number_status !== 'pending') return -1;
    if (a.number_status !== 'pending' && b.number_status === 'pending') return 1;
    
    // Depois por número numérico decrescente
    const numA = a.numero_venda_num ?? 0;
    const numB = b.numero_venda_num ?? 0;
    if (numA !== numB) return numB - numA;
    
    // Se ambos pendentes ou sem número, por data decrescente
    const dateA = new Date(a.data).getTime();
    const dateB = new Date(b.data).getTime();
    return dateB - dateA;
  });
}


/**
 * Sincroniza vendas pendentes (draft/pending/error) para o Supabase.
 * Útil porque a tabela 'vendas' é ignorada pela outbox padrão.
 */
export async function syncVendasPendentes(): Promise<{ attempted: number; synced: number; errors: number }> {
  const vendas = getVendas();
  const pendentes = vendas.filter(v => (v as any).sync_status !== 'synced');

  let attempted = 0;
  let synced = 0;
  let errors = 0;

  for (const v of pendentes) {
    attempted++;
    try {
      await trySyncVendaToSupabase(v);
      // Recarregar do repo para ver status atualizado
      const atualizada = vendasRepo.getById(v.id) as any;
      if (atualizada?.sync_status === 'synced') synced++;
      else if (atualizada?.sync_status === 'error') errors++;
    } catch {
      errors++;
    }
  }

  if (attempted > 0 && import.meta.env.DEV) {
    logger.log('[Vendas] syncVendasPendentes concluído:', { attempted, synced, errors });
  }

  return { attempted, synced, errors };
}
