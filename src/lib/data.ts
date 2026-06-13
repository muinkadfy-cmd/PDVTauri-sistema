import { Movimentacao, TipoMovimentacao, ResumoFinanceiro } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidMovimentacao } from './validate';
import { financeiroRepo } from './repositories';
import { logger } from '@/utils/logger';
import { getRuntimeStoreId, shouldBypassStoreScopeFiltering } from '@/lib/runtime-context';

// Função para obter movimentações da loja atual (multiloja: filtrar por store_id)
export function getMovimentacoes(): Movimentacao[] {
  const items = financeiroRepo.list();

  // ✅ Loja única (Desktop/LocalOnly): não filtra por storeId
  // Isso evita “zerar” após update MSI/restore quando algum dado antigo ficou com outro storeId.
  if (shouldBypassStoreScopeFiltering()) {
    return filterValid(items, isValidMovimentacao);
  }

  const storeId = getRuntimeStoreId() || undefined;
  // Segurança multi-tenant: nunca misturar registros sem storeId entre lojas.
  // Se existirem itens legados sem storeId, eles ficam invisíveis aqui (corrija via migração).
  if (import.meta.env.DEV) {
    const legacy = items.filter(m => !m.storeId).length;
    if (legacy > 0) logger.warn(`[Financeiro] ⚠️ ${legacy} movimentações locais sem storeId (legado). Não serão exibidas por segurança.`);
  }

  const hasStoreId = items.some(m => Boolean(m.storeId));
  const filtered = storeId && hasStoreId
    ? items.filter(m => m.storeId === storeId)
    : items;
  return filterValid(filtered, isValidMovimentacao);
}

/**
 * ✅ Desktop/SQLite: carrega movimentações aguardando o preload do SQLite.
 * (A versão sync pode retornar [] no 1º render, porque o preload é assíncrono.)
 */
export async function getMovimentacoesAsync(): Promise<Movimentacao[]> {
  const items = await financeiroRepo.listAsync();

  // ✅ Loja única (Desktop/LocalOnly): não filtra por storeId
  if (shouldBypassStoreScopeFiltering()) {
    return filterValid(items, isValidMovimentacao);
  }

  const storeId = getRuntimeStoreId() || undefined;

  // ✅ Compatibilidade: se os itens tiverem storeId, filtrar pelo tenant atual
  const hasStoreId = items.some(m => Boolean(m.storeId));
  const filtered = storeId && hasStoreId
    ? items.filter(m => m.storeId === storeId)
    : items;

  return filterValid(filtered, isValidMovimentacao);
}


// Criar nova movimentação
export async function createMovimentacao(
  tipo: TipoMovimentacao,
  valor: number,
  responsavel: string,
  descricao?: string,
  metadados?: {
    origem_tipo?: 'venda' | 'ordem_servico' | 'manual' | 'compra_usado' | 'venda_usado' | 'produto' | 'encomenda' | 'cobranca' | 'devolucao' | 'estorno'; // ✅ NOVO: estorno
    origem_id?: string;
    categoria?: string;
    forma_pagamento?: string;
  }
): Promise<Movimentacao | null> {
  // Validação básica
  if (valor < 0 || !responsavel.trim()) {
    logger.error('Dados inválidos para criar movimentação');
    return null;
  }

  const storeId = getRuntimeStoreId()?.trim();
  if (!storeId) {
    logger.error('[Financeiro] store_id não definido. Configure a loja (URL ?store= ou contexto).');
    return null;
  }

  // Sempre enviar store_id para sync e view vw_relatorios_financeiros (evita relatórios zerados)
  const novaMovimentacao: Movimentacao = {
    id: generateId(),
    tipo,
    valor,
    responsavel: responsavel.trim(),
    descricao: descricao?.trim(),
    data: new Date().toISOString(),
    ...(metadados?.origem_tipo && { origem_tipo: metadados.origem_tipo }),
    ...(metadados?.origem_id && { origem_id: metadados.origem_id }),
    ...(metadados?.categoria && { categoria: metadados.categoria }),
    ...(metadados?.forma_pagamento && { forma_pagamento: metadados.forma_pagamento as any }),
    storeId
  };

  if (import.meta.env.DEV) {
    logger.log('[Financeiro] Criando movimentação:', {
      id: novaMovimentacao.id,
      tipo: novaMovimentacao.tipo,
      valor: novaMovimentacao.valor,
      storeId
    });
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await financeiroRepo.upsert(novaMovimentacao);
  
  if (import.meta.env.DEV && saved) {
    logger.log('[Financeiro] Movimentação salva:', {
      id: saved.id,
      totalLocal: financeiroRepo.count()
    });
  }

  // Disparar evento customizado para atualizar outras abas e componentes
  if (saved) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-movimentacao-criada', { detail: { movimentacaoId: saved.id } }));
      // Também disparar evento storage para compatibilidade com outras abas
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-movimentacoes-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }
  
  return saved;
}

