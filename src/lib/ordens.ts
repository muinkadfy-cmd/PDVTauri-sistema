import { OrdemServico, StatusOrdem } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidOrdemServico } from './validate';
import { ordensRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import {
  calcTotalBrutoOS,
  calcTaxaCartao,
  calcTotalLiquidoOS,
  normalizarOS
} from './finance/calc';
import { criarLancamentosOS } from './finance/lancamentos';
import {
  getOrRequestRange,
  consumeNext,
  formatSequenceNumber,
  generatePendingNumber
} from './sequenceRange';

let lastOrdemError: string | null = null;

function setLastOrdemError(message: string | null) {
  lastOrdemError = message;
}

export function getLastOrdemError(): string | null {
  return lastOrdemError;
}

export function getOrdens(): OrdemServico[] {
  const items = ordensRepo.list();
  return filterValid(items, isValidOrdemServico);
}

export async function getOrdensAsync(): Promise<OrdemServico[]> {
  const items = await ordensRepo.listAsync();
  return filterValid(items, isValidOrdemServico);
}

export async function criarOrdem(ordem: Omit<OrdemServico, 'id' | 'numero' | 'dataAbertura' | 'status'> & { status?: StatusOrdem }): Promise<OrdemServico | null> {
  setLastOrdemError(null);
  // Validação básica
  if (!ordem.clienteId || !ordem.clienteNome || !ordem.clienteNome.trim()) {
    logger.error('Cliente é obrigatório');
    setLastOrdemError('Selecione um cliente valido antes de salvar a O.S.');
    return null;
  }

  if (!ordem.equipamento || !ordem.equipamento.trim()) {
    logger.error('Equipamento é obrigatório');
    setLastOrdemError('Informe o equipamento para continuar.');
    return null;
  }

  if (!ordem.defeito || !ordem.defeito.trim()) {
    logger.error('Defeito é obrigatório');
    setLastOrdemError('Informe pelo menos um defeito relatado para abrir a O.S.');
    return null;
  }

  // Valida valores monetários
  if (ordem.valorServico !== undefined && ordem.valorServico < 0) {
    logger.error('Valor do serviço não pode ser negativo');
    setLastOrdemError('O valor do servico nao pode ser negativo.');
    return null;
  }

  if (ordem.valorPecas !== undefined && ordem.valorPecas < 0) {
    logger.error('Valor das peças não pode ser negativo');
    setLastOrdemError('O valor das pecas nao pode ser negativo.');
    return null;
  }

  // Calcular campos financeiros
  const totalBruto = calcTotalBrutoOS(ordem.valorServico, ordem.valorPecas);
  const desconto = ordem.desconto || 0;
  const taxaCartaoPercentual = ordem.taxa_cartao_percentual;
  const isCardPagamento = ['cartao', 'debito', 'credito'].includes(String(ordem.formaPagamento || '').toLowerCase());
  const taxaCartaoValor = ordem.taxa_cartao_valor || (isCardPagamento && taxaCartaoPercentual
    ? calcTaxaCartao(totalBruto - desconto, taxaCartaoPercentual)
    : 0);
  const totalLiquido = calcTotalLiquidoOS(totalBruto, desconto, taxaCartaoValor);
  // Resolver store_id dinâmico (multi-tenant)
  const storeId = requireStoreId('Ordens');
  if (!storeId) {
    setLastOrdemError('A loja ativa nao foi identificada. Reabra o sistema ou troque novamente para a loja correta.');
    return null;
  }

  // Obter ou solicitar range de numeração
  const range = await getOrRequestRange('os', storeId, 100);
  const numeroSeq = range ? consumeNext('os', storeId) : null;
  
  // Determinar número e status
  let numero_os: string;
  let numero_os_num: number | undefined;
  let number_status: 'final' | 'pending';
  let number_assigned_at: string | undefined;
  
  if (numeroSeq !== null) {
    // Número final atribuído
    numero_os_num = numeroSeq;
    numero_os = formatSequenceNumber(numeroSeq);
    number_status = 'final';
    number_assigned_at = new Date().toISOString();
  } else {
    // Número pendente (offline ou range esgotado)
    numero_os = generatePendingNumber();
    numero_os_num = undefined;
    number_status = 'pending';
    number_assigned_at = undefined;
  }
  
  const novaOrdem: OrdemServico = {
    ...ordem,
    clienteNome: ordem.clienteNome.trim(),
    equipamento: ordem.equipamento.trim(),
    defeito: ordem.defeito?.trim() || '',
    marca: ordem.marca?.trim(),
    modelo: ordem.modelo?.trim(),
    cor: ordem.cor?.trim(),
    defeito_tipo: ordem.defeito_tipo?.trim(),
    defeito_descricao: ordem.defeito_descricao?.trim(),
    acessorios: ordem.acessorios || [],
    situacao: ordem.situacao?.trim(),
    observacoes: ordem.observacoes?.trim(),
    tecnico: ordem.tecnico?.trim(),
    senhaCliente: ordem.senhaCliente?.trim(),
    senhaPadrao: (ordem as any).senhaPadrao?.trim(),
    laudoTecnico: ordem.laudoTecnico?.trim(),
    warranty_terms_snapshot: (ordem.warranty_terms_snapshot ?? '').toString(),
    warranty_terms_enabled: Boolean(ordem.warranty_terms_enabled),
    id: generateId(),
    numero: `OS-${numero_os}`, // Mantém compatibilidade com formato antigo
    numero_os_num,
    numero_os,
    number_status,
    number_assigned_at,
    dataAbertura: new Date().toISOString(),
    status: ordem.status || 'aberta',
    valorTotal: totalBruto, // Mantém compatibilidade
    total_bruto: totalBruto,
    desconto: desconto,
    taxa_cartao_valor: taxaCartaoValor,
    taxa_cartao_percentual: taxaCartaoPercentual,
    total_liquido: totalLiquido,
    status_pagamento: ordem.status_pagamento || (ordem.formaPagamento ? 'pago' : 'pendente'), // Padrão: pago se informou pagamento
    data_pagamento: (ordem.status_pagamento || ordem.formaPagamento) ? (ordem.data_pagamento || new Date().toISOString()) : ordem.data_pagamento,
    storeId: storeId as any
  };
  
  if (import.meta.env.DEV) {
    logger.log('[Ordens] Criando ordem:', {
      id: novaOrdem.id,
      numero: novaOrdem.numero,
      clienteNome: novaOrdem.clienteNome,
      storeId: storeId
    });
  }

  // Valida antes de salvar
  if (!isValidOrdemServico(novaOrdem)) {
    logger.error('Ordem criada é inválida');
    setLastOrdemError('Os dados da O.S. ficaram invalidos. Revise cliente, equipamento e valores.');
    return null;
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await ordensRepo.upsert(novaOrdem);
  
  if (!saved) {
    logger.error('[Ordens] Erro ao salvar ordem');
    setLastOrdemError('Nao foi possivel salvar a O.S. localmente. Tente novamente.');
    return null;
  }
  
  if (import.meta.env.DEV) {
    logger.log('[Ordens] Ordem salva:', {
      id: saved.id,
      numero: saved.numero,
      totalLocal: ordensRepo.count()
    });
  }

  // Disparar eventos para atualizar outras abas e componentes
  if (saved.status_pagamento === 'pago') {
    try {
      await criarLancamentosOS(saved, { revision: (saved as any).finance_rev ?? 1 });
    } catch (error) {
      // Não falha a OS se houver erro ao criar movimentação financeira
      logger.error('[Ordens] Erro ao criar lançamentos financeiros (OS continuou):', error);
    }
  }

  // Disparar eventos para atualizar outras abas e componentes
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-ordem-criada', { detail: { ordemId: saved.id } }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-ordens-updated',
      newValue: Date.now().toString()
    }));
  } catch (e) {
    // Ignorar erros ao disparar eventos
  }

  return saved;
}

