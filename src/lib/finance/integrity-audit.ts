import type { Movimentacao } from '@/types';
import { getMovimentacoes } from '@/lib/data';
import { getOrdens } from '@/lib/ordens';
import { usadosRepo } from '@/lib/repositories';
import { getVendas } from '@/lib/vendas';
import { getVendasUsados } from '@/lib/usados';
import { logger } from '@/utils/logger';
import { reconcileFinancialMirrors, type FinanceReconcileReport } from './reconciliation';
import { isMovimentacaoEstornada, isMovimentacaoEstorno } from './estornos';
import { calcTotalFinal, normalizarOS, normalizarVenda } from './calc';

type AuditIds = {
  missingVendaIds: string[];
  missingOrdemIds: string[];
  missingUsadoIds: string[];
  duplicateMovementIds: string[];
  orphanVendaMovementIds: string[];
  orphanOrdemMovementIds: string[];
  orphanUsadoMovementIds: string[];
  staleTaxaMovementIds: string[];
  valueMismatchMovementIds: string[];
};

export type FinancialIntegrityAuditReport = {
  checkedAt: string;
  paidVendasChecked: number;
  paidOrdensChecked: number;
  usedSalesChecked: number;
  totalRelevantMovements: number;
  missingVendaMirrors: number;
  missingOrdemMirrors: number;
  missingUsadoMirrors: number;
  duplicateAutomaticMovements: number;
  orphanVendaMovements: number;
  orphanOrdemMovements: number;
  orphanUsadoMovements: number;
  staleTaxaMovements: number;
  valueMismatchMovements: number;
  panelFinanceFluxConsistent: boolean;
  ids: AuditIds;
};

export type FinancialIntegrityRepairResult = {
  reconcile: FinanceReconcileReport;
  report: FinancialIntegrityAuditReport;
};

function isCardPayment(value: unknown): boolean {
  const fp = String(value || '').trim().toLowerCase();
  return fp === 'cartao' || fp === 'debito' || fp === 'credito';
}

function activeMovs(movs: Movimentacao[], predicate: (m: Movimentacao) => boolean): Movimentacao[] {
  return movs.filter((m) => predicate(m) && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movs));
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= 0.009;
}

function vendaExpectedEntrada(venda: any): number {
  const normalized = normalizarVenda(venda);
  const totalBruto = normalized.total_bruto ?? normalized.total ?? 0;
  const desconto = normalized.desconto ?? 0;
  const descontoTipo = normalized.desconto_tipo ?? 'valor';
  return normalized.total_final ?? Math.max(0, calcTotalFinal(totalBruto, desconto, descontoTipo));
}

function ordemExpectedEntrada(ordem: any): number {
  const normalized = normalizarOS(ordem);
  const totalBruto = normalized.total_bruto ?? normalized.valorTotal ?? 0;
  const desconto = normalized.desconto ?? 0;
  return Math.max(0, totalBruto - desconto);
}

function addDuplicates(ids: string[], movs: Movimentacao[]) {
  if (movs.length <= 1) return;
  const sorted = [...movs].sort((a, b) => new Date(a.data || '').getTime() - new Date(b.data || '').getTime());
  ids.push(...sorted.slice(1).map((m) => m.id));
}

