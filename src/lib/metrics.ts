/**
 * Serviço Centralizado de Métricas Financeiras
 * Calcula métricas para qualquer origem de dados
 */

import { getVendas } from './vendas';
import { getOrdens } from './ordens';
import { getUsados } from './usados';
import { getCobrancas } from './cobrancas';
import { getRecibos } from './recibos';
import { usadosVendasRepo } from './repositories';
import { criarPeriodo, estaNoPeriodo, type PeriodoFiltro } from './finance/calc';
import type { FinanceMetrics } from '@/components/FinanceMetricsCards';
import type { UsadoVenda } from '@/types';

export type OrigemMetrica = 
  | 'VENDA' 
  | 'RECIBO' 
  | 'ORDEM_SERVICO' 
  | 'VENDA_USADO' 
  | 'COMPRA_USADO' 
  | 'COBRANCA'
  | 'ENCOMENDA'
  | 'DEVOLUCAO';

export interface MetricsOptions {
  storeId?: string | null;
  from?: Date;
  to?: Date;
  origem: OrigemMetrica;
}

/**
 * Calcula métricas financeiras para uma origem específica
 * Usa sempre a fonte de dados local (vendas, ordens, usados, etc)
 * que já está sincronizada com o financeiro/lançamentos
 */
export function getMetrics(options: MetricsOptions): FinanceMetrics {
  const { origem, from, to } = options;

  // Criar período
  let periodo: PeriodoFiltro;
  if (from && to) {
    periodo = criarPeriodo('personalizado', from, to);
  } else {
    periodo = criarPeriodo('hoje');
  }

  // Inicializar métricas
  const metrics: FinanceMetrics = {
    totalBruto: 0,
    totalDescontos: 0,
    totalTaxas: 0,
    totalFinal: 0,
    totalLiquido: 0,
    custoTotal: 0,
    lucroBruto: 0,
    lucroLiquido: 0,
    margem: 0,
    quantidade: 0
  };

  // Calcular baseado na origem
  switch (origem) {
    case 'VENDA':
      return calcularMetricasVendas(periodo);
    
    case 'ORDEM_SERVICO':
      return calcularMetricasOrdens(periodo);
    
    case 'VENDA_USADO':
      return calcularMetricasVendaUsados(periodo);
    
    case 'COMPRA_USADO':
      return calcularMetricasCompraUsados(periodo);
    
    case 'COBRANCA':
      return calcularMetricasCobrancas(periodo);
    
    case 'RECIBO':
      return calcularMetricasRecibos(periodo);
    
    default:
      return metrics;
  }
}

/**
 * Calcula métricas de VENDAS
 */
function calcularMetricasVendas(periodo: PeriodoFiltro): FinanceMetrics {
  const vendas = getVendas().filter(v => estaNoPeriodo(v.data, periodo));

  let totalBruto = 0;
  let totalDescontos = 0;
  let totalTaxas = 0;
  let totalLiquido = 0;
  let custoTotal = 0;
  let lucroBruto = 0;
  let lucroLiquido = 0;

  vendas.forEach(v => {
    totalBruto += v.total || 0;
    totalDescontos += v.desconto || 0;
    totalTaxas += v.taxa_cartao_valor || 0;
    totalLiquido += v.total_liquido || v.total || 0;
    custoTotal += v.custo_total || 0;
    lucroBruto += v.lucro_bruto || 0;
    lucroLiquido += v.lucro_liquido || 0;
  });

  const totalFinal = totalBruto - totalDescontos;
  const margem = totalLiquido > 0 ? (lucroLiquido / totalLiquido) * 100 : 0;

  return {
    totalBruto,
    totalDescontos,
    totalTaxas,
    totalFinal,
    totalLiquido,
    custoTotal,
    lucroBruto,
    lucroLiquido,
    margem,
    quantidade: vendas.length
  };
}

/**
 * Calcula métricas de ORDENS DE SERVIÇO
 */
function calcularMetricasOrdens(periodo: PeriodoFiltro): FinanceMetrics {
  // ✅ CORRIGIDO: Contar TODAS as OS do período (não só as pagas)
  const ordens = getOrdens().filter(o => 
    o.dataAbertura && estaNoPeriodo(o.dataAbertura, periodo)
  );

  let totalBruto = 0;
  let totalDescontos = 0;
  let totalTaxas = 0;
  let totalLiquido = 0;
  let custoTotal = 0;
  let lucroBruto = 0;
  let lucroLiquido = 0;

  ordens.forEach(o => {
    const bruto = o.total_bruto || o.valorTotal || 0;
    const taxa = o.taxa_cartao_valor || 0;
    const liquido = o.total_liquido || (bruto - taxa);
    const custo = o.custo_interno || 0;
    
    totalBruto += bruto;
    totalTaxas += taxa;
    totalLiquido += liquido;
    custoTotal += custo;
    lucroBruto += (bruto - custo);
    lucroLiquido += (liquido - custo);
  });

  const totalFinal = totalBruto - totalDescontos;
  const margem = totalLiquido > 0 ? (lucroLiquido / totalLiquido) * 100 : 0;

  return {
    totalBruto,
    totalDescontos,
    totalTaxas,
    totalFinal,
    totalLiquido,
    custoTotal,
    lucroBruto,
    lucroLiquido,
    margem,
    quantidade: ordens.length
  };
}