export async function atualizarOrdem(id: string, updates: Partial<Omit<OrdemServico, 'id' | 'numero' | 'dataAbertura'>>): Promise<OrdemServico | null> {
  setLastOrdemError(null);
  const ordens = getOrdens();
  const index = ordens.findIndex(o => o.id === id);

  if (index === -1) {
    logger.warn(`Ordem com id ${id} não encontrada`);
    setLastOrdemError('A O.S. nao foi encontrada para atualizacao. Recarregue a lista.');
    return null;
  }

  // Validações
  if (updates.clienteNome !== undefined && !updates.clienteNome.trim()) {
    logger.error('Nome do cliente não pode ser vazio');
    setLastOrdemError('O nome do cliente nao pode ficar vazio.');
    return null;
  }

  if (updates.equipamento !== undefined && !updates.equipamento.trim()) {
    logger.error('Equipamento não pode ser vazio');
    setLastOrdemError('O equipamento nao pode ficar vazio.');
    return null;
  }

  if (updates.defeito !== undefined && !updates.defeito.trim()) {
    logger.error('Defeito não pode ser vazio');
    setLastOrdemError('Informe o defeito antes de salvar a O.S.');
    return null;
  }

  if (updates.valorServico !== undefined && updates.valorServico < 0) {
    logger.error('Valor do serviço não pode ser negativo');
    setLastOrdemError('O valor do servico nao pode ser negativo.');
    return null;
  }

  if (updates.valorPecas !== undefined && updates.valorPecas < 0) {
    logger.error('Valor das peças não pode ser negativo');
    setLastOrdemError('O valor das pecas nao pode ser negativo.');
    return null;
  }

  // Recalcular campos financeiros se necessário
  const valorServico = updates.valorServico ?? ordens[index].valorServico ?? 0;
  const valorPecas = updates.valorPecas ?? ordens[index].valorPecas ?? 0;
  const totalBruto = calcTotalBrutoOS(valorServico, valorPecas);
  const desconto = updates.desconto ?? ordens[index].desconto ?? 0;
  const taxaCartaoPercentual = updates.taxa_cartao_percentual ?? ordens[index].taxa_cartao_percentual;
  const formaPagamento = updates.formaPagamento ?? ordens[index].formaPagamento;
  const isCardPagamento = ['cartao', 'debito', 'credito'].includes(String(formaPagamento || '').toLowerCase());
  const taxaCartaoValor = updates.taxa_cartao_valor ?? (ordens[index].taxa_cartao_valor ||
    (isCardPagamento && taxaCartaoPercentual
      ? calcTaxaCartao(totalBruto - desconto, taxaCartaoPercentual)
      : 0));
  const totalLiquido = calcTotalLiquidoOS(totalBruto, desconto, taxaCartaoValor);

  // Verificar mudança de status_pagamento
  const statusPagamentoAnterior = ordens[index].status_pagamento || 'pendente';
  const statusPagamentoNovo = updates.status_pagamento ?? statusPagamentoAnterior;


  // ✅ Correção auditável (Opção A): se já estava PAGO e continua PAGO, mas valores/forma de pagamento mudaram,
  // estornamos os lançamentos antigos e criamos novos (com revisão).
  const beforeValorServico = ordens[index].valorServico ?? 0;
  const beforeValorPecas = ordens[index].valorPecas ?? 0;
  const beforeTotalBruto = calcTotalBrutoOS(beforeValorServico, beforeValorPecas);
  const beforeDesconto = ordens[index].desconto ?? 0;
  const beforeFormaPagamento = ordens[index].formaPagamento;
  const beforeIsCard = ['cartao', 'debito', 'credito'].includes(String(beforeFormaPagamento || '').toLowerCase());
  const beforeTaxaPercentual = ordens[index].taxa_cartao_percentual;
  const beforeTaxaValor =
    typeof ordens[index].taxa_cartao_valor === 'number'
      ? ordens[index].taxa_cartao_valor
      : (beforeIsCard && beforeTaxaPercentual
          ? calcTaxaCartao(Math.max(0, beforeTotalBruto - beforeDesconto), beforeTaxaPercentual)
          : 0);

  const beforeTotalFinal = Math.max(0, beforeTotalBruto - beforeDesconto);
  const afterTotalFinal = Math.max(0, totalBruto - desconto);

  const afterFormaLower = String(formaPagamento || '').toLowerCase();
  const beforeFormaLower = String(beforeFormaPagamento || '').toLowerCase();

  const financeChanged =
    Math.abs(beforeTotalFinal - afterTotalFinal) > 0.009 ||
    Math.abs((beforeTaxaValor || 0) - (taxaCartaoValor || 0)) > 0.009 ||
    beforeFormaLower !== afterFormaLower;

  const correcaoFinanceiraPagamento =
    statusPagamentoAnterior === 'pago' &&
    statusPagamentoNovo === 'pago' &&
    financeChanged;

  const prevFinanceRev = Math.max(1, Number((ordens[index] as any).finance_rev ?? 1) || 1);
  const nextFinanceRev = correcaoFinanceiraPagamento ? (prevFinanceRev + 1) : prevFinanceRev;

  const atualizada: OrdemServico = { 
    ...ordens[index], 
    ...updates,
    clienteNome: updates.clienteNome?.trim() ?? ordens[index].clienteNome,
    equipamento: updates.equipamento?.trim() ?? ordens[index].equipamento,
    defeito: updates.defeito?.trim() ?? ordens[index].defeito,
    marca: updates.marca?.trim(),
    modelo: updates.modelo?.trim(),
    cor: updates.cor?.trim(),
    situacao: updates.situacao?.trim(),
    observacoes: updates.observacoes?.trim(),
    tecnico: updates.tecnico?.trim(),
    senhaCliente: updates.senhaCliente?.trim(),
    senhaPadrao: (updates as any).senhaPadrao?.trim(),
    laudoTecnico: updates.laudoTecnico?.trim(),
    warranty_terms_snapshot:
      updates.warranty_terms_snapshot !== undefined
        ? String(updates.warranty_terms_snapshot || '')
        : (ordens[index].warranty_terms_snapshot || ''),
    warranty_terms_enabled:
      updates.warranty_terms_enabled !== undefined
        ? Boolean(updates.warranty_terms_enabled)
        : Boolean(ordens[index].warranty_terms_enabled),
    valorTotal: totalBruto,
    total_bruto: totalBruto,
    desconto: desconto,
    taxa_cartao_valor: taxaCartaoValor,
    taxa_cartao_percentual: taxaCartaoPercentual,
    total_liquido: totalLiquido,
    status_pagamento: statusPagamentoNovo,
    finance_rev: nextFinanceRev
  };
  
  // Se status mudou para concluida, atualizar dataConclusao
  if (updates.status === 'concluida' && !atualizada.dataConclusao) {
    atualizada.dataConclusao = new Date().toISOString();
  }

  if (!isValidOrdemServico(atualizada)) {
    logger.error('Ordem atualizada é inválida');
    setLastOrdemError('Os dados atualizados da O.S. ficaram invalidos. Revise os campos e tente novamente.');
    return null;
  }
  
  // Usa Repository (salva local + adiciona à outbox)
  const saved = await ordensRepo.upsert(atualizada);
  
  if (!saved) {
    logger.error('[Ordens] Erro ao salvar ordem atualizada');
    setLastOrdemError('Nao foi possivel salvar a O.S. atualizada. Tente novamente.');
    return null;
  }

  // Criar lançamentos financeiros em dois casos:
  // 1. Se status_pagamento mudou para 'pago'
  // 2. Se status mudou para 'concluida' e status_pagamento já é 'pago' (mas lançamento não foi criado ainda)
  const deveConsiderarPago = statusPagamentoNovo === 'pago' && statusPagamentoAnterior !== 'pago';
  const foiConcluida = updates.status === 'concluida' && ordens[index].status !== 'concluida' && statusPagamentoNovo === 'pago';
  
  if (deveConsiderarPago || foiConcluida) {
    try {
      await criarLancamentosOS(saved, { revision: (saved as any).finance_rev ?? 1 });
      logger.log(`[Ordens] ✅ Lançamentos financeiros criados para OS ${saved.numero}`);
    } catch (error) {
      logger.error('[Ordens] Erro ao criar lançamentos financeiros (OS continuou):', error);
    }
  }

  // ✅ Opção A (auditável): se mudou forma/valores do pagamento mas continuou "PAGO",
  // fazemos ESTORNO dos lançamentos anteriores e criamos novos lançamentos (revisão).
  if (correcaoFinanceiraPagamento) {
    try {
      const { getCurrentSession } = await import('./auth-supabase');
      const { getUsuario } = await import('./usuario');
      const { criarEstornosEspelhoPorOrigem } = await import('./finance/estornos');

      const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';
      const numero = saved.numero || saved.id.slice(-6);

      const motivo = `OS ${numero} correção de pagamento (${beforeFormaLower || 'n/a'} → ${afterFormaLower || 'n/a'})`;
      await criarEstornosEspelhoPorOrigem('ordem_servico', saved.id, usuario, motivo);

      await criarLancamentosOS(saved, { revision: (saved as any).finance_rev ?? nextFinanceRev, motivo: 'Correção de pagamento' });
      logger.log(`[Ordens] 🔁 Correção de pagamento aplicada (estorno + revisão) para OS ${saved.numero}`);
    } catch (error) {
      logger.error('[Ordens] Erro ao aplicar correção auditável de pagamento (OS continuou):', error);
    }
  }


  // ✅ Se voltou de 'pago' para outro status, cria estorno espelho (evita divergência)
  const voltouDePago = statusPagamentoAnterior === 'pago' && statusPagamentoNovo !== 'pago';
  if (voltouDePago) {
    try {
      const { getCurrentSession } = await import('./auth-supabase');
      const { getUsuario } = await import('./usuario');
      const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

      const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';
      const numero = saved.numero || saved.id.slice(-6);

      const res = await criarEstornosEspelhoPorOrigem('ordem_servico', saved.id, usuario, `OS ${numero} voltou de PAGO`);

      if (res.sourceCount === 0) {
        await criarEstornoFallback(
          saved.id,
          usuario,
          'saida',
          (saved.total_liquido ?? saved.valorTotal ?? 0) || 0,
          'ESTORNO_OS',
          `🔄 Estorno - OS ${numero} (fallback)`
        );
      }
    } catch (error) {
      logger.error('[Ordens] Erro ao criar estorno ao voltar de PAGO (OS continuou):', error);
    }
  }

  // Disparar eventos para atualizar outras abas e componentes
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-ordem-atualizada', { detail: { ordemId: saved.id } }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-ordens-updated',
      newValue: Date.now().toString()
    }));
  } catch (e) {
    // Ignorar erros ao disparar eventos
  }

  return saved;
}