export async function runFinancialIntegrityAudit(): Promise<FinancialIntegrityAuditReport> {
  const movs = getMovimentacoes();
  const vendas = getVendas();
  const ordens = getOrdens();
  const usadosVendas = getVendasUsados();
  const usadosById = new Set(usadosRepo.list().map((item) => item.id));
  const vendaIds = new Set(vendas.map((item) => item.id));
  const ordemIds = new Set(ordens.map((item) => item.id));
  const usadoVendaIds = new Set(usadosVendas.map((item) => item.id));

  const ids: AuditIds = {
    missingVendaIds: [],
    missingOrdemIds: [],
    missingUsadoIds: [],
    duplicateMovementIds: [],
    orphanVendaMovementIds: [],
    orphanOrdemMovementIds: [],
    orphanUsadoMovementIds: [],
    staleTaxaMovementIds: [],
    valueMismatchMovementIds: [],
  };

  let paidVendasChecked = 0;
  let paidOrdensChecked = 0;
  let usedSalesChecked = 0;

  for (const venda of vendas) {
    const statusPagamento = String((venda as any).status_pagamento || 'pago').toLowerCase();
    const entradas = activeMovs(movs, (m) => m.origem_id === venda.id && m.origem_tipo === 'venda' && m.categoria === 'venda' && m.tipo === 'venda');
    const taxas = activeMovs(movs, (m) => m.origem_id === venda.id && m.origem_tipo === 'venda' && m.categoria === 'taxa_cartao' && m.tipo === 'taxa_cartao');

    addDuplicates(ids.duplicateMovementIds, entradas);
    addDuplicates(ids.duplicateMovementIds, taxas);

    if (statusPagamento !== 'pago') {
      ids.staleTaxaMovementIds.push(...entradas.map((m) => m.id), ...taxas.map((m) => m.id));
      continue;
    }
    paidVendasChecked += 1;

    if (entradas.length === 0) ids.missingVendaIds.push(venda.id);
    else if (!approxEqual(entradas[0].valor, vendaExpectedEntrada(venda))) ids.valueMismatchMovementIds.push(entradas[0].id);

    const needsTaxa = isCardPayment((venda as any).formaPagamento) && Number((venda as any).taxa_cartao_valor || 0) > 0;
    if (needsTaxa && taxas.length === 0) ids.missingVendaIds.push(venda.id);
    if (needsTaxa && taxas.length > 0 && !approxEqual(taxas[0].valor, Number((venda as any).taxa_cartao_valor || 0))) {
      ids.valueMismatchMovementIds.push(taxas[0].id);
    }
    if (!needsTaxa && taxas.length > 0) ids.staleTaxaMovementIds.push(...taxas.map((m) => m.id));
  }

  for (const ordem of ordens) {
    const statusPagamento = String((ordem as any).status_pagamento || 'pendente').toLowerCase();
    const entradas = activeMovs(movs, (m) => m.origem_id === ordem.id && m.origem_tipo === 'ordem_servico' && m.categoria === 'ordem_servico' && m.tipo === 'servico');
    const taxas = activeMovs(movs, (m) => m.origem_id === ordem.id && m.origem_tipo === 'ordem_servico' && m.categoria === 'taxa_cartao' && m.tipo === 'taxa_cartao');

    addDuplicates(ids.duplicateMovementIds, entradas);
    addDuplicates(ids.duplicateMovementIds, taxas);

    if (statusPagamento !== 'pago') {
      ids.staleTaxaMovementIds.push(...entradas.map((m) => m.id), ...taxas.map((m) => m.id));
      continue;
    }
    paidOrdensChecked += 1;

    if (entradas.length === 0) ids.missingOrdemIds.push(ordem.id);
    else if (!approxEqual(entradas[0].valor, ordemExpectedEntrada(ordem))) ids.valueMismatchMovementIds.push(entradas[0].id);

    const needsTaxa = isCardPayment((ordem as any).formaPagamento) && Number((ordem as any).taxa_cartao_valor || 0) > 0;
    if (needsTaxa && taxas.length === 0) ids.missingOrdemIds.push(ordem.id);
    if (needsTaxa && taxas.length > 0 && !approxEqual(taxas[0].valor, Number((ordem as any).taxa_cartao_valor || 0))) {
      ids.valueMismatchMovementIds.push(taxas[0].id);
    }
    if (!needsTaxa && taxas.length > 0) ids.staleTaxaMovementIds.push(...taxas.map((m) => m.id));
  }

  for (const venda of usadosVendas) {
    usedSalesChecked += 1;
    const entradas = activeMovs(movs, (m) => m.origem_id === venda.id && m.origem_tipo === 'venda_usado' && m.categoria === 'venda_usado' && m.tipo === 'venda_usado');
    addDuplicates(ids.duplicateMovementIds, entradas);

    if (!usadosById.has(venda.usadoId)) continue;
    if (entradas.length === 0) ids.missingUsadoIds.push(venda.id);
    else if (!approxEqual(entradas[0].valor, Number((venda as any).valorVenda || 0))) ids.valueMismatchMovementIds.push(entradas[0].id);
  }

  for (const mov of activeMovs(movs, (m) => Boolean(m.origem_id))) {
    if (mov.origem_tipo === 'venda' && mov.origem_id && !vendaIds.has(mov.origem_id)) {
      ids.orphanVendaMovementIds.push(mov.id);
    }
    if (mov.origem_tipo === 'ordem_servico' && mov.origem_id && !ordemIds.has(mov.origem_id)) {
      ids.orphanOrdemMovementIds.push(mov.id);
    }
    if (mov.origem_tipo === 'venda_usado' && mov.origem_id && !usadoVendaIds.has(mov.origem_id)) {
      ids.orphanUsadoMovementIds.push(mov.id);
    }
  }

  ids.missingVendaIds = Array.from(new Set(ids.missingVendaIds));
  ids.missingOrdemIds = Array.from(new Set(ids.missingOrdemIds));
  ids.missingUsadoIds = Array.from(new Set(ids.missingUsadoIds));
  ids.duplicateMovementIds = Array.from(new Set(ids.duplicateMovementIds));
  ids.valueMismatchMovementIds = Array.from(new Set(ids.valueMismatchMovementIds));
  ids.staleTaxaMovementIds = Array.from(new Set(ids.staleTaxaMovementIds));

  const totalProblems =
    ids.missingVendaIds.length +
    ids.missingOrdemIds.length +
    ids.missingUsadoIds.length +
    ids.duplicateMovementIds.length +
    ids.orphanVendaMovementIds.length +
    ids.orphanOrdemMovementIds.length +
    ids.orphanUsadoMovementIds.length +
    ids.staleTaxaMovementIds.length +
    ids.valueMismatchMovementIds.length;

  const report: FinancialIntegrityAuditReport = {
    checkedAt: new Date().toISOString(),
    paidVendasChecked,
    paidOrdensChecked,
    usedSalesChecked,
    totalRelevantMovements: movs.filter((mov) => ['venda', 'venda_usado', 'servico', 'taxa_cartao'].includes(String(mov.tipo))).length,
    missingVendaMirrors: ids.missingVendaIds.length,
    missingOrdemMirrors: ids.missingOrdemIds.length,
    missingUsadoMirrors: ids.missingUsadoIds.length,
    duplicateAutomaticMovements: ids.duplicateMovementIds.length,
    orphanVendaMovements: ids.orphanVendaMovementIds.length,
    orphanOrdemMovements: ids.orphanOrdemMovementIds.length,
    orphanUsadoMovements: ids.orphanUsadoMovementIds.length,
    staleTaxaMovements: ids.staleTaxaMovementIds.length,
    valueMismatchMovements: ids.valueMismatchMovementIds.length,
    panelFinanceFluxConsistent: totalProblems === 0,
    ids,
  };

  logger.log('[Financeiro] Auditoria de integridade concluída', report);
  return report;
}

export async function repairFinancialIntegrity(reason: string = 'manual-audit'): Promise<FinancialIntegrityRepairResult> {
  const reconcile = await reconcileFinancialMirrors(reason);
  const report = await runFinancialIntegrityAudit();
  return { reconcile, report };
}
