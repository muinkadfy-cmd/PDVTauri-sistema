import type { Movimentacao, OrdemServico, Usado, UsadoVenda, Venda } from '@/types';
import { logger } from '@/utils/logger';
import { getMovimentacoes } from '@/lib/data';
import { getVendas } from '@/lib/vendas';
import { getOrdens } from '@/lib/ordens';
import { getVendasUsados } from '@/lib/usados';
import { usadosRepo } from '@/lib/repositories';
import { criarLancamentosVenda, criarLancamentosOS, criarLancamentosUsadoVenda } from './lancamentos';
import { calcTotalFinal, normalizarOS, normalizarVenda } from './calc';
import {
  criarEstornoEspelhoDeMovimentacao,
  isMovimentacaoEstornada,
  isMovimentacaoEstorno,
} from './estornos';

export type FinanceReconcileReport = {
  checkedVendas: number;
  checkedOrdens: number;
  checkedUsados: number;
  missingVendas: number;
  missingOrdens: number;
  missingUsados: number;
  repairedVendas: number;
  repairedOrdens: number;
  repairedUsados: number;
  duplicateMovements: number;
  repairedDuplicates: number;
  orphanMovements: number;
  repairedOrphans: number;
  staleTaxas: number;
  repairedStaleTaxas: number;
  valueMismatches: number;
  repairedValueMismatches: number;
  skippedUsadosSemCadastro: number;
  changed: boolean;
};

let inflight: Promise<FinanceReconcileReport> | null = null;

function isCardPayment(value: unknown): boolean {
  const fp = String(value || '').trim().toLowerCase();
  return fp === 'cartao' || fp === 'debito' || fp === 'credito';
}

function buildReport(): FinanceReconcileReport {
  return {
    checkedVendas: 0,
    checkedOrdens: 0,
    checkedUsados: 0,
    missingVendas: 0,
    missingOrdens: 0,
    missingUsados: 0,
    repairedVendas: 0,
    repairedOrdens: 0,
    repairedUsados: 0,
    duplicateMovements: 0,
    repairedDuplicates: 0,
    orphanMovements: 0,
    repairedOrphans: 0,
    staleTaxas: 0,
    repairedStaleTaxas: 0,
    valueMismatches: 0,
    repairedValueMismatches: 0,
    skippedUsadosSemCadastro: 0,
    changed: false,
  };
}

function activeMovs(movs: Movimentacao[], predicate: (m: Movimentacao) => boolean): Movimentacao[] {
  return movs.filter((m) => predicate(m) && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movs));
}

function byDateAsc(a: Movimentacao, b: Movimentacao): number {
  const ta = new Date(a.data || '').getTime();
  const tb = new Date(b.data || '').getTime();
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= 0.009;
}

function vendaExpectedEntrada(venda: Venda): number {
  const normalized = normalizarVenda(venda);
  const totalBruto = normalized.total_bruto ?? normalized.total ?? 0;
  const desconto = normalized.desconto ?? 0;
  const descontoTipo = normalized.desconto_tipo ?? 'valor';
  return normalized.total_final ?? Math.max(0, calcTotalFinal(totalBruto, desconto, descontoTipo));
}

function ordemExpectedEntrada(ordem: OrdemServico): number {
  const normalized = normalizarOS(ordem);
  const totalBruto = normalized.total_bruto ?? normalized.valorTotal ?? 0;
  const desconto = normalized.desconto ?? 0;
  return Math.max(0, totalBruto - desconto);
}

async function estornarExtras(
  movs: Movimentacao[],
  report: FinanceReconcileReport,
  responsavel: string,
  motivo: string
): Promise<void> {
  if (movs.length <= 1) return;
  const extras = [...movs].sort(byDateAsc).slice(1);
  report.duplicateMovements += extras.length;

  for (const mov of extras) {
    const ok = await criarEstornoEspelhoDeMovimentacao(mov, responsavel, motivo);
    if (ok) {
      report.repairedDuplicates += 1;
      report.changed = true;
    }
  }
}