// Atualizar movimentação
export async function updateMovimentacao(
  id: string,
  updates: Partial<Omit<Movimentacao, 'id' | 'data'>>
): Promise<Movimentacao | null> {
  const movimentacao = financeiroRepo.getById(id);

  if (!movimentacao) {
    logger.warn(`Movimentação com id ${id} não encontrada`);
    return null;
  }

  // Validação: valor não pode ser negativo
  if (updates.valor !== undefined && updates.valor < 0) {
    logger.error('Valor não pode ser negativo');
    return null;
  }

  const atualizada: Movimentacao = { ...movimentacao, ...updates };
  
  // Valida movimentação atualizada
  if (!isValidMovimentacao(atualizada)) {
    logger.error('Movimentação atualizada é inválida');
    return null;
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await financeiroRepo.upsert(atualizada);
  return saved;
}

// Deletar movimentação
export async function deleteMovimentacao(id: string): Promise<boolean> {
  const movimentacao = financeiroRepo.getById(id);

  if (!movimentacao) {
    logger.warn(`Movimentação com id ${id} não encontrada para deletar`);
    return false;
  }

  // ✅ Segurança (auditoria): somente lançamentos manuais podem ser removidos.
  // Lançamentos automáticos (venda/OS/cobrança/taxas/etc) devem ser estornados na origem.
  const isManual =
    movimentacao.origem_tipo === 'manual' ||
    (!movimentacao.origem_tipo && (movimentacao.tipo === 'entrada' || movimentacao.tipo === 'saida' || movimentacao.tipo === 'gasto'));

  if (!isManual) {
    logger.warn(`[Financeiro] Bloqueado delete de movimentação não-manual (${movimentacao.tipo}/${movimentacao.origem_tipo || movimentacao.categoria || 'sem origem'}): ${id}`);
    return false;
  }

  // Usa Repository (remove local + adiciona à outbox)
  return await financeiroRepo.remove(id);
}


// Obter movimentações por tipo
export function getMovimentacoesPorTipo(tipo: TipoMovimentacao): Movimentacao[] {
  return getMovimentacoes().filter(m => m.tipo === tipo);
}

/**
 * Resumo "gerencial" (auditável):
 * - Serviços/Vendas: considera estornos (ex.: editar OS e trocar forma de pagamento)
 * - Gastos: NÃO conta estornos de receita como "gasto" e desconta estornos que cancelam saídas (ex.: taxa do cartão)
 * - Saldo: sempre pelo efeito de caixa (entradas - saídas), incluindo estornos.
 */
function _upper(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

function _isEstorno(m: Movimentacao): boolean {
  if (m.origem_tipo === 'estorno') return true;
  const cat = _upper(m.categoria);
  if (cat.includes('ESTORNO') || cat.startsWith('CANCELA_')) return true;
  const desc = _upper(m.descricao);
  if (desc.includes('ESTORNO')) return true;
  return false;
}

function _isEstornoOS(catUpper: string): boolean {
  return (
    catUpper === 'ESTORNO_OS' ||
    catUpper === 'ESTORNO_ORDEM_SERVICO' ||
    catUpper.startsWith('ESTORNO_OS')
  );
}

function _isEstornoVenda(catUpper: string): boolean {
  return (
    catUpper === 'ESTORNO_VENDA' ||
    catUpper === 'ESTORNO_VENDA_USADO' ||
    catUpper.startsWith('ESTORNO_VENDA')
  );
}

function _signedEntradaSaida(m: Movimentacao): number {
  const v = Math.abs(Number(m.valor || 0));
  if (m.tipo === 'entrada') return v;
  if (m.tipo === 'saida') return -v;
  // fallback defensivo (não deve acontecer em estornos)
  return Number(m.valor || 0);
}

export function resumoGerencialFromMovimentacoes(movimentacoesFiltradas: Movimentacao[]): ResumoFinanceiro {
  // Para saldo (efeito de caixa)
  const TIPOS_ENTRADA_SALDO: TipoMovimentacao[] = [
    'venda',
    'venda_usado',
    'servico',
    'entrada',
    'cobranca',
    'encomenda',
  ];

  const TIPOS_SAIDA_SALDO: TipoMovimentacao[] = [
    'saida',
    'gasto',
    'compra_usado',
    'compra_estoque',
    'taxa_cartao',
    'devolucao',
  ];

  const entradasSaldo = movimentacoesFiltradas.filter(m => TIPOS_ENTRADA_SALDO.includes(m.tipo));
  const saidasSaldo = movimentacoesFiltradas.filter(m => TIPOS_SAIDA_SALDO.includes(m.tipo));

  const totalEntradasSaldo = entradasSaldo.reduce((sum, m) => sum + (Number(m.valor) || 0), 0);
  const totalSaidasSaldo = saidasSaldo.reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);
  const saldoDiario = totalEntradasSaldo - totalSaidasSaldo;

  // ========= Serviços (net por OS) =========
  const servicosBase = movimentacoesFiltradas.filter(m => m.tipo === 'servico');
  const estornosOS = movimentacoesFiltradas.filter(m => {
    const cat = _upper(m.categoria);
    return _isEstorno(m) && _isEstornoOS(cat) && !!m.origem_id;
  });

  const mapServicos = new Map<string, number>();
  const addServico = (k: string, delta: number) => mapServicos.set(k, (mapServicos.get(k) || 0) + delta);

  for (const m of servicosBase) {
    const key = (m.origem_tipo === 'ordem_servico' && m.origem_id) ? m.origem_id : m.id;
    addServico(key, Number(m.valor) || 0);
  }
  for (const m of estornosOS) {
    const key = m.origem_id!;
    addServico(key, _signedEntradaSaida(m));
  }

  const totalServicos = Array.from(mapServicos.values()).reduce((a, b) => a + b, 0);
  const qtdServicos = Array.from(mapServicos.values()).filter(v => Math.abs(v) > 0.00001).length;

  // ========= Vendas (net por venda) =========
  const vendasBase = movimentacoesFiltradas.filter(m => m.tipo === 'venda' || m.tipo === 'venda_usado');
  const estornosVenda = movimentacoesFiltradas.filter(m => {
    const cat = _upper(m.categoria);
    return _isEstorno(m) && _isEstornoVenda(cat) && !!m.origem_id;
  });

  const mapVendas = new Map<string, number>();
  const addVenda = (k: string, delta: number) => mapVendas.set(k, (mapVendas.get(k) || 0) + delta);

  for (const m of vendasBase) {
    const key = m.origem_id || m.id;
    addVenda(key, Number(m.valor) || 0);
  }
  for (const m of estornosVenda) {
    const key = m.origem_id!;
    addVenda(key, _signedEntradaSaida(m));
  }

  const totalVendas = Array.from(mapVendas.values()).reduce((a, b) => a + b, 0);
  const qtdVendas = Array.from(mapVendas.values()).filter(v => Math.abs(v) > 0.00001).length;

  // ========= Gastos (sem estorno de receita; desconta estornos que cancelam saídas) =========
  const gastosBaseMovs = movimentacoesFiltradas.filter(m =>
    TIPOS_SAIDA_SALDO.includes(m.tipo) && !_isEstorno(m)
  );

  const gastosBase = gastosBaseMovs.reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);

  // Estornos que "devolvem" dinheiro ao caixa (normalmente cancelamento de taxa/cartão, devolução etc.)
  // Esses estornos são entradas e devem REDUZIR o total de gastos.
  const estornosEntrada = movimentacoesFiltradas.filter(m => _isEstorno(m) && m.tipo === 'entrada');
  const ajusteGastos = estornosEntrada.reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);

  const totalGastos = Math.max(0, gastosBase - ajusteGastos);
  const qtdGastos = gastosBaseMovs.length;

  // "movimentações" no UI é CONTAGEM (não valor em R$).
  const totalMovimentacoes = movimentacoesFiltradas.length;

  return {
    servicos: { quantidade: qtdServicos, total: totalServicos },
    vendas: { quantidade: qtdVendas, total: totalVendas },
    gastos: { quantidade: qtdGastos, total: totalGastos },
    saldoDiario,
    totalMovimentacoes,
  };
}