export async function deletarOrdem(id: string): Promise<boolean> {
  const ordem = ordensRepo.getById(id);
  
  if (!ordem) {
    logger.warn(`Ordem com id ${id} não encontrada para deletar`);
    return false;
  }

  // ⚠️ ESTORNO NO FLUXO DE CAIXA (espelho)
  // Ao deletar uma OS, criamos estornos para TODOS os lançamentos vinculados (serviço + taxa cartão, etc)
  try {
    const { getCurrentSession } = await import('./auth-supabase');
    const { getUsuario } = await import('./usuario');
    const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

    const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';
    const numero = ordem.numero || ordem.id.slice(-6);

    const res = await criarEstornosEspelhoPorOrigem('ordem_servico', ordem.id, usuario, `OS ${numero} deletada`);

    if (res.sourceCount === 0) {
      await criarEstornoFallback(
        ordem.id,
        usuario,
        'saida',
        (ordem.total_liquido ?? ordem.valorTotal ?? 0) || 0,
        'ESTORNO_OS',
        `🔄 Estorno - OS ${numero} (fallback)`
      );
    }

    logger.log(`[Ordens] Estornos criados para OS ${id} (fontes=${res.sourceCount}, criados=${res.created})`);
  } catch (error) {
    logger.error('[Ordens] Erro ao criar estorno espelho:', error);
    // Continua com a exclusão mesmo se o estorno falhar
  }

  // Usa Repository (remove local + adiciona à outbox)
  const deleted = await ordensRepo.remove(id);
  
  if (deleted) {
    logger.log(`[Ordens] Ordem deletada: ${id}`);
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-ordem-deletada', { detail: { ordemId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-ordens-updated',
        newValue: Date.now().toString()
      }));
    } catch {}
  }
  
  return deleted;
}