async function estornarSeValorDiferente(
  movs: Movimentacao[],
  expected: number,
  report: FinanceReconcileReport,
  responsavel: string,
  motivo: string
): Promise<boolean> {
  const principal = [...movs].sort(byDateAsc)[0];
  if (!principal) return false;
  if (approxEqual(principal.valor, expected)) return false;

  report.valueMismatches += 1;
  const ok = await criarEstornoEspelhoDeMovimentacao(principal, responsavel, `${motivo} - valor antigo R$ ${Number(principal.valor || 0).toFixed(2)} / correto R$ ${Number(expected || 0).toFixed(2)}`);
  if (ok) {
    report.repairedValueMismatches += 1;
    report.changed = true;
  }
  return ok;
}

function vendaEntradaMovs(movs: Movimentacao[], vendaId: string): Movimentacao[] {
  return activeMovs(movs, (m) => m.origem_id === vendaId && m.origem_tipo === 'venda' && m.categoria === 'venda' && m.tipo === 'venda');
}

function vendaTaxaMovs(movs: Movimentacao[], vendaId: string): Movimentacao[] {
  return activeMovs(movs, (m) => m.origem_id === vendaId && m.origem_tipo === 'venda' && m.categoria === 'taxa_cartao' && m.tipo === 'taxa_cartao');
}

function ordemEntradaMovs(movs: Movimentacao[], ordemId: string): Movimentacao[] {
  return activeMovs(movs, (m) => m.origem_id === ordemId && m.origem_tipo === 'ordem_servico' && m.categoria === 'ordem_servico' && m.tipo === 'servico');
}

function ordemTaxaMovs(movs: Movimentacao[], ordemId: string): Movimentacao[] {
  return activeMovs(movs, (m) => m.origem_id === ordemId && m.origem_tipo === 'ordem_servico' && m.categoria === 'taxa_cartao' && m.tipo === 'taxa_cartao');
}

function usadoVendaMovs(movs: Movimentacao[], vendaId: string): Movimentacao[] {
  return activeMovs(movs, (m) => m.origem_id === vendaId && m.origem_tipo === 'venda_usado' && m.categoria === 'venda_usado' && m.tipo === 'venda_usado');
}

async function repairOrphans(movs: Movimentacao[], report: FinanceReconcileReport, responsavel: string): Promise<void> {
  const vendaIds = new Set(getVendas().map((item) => item.id));
  const ordemIds = new Set(getOrdens().map((item) => item.id));
  const usadosVendaIds = new Set(getVendasUsados().map((item) => item.id));

  const orphanMovs = activeMovs(movs, (mov) => {
    if (!mov.origem_id) return false;
    if (mov.origem_tipo === 'venda') return !vendaIds.has(mov.origem_id);
    if (mov.origem_tipo === 'ordem_servico') return !ordemIds.has(mov.origem_id);
    if (mov.origem_tipo === 'venda_usado') return !usadosVendaIds.has(mov.origem_id);
    return false;
  });

  report.orphanMovements += orphanMovs.length;
  for (const mov of orphanMovs) {
    const ok = await criarEstornoEspelhoDeMovimentacao(mov, responsavel, `Lançamento órfão sem documento de origem (${mov.origem_tipo}:${mov.origem_id})`);
    if (ok) {
      report.repairedOrphans += 1;
      report.changed = true;
    }
  }
}

