/**
 * Funções de Cálculo Financeiro - Smart Tech
 * Funções puras para cálculos financeiros padronizados
 */

import { Venda, OrdemServico, ItemVenda, Produto } from '@/types';

// ============================================
// CÁLCULOS DE VENDAS
// ============================================

/**
 * Calcula o total bruto de uma venda (soma dos subtotais dos itens)
 */
export function calcTotalBrutoVenda(itens: ItemVenda[]): number {
  return itens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
}

/**
 * Calcula o valor da taxa de cartão
 * @param totalBruto - Total bruto da venda/OS
 * @param taxaPercentual - Percentual da taxa (ex: 3.5 para 3.5%)
 * @returns Valor da taxa em reais
 */
export function calcTaxaCartao(totalBruto: number, taxaPercentual?: number): number {
  if (!taxaPercentual || taxaPercentual <= 0) return 0;
  return (totalBruto * taxaPercentual) / 100;
}

/**
 * Calcula o total líquido de uma venda
 * @param totalBruto - Total bruto
 * @param desconto - Desconto comercial
 * @param taxaCartaoValor - Valor da taxa de cartão
 * @returns Total líquido
 */
export function calcTotalLiquido(
  totalBruto: number,
  desconto: number = 0,
  taxaCartaoValor: number = 0
): number {
  const total = totalBruto - (desconto || 0) - (taxaCartaoValor || 0);
  return Math.max(0, total); // Não permite negativo
}

/**
 * Calcula o custo total de uma venda (CMV - Custo Mercadoria Vendida)
 * @param itens - Itens da venda
 * @param produtos - Lista de produtos para buscar custos
 * @returns Custo total
 */
export function calcCustoVenda(itens: ItemVenda[], produtos: Produto[]): number {
  return itens.reduce((sum, item) => {
    // Prioriza custoTotal do item (já calculado), senão calcula
    if (item.custoTotal !== undefined) {
      return sum + item.custoTotal;
    }
    
    // Busca custo do produto
    const produto = produtos.find(p => p.id === item.produtoId);
    const custoUnitario = produto?.custo || produto?.custo_unitario || item.custoUnitario || 0;
    
    return sum + (item.quantidade * custoUnitario);
  }, 0);
}

/**
 * Calcula o custo total de um item de venda
 */
export function calcCustoItem(item: ItemVenda, produto?: Produto): number {
  const custoUnitario = item.custoUnitario || produto?.custo || produto?.custo_unitario || 0;
  return item.quantidade * custoUnitario;
}

/**
 * Calcula o custo total de todos os itens de uma venda
 */
export function calcCustoTotalVenda(itens: ItemVenda[]): number {
  return itens.reduce((total, item) => total + calcCustoItem(item), 0);
}

/**
 * Calcula o total final (após desconto, antes das taxas)
 */
export function calcTotalFinal(totalBruto: number, desconto: number, descontoTipo: 'valor' | 'percentual' = 'valor'): number {
  if (descontoTipo === 'percentual') {
    return totalBruto - (totalBruto * desconto / 100);
  }
  return totalBruto - desconto;
}

/**
 * Calcula o desconto em valor absoluto (R$)
 */
export function calcDescontoValor(totalBruto: number, desconto: number, descontoTipo: 'valor' | 'percentual' = 'valor'): number {
  if (descontoTipo === 'percentual') {
    return totalBruto * desconto / 100;
  }
  return desconto;
}

/**
 * Calcula lucro bruto (total_final - custo_total)
 */
export function calcLucroBruto(totalFinal: number, custoTotal: number): number {
  return totalFinal - custoTotal;
}

/**
 * Calcula lucro líquido (total_liquido - custo_total)
 */
export function calcLucroLiquido(totalLiquido: number, custoTotal: number): number {
  return totalLiquido - custoTotal;
}

/**
 * Calcula todos os valores financeiros de uma venda
 */