// Obter resumo financeiro
export function getResumoFinanceiro(data?: string): ResumoFinanceiro {
  const movimentacoes = getMovimentacoes();

  let movimentacoesFiltradas = movimentacoes;
  if (data) {
    try {
      const dataFiltro = new Date(data);
      if (isNaN(dataFiltro.getTime())) {
        logger.warn('Data inválida fornecida para resumo financeiro');
      } else {
        movimentacoesFiltradas = movimentacoes.filter(m => {
          try {
            const dataMov = new Date(m.data);
            return !isNaN(dataMov.getTime()) && dataMov.toDateString() === dataFiltro.toDateString();
          } catch {
            return false;
          }
        });
      }
    } catch (error) {
      logger.error('Erro ao filtrar por data:', error);
    }
  }

  return resumoGerencialFromMovimentacoes(movimentacoesFiltradas);
}


// ===============================
// 🔧 RANGE HELPERS (Hoje / Últimas 24h / Período)
// ===============================
export function getMovimentacoesRange(fromISO: string, toISO: string): Movimentacao[] {
  const all = getMovimentacoes();
  const from = new Date(fromISO);
  const to = new Date(toISO);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) return all;

  return all.filter((m) => {
    try {
      const d = new Date(m.data);
      if (isNaN(d.getTime())) return false;
      return d >= from && d <= to;
    } catch {
      return false;
    }
  });
}