export async function reconcileFinancialMirrors(reason: string = 'manual'): Promise<FinanceReconcileReport> {
  if (inflight) return inflight;

  inflight = (async () => {
    const report = buildReport();
    const responsavel = 'Sistema';

    try {
      await repairOrphans(getMovimentacoes(), report, responsavel);

      const vendas = getVendas();
      for (const venda of vendas) {
        report.checkedVendas += 1;

        const statusPagamento = String((venda as any).status_pagamento || 'pago').toLowerCase();
        const movsNow = getMovimentacoes();
        const entradas = vendaEntradaMovs(movsNow, venda.id);
        const taxas = vendaTaxaMovs(movsNow, venda.id);

        await estornarExtras(entradas, report, responsavel, `Duplicidade de venda #${(venda as any).numero_venda || venda.id.slice(-6)}`);
        await estornarExtras(taxas, report, responsavel, `Duplicidade de taxa da venda #${(venda as any).numero_venda || venda.id.slice(-6)}`);

        if (statusPagamento !== 'pago') {
          for (const mov of [...entradas, ...taxas]) {
            report.staleTaxas += 1;
            const ok = await criarEstornoEspelhoDeMovimentacao(mov, responsavel, `Venda #${(venda as any).numero_venda || venda.id.slice(-6)} não está paga`);
            if (ok) {
              report.repairedStaleTaxas += 1;
              report.changed = true;
            }
          }
          continue;
        }

        const expectedEntrada = vendaExpectedEntrada(venda);
        const mismatchEntrada = entradas.length > 0
          ? await estornarSeValorDiferente(entradas, expectedEntrada, report, responsavel, `Venda #${(venda as any).numero_venda || venda.id.slice(-6)} corrigida`)
          : false;

        const requiresTaxa = isCardPayment((venda as any).formaPagamento) && Number((venda as any).taxa_cartao_valor || 0) > 0;
        const expectedTaxa = Number((venda as any).taxa_cartao_valor || 0);
        const mismatchTaxa = requiresTaxa && taxas.length > 0
          ? await estornarSeValorDiferente(taxas, expectedTaxa, report, responsavel, `Taxa da venda #${(venda as any).numero_venda || venda.id.slice(-6)} corrigida`)
          : false;

        if (!requiresTaxa && taxas.length > 0) {
          report.staleTaxas += taxas.length;
          for (const mov of taxas) {
            const ok = await criarEstornoEspelhoDeMovimentacao(mov, responsavel, `Taxa indevida de venda sem cartão #${(venda as any).numero_venda || venda.id.slice(-6)}`);
            if (ok) {
              report.repairedStaleTaxas += 1;
              report.changed = true;
            }
          }
        }

        const needsEntrada = entradas.length === 0 || mismatchEntrada;
        const needsTaxa = requiresTaxa && (taxas.length === 0 || mismatchTaxa);
        if (!needsEntrada && !needsTaxa) continue;

        report.missingVendas += 1;
        const ok = await criarLancamentosVenda(venda);
        if (ok) {
          report.repairedVendas += 1;
          report.changed = true;
          logger.warn('[Financeiro] Espelho financeiro de venda reconciliado', { reason, vendaId: venda.id, numero: (venda as any).numero_venda || venda.id.slice(-6) });
        } else {
          logger.error('[Financeiro] Falha ao reconciliar espelho financeiro de venda', { reason, vendaId: venda.id });
        }
      }

      const ordens = getOrdens();
      for (const ordem of ordens) {
        report.checkedOrdens += 1;

        const statusPagamento = String((ordem as any).status_pagamento || 'pendente').toLowerCase();
        const movsNow = getMovimentacoes();
        const entradas = ordemEntradaMovs(movsNow, ordem.id);
        const taxas = ordemTaxaMovs(movsNow, ordem.id);

        await estornarExtras(entradas, report, responsavel, `Duplicidade de OS ${ordem.numero || ordem.id.slice(-6)}`);
        await estornarExtras(taxas, report, responsavel, `Duplicidade de taxa da OS ${ordem.numero || ordem.id.slice(-6)}`);

        if (statusPagamento !== 'pago') {
          for (const mov of [...entradas, ...taxas]) {
            report.staleTaxas += 1;
            const ok = await criarEstornoEspelhoDeMovimentacao(mov, responsavel, `OS ${ordem.numero || ordem.id.slice(-6)} não está paga`);
            if (ok) {
              report.repairedStaleTaxas += 1;
              report.changed = true;
            }
          }
          continue;
        }

        const expectedEntrada = ordemExpectedEntrada(ordem);
        const mismatchEntrada = entradas.length > 0
          ? await estornarSeValorDiferente(entradas, expectedEntrada, report, responsavel, `OS ${ordem.numero || ordem.id.slice(-6)} corrigida`)
          : false;

        const requiresTaxa = isCardPayment((ordem as any).formaPagamento) && Number((ordem as any).taxa_cartao_valor || 0) > 0;
        const expectedTaxa = Number((ordem as any).taxa_cartao_valor || 0);
        const mismatchTaxa = requiresTaxa && taxas.length > 0
          ? await estornarSeValorDiferente(taxas, expectedTaxa, report, responsavel, `Taxa da OS ${ordem.numero || ordem.id.slice(-6)} corrigida`)
          : false;

        if (!requiresTaxa && taxas.length > 0) {
          report.staleTaxas += taxas.length;
          for (const mov of taxas) {
            const ok = await criarEstornoEspelhoDeMovimentacao(mov, responsavel, `Taxa indevida de OS sem cartão ${ordem.numero || ordem.id.slice(-6)}`);
            if (ok) {
              report.repairedStaleTaxas += 1;
              report.changed = true;
            }
          }
        }

        const needsEntrada = entradas.length === 0 || mismatchEntrada;
        const needsTaxa = requiresTaxa && (taxas.length === 0 || mismatchTaxa);
        if (!needsEntrada && !needsTaxa) continue;

        report.missingOrdens += 1;
        const ok = await criarLancamentosOS(ordem, { revision: Number((ordem as any).finance_rev || 1) || 1, motivo: 'Reconciliation' });
        if (ok) {
          report.repairedOrdens += 1;
          report.changed = true;
          logger.warn('[Financeiro] Espelho financeiro de OS reconciliado', { reason, ordemId: ordem.id, numero: ordem.numero });
        } else {
          logger.error('[Financeiro] Falha ao reconciliar espelho financeiro de OS', { reason, ordemId: ordem.id });
        }
      }

      const usadosById = new Map(usadosRepo.list().map((item) => [item.id, item] as const));
      const vendasUsados = getVendasUsados();
      for (const venda of vendasUsados) {
        report.checkedUsados += 1;
        const movsNow = getMovimentacoes();
        const entradas = usadoVendaMovs(movsNow, venda.id);

        await estornarExtras(entradas, report, responsavel, `Duplicidade de venda de usado ${venda.id.slice(-6)}`);

        const usado = usadosById.get(venda.usadoId);
        if (!usado) {
          report.skippedUsadosSemCadastro += 1;
          logger.warn('[Financeiro] Venda de usado sem cadastro base para reconciliar', { reason, vendaId: venda.id, usadoId: venda.usadoId });
          continue;
        }

        const expectedEntrada = Number((venda as UsadoVenda).valorVenda || 0);
        const mismatchEntrada = entradas.length > 0
          ? await estornarSeValorDiferente(entradas, expectedEntrada, report, responsavel, `Venda de usado ${venda.id.slice(-6)} corrigida`)
          : false;

        if (entradas.length > 0 && !mismatchEntrada) continue;

        report.missingUsados += 1;
        const ok = await criarLancamentosUsadoVenda(venda as UsadoVenda, usado as Usado, venda.compradorId || 'Sistema');
        if (ok) {
          report.repairedUsados += 1;
          report.changed = true;
          logger.warn('[Financeiro] Espelho financeiro de venda de usado reconciliado', { reason, vendaId: venda.id, usadoId: venda.usadoId });
        } else {
          logger.error('[Financeiro] Falha ao reconciliar espelho financeiro de venda de usado', { reason, vendaId: venda.id, usadoId: venda.usadoId });
        }
      }

      if (report.changed) {
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'smart-tech-financeiro-reconciled',
            newValue: Date.now().toString(),
          }));
          window.dispatchEvent(new CustomEvent('smart-tech-financeiro-reconciled', { detail: report }));
        } catch {}
      }

      logger.log('[Financeiro] Reconcile de espelhos concluído', { reason, report });
      return report;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