export function calcFinanceiroCompleto(
  itens: ItemVenda[],
  desconto: number = 0,
  descontoTipo: 'valor' | 'percentual' = 'valor',
  taxaPercentual: number = 0
): {
  totalBruto: number;
  descontoValor: number;
  totalFinal: number;
  taxaValor: number;
  totalLiquido: number;
  custoTotal: number;
  lucroBruto: number;
  lucroLiquido: number;
} {
  const totalBruto = calcTotalBrutoVenda(itens);
  const descontoValor = calcDescontoValor(totalBruto, desconto, descontoTipo);
  const totalFinal = totalBruto - descontoValor;
  const taxaValor = calcTaxaCartao(totalFinal, taxaPercentual);
  const totalLiquido = totalFinal - taxaValor;
  const custoTotal = calcCustoTotalVenda(itens);
  const lucroBruto = calcLucroBruto(totalFinal, custoTotal);
  const lucroLiquido = calcLucroLiquido(totalLiquido, custoTotal);
  
  return {
    totalBruto,
    descontoValor,
    totalFinal,
    taxaValor,
    totalLiquido,
    custoTotal,
    lucroBruto,
    lucroLiquido
  };
}

// ============================================
// CÁLCULOS DE ORDEM DE SERVIÇO
// ============================================

/**
 * Calcula o total bruto de uma OS
 */
export function calcTotalBrutoOS(
  valorServico: number = 0,
  valorPecas: number = 0
): number {
  return (valorServico || 0) + (valorPecas || 0);
}

/**
 * Calcula o total líquido de uma OS
 */
export function calcTotalLiquidoOS(
  totalBruto: number,
  desconto: number = 0,
  taxaCartaoValor: number = 0
): number {
  return calcTotalLiquido(totalBruto, desconto, taxaCartaoValor);
}

/**
 * Calcula o custo total de uma OS
 * @param valorPecas - Custo das peças
 * @param custoInterno - Custo de mão de obra (opcional)
 * @returns Custo total
 */
export function calcCustoOS(valorPecas: number = 0, custoInterno: number = 0): number {
  return (valorPecas || 0) + (custoInterno || 0);
}

// ============================================
// CÁLCULOS DE LUCRO E MARGEM
// ============================================

/**
 * Calcula o lucro (receita líquida - custos)
 */
export function calcLucro(receitaLiquida: number, custoTotal: number): number {
  return receitaLiquida - custoTotal;
}

/**
 * Calcula a margem de lucro em percentual
 * @param lucro - Lucro em reais
 * @param receitaLiquida - Receita líquida
 * @returns Margem em percentual (0-100) ou null se receita for zero
 */
export function calcMargem(lucro: number, receitaLiquida: number): number | null {
  if (receitaLiquida <= 0) return null;
  return (lucro / receitaLiquida) * 100;
}

/**
 * Formata margem para exibição
 */
export function formatMargem(margem: number | null): string {
  if (margem === null) return 'N/A';
  return `${margem.toFixed(2)}%`;
}

// ============================================
// CÁLCULOS DE PERÍODO
// ============================================

export interface PeriodoFiltro {
  inicio: Date;
  fim: Date;
}

/**
 * Cria filtro de período padrão
 */