/**
 * Calcula métricas de VENDA DE USADOS
 */
function calcularMetricasVendaUsados(periodo: PeriodoFiltro): FinanceMetrics {
  const usados = getUsados();
  
  // Buscar vendas do repositório
  const vendas: UsadoVenda[] = usadosVendasRepo.list().filter(
    (v: UsadoVenda) => v.dataVenda && estaNoPeriodo(v.dataVenda, periodo)
  );
  
  let totalBruto = 0;
  let custoTotal = 0;
  let lucroBruto = 0;

  vendas.forEach((v: UsadoVenda) => {
    const valorVenda = v.valorVenda || 0;
    
    // Buscar aparelho para pegar custo de compra
    const usado = usados.find(u => u.id === v.usadoId);
    const valorCompra = usado?.valorCompra || 0;
    
    totalBruto += valorVenda;
    custoTotal += valorCompra;
    lucroBruto += (valorVenda - valorCompra);
  });

  // Usados não tem desconto nem taxa por enquanto
  const totalLiquido = totalBruto;
  const lucroLiquido = lucroBruto;
  const margem = totalLiquido > 0 ? (lucroLiquido / totalLiquido) * 100 : 0;

  return {
    totalBruto,
    totalDescontos: 0,
    totalTaxas: 0,
    totalFinal: totalBruto,
    totalLiquido,
    custoTotal,
    lucroBruto,
    lucroLiquido,
    margem,
    quantidade: vendas.length
  };
}

/**
 * Calcula métricas de COMPRA DE USADOS
 */
function calcularMetricasCompraUsados(periodo: PeriodoFiltro): FinanceMetrics {
  const usados = getUsados().filter(u => 
    u.created_at && estaNoPeriodo(u.created_at, periodo)
  );

  let totalBruto = 0;
  let custoTotal = 0;

  usados.forEach(u => {
    const valorCompra = u.valorCompra || 0;
    totalBruto += valorCompra;
    custoTotal += valorCompra;
  });

  // Compra = saída (lucro negativo)
  return {
    totalBruto,
    totalDescontos: 0,
    totalTaxas: 0,
    totalFinal: totalBruto,
    totalLiquido: totalBruto,
    custoTotal,
    lucroBruto: -custoTotal,
    lucroLiquido: -custoTotal,
    margem: -100,
    quantidade: usados.length
  };
}

/**
 * Calcula métricas de COBRANÇAS
 */
function calcularMetricasCobrancas(periodo: PeriodoFiltro): FinanceMetrics {
  // Métrica financeira de cobrança = valores efetivamente recebidos.
  // Considera somente cobranças PAGAS, usando dataPagamento quando existir.
  const cobrancasPagas = getCobrancas().filter(c => {
    if (c.status !== 'paga') return false;
    const dataReferencia = c.dataPagamento || c.dataCriacao;
    return Boolean(dataReferencia && estaNoPeriodo(dataReferencia, periodo));
  });

  let totalBruto = 0;

  cobrancasPagas.forEach(c => {
    totalBruto += c.valor || 0;
  });

  // Cobranças recebidas não têm desconto, taxa nem custo neste módulo.
  return {
    totalBruto,
    totalDescontos: 0,
    totalTaxas: 0,
    totalFinal: totalBruto,
    totalLiquido: totalBruto,
    custoTotal: 0,
    lucroBruto: totalBruto,
    lucroLiquido: totalBruto,
    margem: totalBruto > 0 ? 100 : 0,
    quantidade: cobrancasPagas.length
  };
}

/**
 * Calcula métricas de RECIBOS
 */
function calcularMetricasRecibos(periodo: PeriodoFiltro): FinanceMetrics {
  const recibos = getRecibos().filter(r => 
    r.data && estaNoPeriodo(r.data, periodo)
  );

  let totalBruto = 0;

  recibos.forEach(r => {
    totalBruto += r.valor || 0;
  });

  // Recibos não têm desconto, taxa nem custo
  return {
    totalBruto,
    totalDescontos: 0,
    totalTaxas: 0,
    totalFinal: totalBruto,
    totalLiquido: totalBruto,
    custoTotal: 0,
    lucroBruto: totalBruto,
    lucroLiquido: totalBruto,
    margem: 100,
    quantidade: recibos.length
  };
}

/**
 * Helper para criar período baseado em tipo
 */
export function criarPeriodoPorTipo(tipo: 'hoje' | '7dias' | 'mes' | 'personalizado', inicio?: Date, fim?: Date): PeriodoFiltro {
  if (tipo === 'personalizado' && inicio && fim) {
    return criarPeriodo('personalizado', inicio, fim);
  }
  return criarPeriodo(tipo);
}