export function getOrdemPorId(id: string): OrdemServico | null {
  return getOrdens().find(o => o.id === id) || null;
}

export function getOrdensPorStatus(status: StatusOrdem): OrdemServico[] {
  return getOrdens().filter(o => o.status === status);
}

export function buscarOrdens(termo: string): OrdemServico[] {
  const termoLower = termo.toLowerCase();
  return getOrdens().filter(o =>
    o.numero.toLowerCase().includes(termoLower) ||
    o.numero_os?.toLowerCase().includes(termoLower) ||
    o.clienteNome.toLowerCase().includes(termoLower) ||
    o.equipamento.toLowerCase().includes(termoLower) ||
    o.defeito.toLowerCase().includes(termoLower) ||
    o.marca?.toLowerCase().includes(termoLower) ||
    o.modelo?.toLowerCase().includes(termoLower)
  );
}

/**
 * Ordena ordens por número decrescente (mais recente primeiro)
 * Pendentes aparecem no topo, depois por número decrescente
 */
export function ordenarOrdens(ordens: OrdemServico[]): OrdemServico[] {
  return [...ordens].sort((a, b) => {
    // Pendentes primeiro
    if (a.number_status === 'pending' && b.number_status !== 'pending') return -1;
    if (a.number_status !== 'pending' && b.number_status === 'pending') return 1;
    
    // Depois por número numérico decrescente
    const numA = a.numero_os_num ?? 0;
    const numB = b.numero_os_num ?? 0;
    if (numA !== numB) return numB - numA;
    
    // Se ambos pendentes ou sem número, por data decrescente
    const dateA = new Date(a.dataAbertura).getTime();
    const dateB = new Date(b.dataAbertura).getTime();
    return dateB - dateA;
  });
}