export function getResumoFinanceiroRange(fromISO: string, toISO: string): ResumoFinanceiro {
  const movimentacoesFiltradas = getMovimentacoesRange(fromISO, toISO);
  return resumoGerencialFromMovimentacoes(movimentacoesFiltradas);
}



// Obter últimas movimentações
export function getUltimasMovimentacoes(limite: number = 10): Movimentacao[] {
  if (limite <= 0) {
    return [];
  }

  const movimentacoes = getMovimentacoes();
  return movimentacoes
    .sort((a, b) => {
      try {
        const dateA = new Date(a.data).getTime();
        const dateB = new Date(b.data).getTime();
        return dateB - dateA;
      } catch {
        return 0;
      }
    })
    .slice(0, Math.min(limite, 100)); // Limite máximo de 100
}


// ===============================
// 🔧 FIX NÍVEL 2: AJUSTES/ENTRADAS por período (Hoje / Últimas 24h)
// ===============================

export function filtrarPorPeriodo<T extends { created_at?: string }>(
  itens: T[],
  start: Date,
  end: Date
): T[] {
  return itens.filter((i) => {
    if (!i.created_at) return false;
    const d = new Date(i.created_at);
    return d >= start && d <= end;
  });
}

/**
 * Soma ajustes/entradas manuais (origem = 'AJUSTE') dentro do período informado.
 * Use isso no cálculo de "Entradas por Setor" para o card Ajustes/Entradas.
 */
export function calcularAjustesPeriodo(
  movimentacoes: any[],
  start: Date,
  end: Date
): number {
  return filtrarPorPeriodo(
    movimentacoes.filter((m) => m?.origem_tipo === 'manual' && m?.tipo === 'entrada'),
    start,
    end
  ).reduce((acc, m) => acc + Number(m?.valor || 0), 0);
}