export function criarPeriodo(tipo: 'hoje' | '7dias' | 'mes' | 'personalizado', inicio?: Date, fim?: Date): PeriodoFiltro {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  switch (tipo) {
    case 'hoje':
      return {
        inicio: new Date(hoje),
        fim: new Date(hoje.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case '7dias':
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      return {
        inicio: seteDiasAtras,
        fim: new Date(hoje.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'mes':
      const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        inicio: primeiroDiaMes,
        fim: ultimoDiaMes
      };
    
    case 'personalizado':
      if (!inicio || !fim) {
        // Fallback seguro: usar período do mês atual se datas não fornecidas
        console.warn('[Período] Período personalizado sem datas fornecidas, usando mês atual como fallback');
        return criarPeriodo('mes');
      }
      return { inicio, fim };
    
    default:
      return criarPeriodo('hoje');
  }
}

/**
 * Verifica se uma data está dentro do período
 */
export function estaNoPeriodo(data: string | Date, periodo: PeriodoFiltro): boolean {
  const dataObj = typeof data === 'string' ? new Date(data) : data;
  return dataObj >= periodo.inicio && dataObj <= periodo.fim;
}

// ============================================
// NORMALIZAÇÃO DE DADOS
// ============================================

/**
 * Normaliza uma venda para garantir campos financeiros calculados
 */
export function normalizarVenda(venda: Venda): Venda {
  const totalBruto = venda.total_bruto ?? venda.total ?? calcTotalBrutoVenda(venda.itens);

  const desconto = venda.desconto ?? 0;
  const descontoTipo = venda.desconto_tipo ?? 'valor';

  // total_final = total bruto após desconto (antes da taxa)
  const totalFinal = venda.total_final ?? Math.max(0, calcTotalFinal(totalBruto, desconto, descontoTipo));

  // taxa do cartão (se não veio calculada, calcula no total_final)
  const isCard = ['cartao', 'debito', 'credito'].includes(String(venda.formaPagamento || '').toLowerCase());
  const taxaPercentual = venda.taxa_cartao_percentual ?? 0;
  const taxaCartaoValor =
    typeof venda.taxa_cartao_valor === 'number'
      ? venda.taxa_cartao_valor
      : (isCard && taxaPercentual > 0 ? calcTaxaCartao(totalFinal, taxaPercentual) : 0);

  const totalLiquido = venda.total_liquido ?? Math.max(0, totalFinal - taxaCartaoValor);

  // custos/lucros (se não vierem, calcula)
  const custoTotal = venda.custo_total ?? calcCustoTotalVenda(venda.itens);
  const lucroBruto = venda.lucro_bruto ?? calcLucroBruto(totalFinal, custoTotal);
  const lucroLiquido = venda.lucro_liquido ?? calcLucroLiquido(totalLiquido, custoTotal);

  return {
    ...venda,
    total: totalBruto, // Mantém compatibilidade
    total_bruto: totalBruto,
    desconto: desconto,
    desconto_tipo: descontoTipo,
    total_final: totalFinal,
    taxa_cartao_percentual: taxaPercentual || venda.taxa_cartao_percentual,
    taxa_cartao_valor: taxaCartaoValor,
    total_liquido: totalLiquido,
    custo_total: custoTotal,
    lucro_bruto: lucroBruto,
    lucro_liquido: lucroLiquido,
    status_pagamento: venda.status_pagamento || 'pendente'
  };
}


/**
 * Normaliza uma OS para garantir campos financeiros calculados
 */

/**
 * Normaliza uma OS para garantir campos financeiros calculados
 */
export function normalizarOS(ordem: OrdemServico): OrdemServico {
  const totalBruto = ordem.total_bruto ?? ordem.valorTotal ?? calcTotalBrutoOS(ordem.valorServico, ordem.valorPecas);
  const desconto = ordem.desconto ?? 0;

  const totalFinal = Math.max(0, totalBruto - desconto);

  const isCard = ['cartao', 'debito', 'credito'].includes(String(ordem.formaPagamento || '').toLowerCase());
  const taxaPercentual = ordem.taxa_cartao_percentual ?? 0;
  const taxaCartaoValor =
    typeof ordem.taxa_cartao_valor === 'number'
      ? ordem.taxa_cartao_valor
      : (isCard && taxaPercentual > 0 ? calcTaxaCartao(totalFinal, taxaPercentual) : 0);

  const totalLiquido = ordem.total_liquido ?? Math.max(0, totalFinal - taxaCartaoValor);

  return {
    ...ordem,
    valorTotal: totalBruto, // Mantém compatibilidade
    total_bruto: totalBruto,
    desconto: desconto,
    taxa_cartao_percentual: taxaPercentual || ordem.taxa_cartao_percentual,
    taxa_cartao_valor: taxaCartaoValor,
    total_liquido: totalLiquido,
    status_pagamento: ordem.status_pagamento || 'pendente'
  };
}

