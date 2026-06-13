/**
 * Relatórios Financeiros - Smart Tech
 * Funções para gerar relatórios e análises financeiras
 */

import { Venda, OrdemServico, Movimentacao, Produto, FormaPagamento } from '@/types';
import {
  calcTotalLiquido,
  calcCustoVenda,
  calcCustoOS,
  calcLucro,
  calcMargem,
  normalizarVenda,
  normalizarOS,
  PeriodoFiltro,
  estaNoPeriodo
} from './calc';

export interface RelatorioFinanceiro {
  periodo: PeriodoFiltro;
  receitaBruta: number;
  descontos: number;
  taxasCartao: number;
  receitaLiquida: number;
  custos: number;
  lucro: number;
  margem: number | null;
  entradas: number;
  saidas: number;
  saldo: number;
  porFormaPagamento: Record<FormaPagamento, {
    quantidade: number;
    receitaBruta: number;
    receitaLiquida: number;
  }>;
  vendas: {
    quantidade: number;
    receitaBruta: number;
    receitaLiquida: number;
    custos: number;
    lucro: number;
  };
  ordensServico: {
    quantidade: number;
    receitaBruta: number;
    receitaLiquida: number;
    custos: number;
    lucro: number;
  };
  topProdutos: Array<{
    produtoId: string;
    produtoNome: string;
    quantidade: number;
    receita: number;
    custo: number;
    lucro: number;
  }>;
  taxasCartaoDetalhadas: Array<{
    origem: string;
    origemId: string;
    valor: number;
    percentual?: number;
    data: string;
  }>;
}

/**
 * Gera relatório financeiro completo para um período
 */
export function gerarRelatorioFinanceiro(
  vendas: Venda[],
  ordens: OrdemServico[],
  movimentacoes: Movimentacao[],
  produtos: Produto[],
  periodo: PeriodoFiltro
): RelatorioFinanceiro {
  // Filtrar por período
  const vendasFiltradas = vendas
    .map(normalizarVenda)
    .filter(v => estaNoPeriodo(v.data, periodo));
  
  const ordensFiltradas = ordens
    .map(normalizarOS)
    .filter(o => estaNoPeriodo(o.dataAbertura, periodo));

  const movimentacoesFiltradas = movimentacoes
    .filter(m => estaNoPeriodo(m.data, periodo));

  // Calcular receitas
  const receitaBrutaVendas = vendasFiltradas.reduce((sum, v) => sum + (v.total_bruto || v.total || 0), 0);
  const receitaBrutaOS = ordensFiltradas.reduce((sum, o) => sum + (o.total_bruto || o.valorTotal || 0), 0);
  const receitaBruta = receitaBrutaVendas + receitaBrutaOS;

  const descontosVendas = vendasFiltradas.reduce((sum, v) => sum + (v.desconto || 0), 0);
  const descontosOS = ordensFiltradas.reduce((sum, o) => sum + (o.desconto || 0), 0);
  const descontos = descontosVendas + descontosOS;

  const taxasCartaoVendas = vendasFiltradas.reduce((sum, v) => sum + (v.taxa_cartao_valor || 0), 0);
  const taxasCartaoOS = ordensFiltradas.reduce((sum, o) => sum + (o.taxa_cartao_valor || 0), 0);
  const taxasCartao = taxasCartaoVendas + taxasCartaoOS;

  const receitaLiquidaVendas = vendasFiltradas.reduce((sum, v) => sum + (v.total_liquido || 0), 0);
  const receitaLiquidaOS = ordensFiltradas.reduce((sum, o) => sum + (o.total_liquido || 0), 0);
  const receitaLiquida = receitaLiquidaVendas + receitaLiquidaOS;

  // Calcular custos
  const custosVendas = vendasFiltradas.reduce((sum, v) => {
    return sum + calcCustoVenda(v.itens, produtos);
  }, 0);

  const custosOS = ordensFiltradas.reduce((sum, o) => {
    return sum + calcCustoOS(o.valorPecas, o.custo_interno);
  }, 0);

  const custos = custosVendas + custosOS;

  // Calcular lucro e margem
  const lucro = calcLucro(receitaLiquida, custos);
  const margem = calcMargem(lucro, receitaLiquida);

  // Calcular entradas e saídas
  const entradas = movimentacoesFiltradas
    .filter(m => m.tipo === 'entrada' || m.tipo === 'venda' || m.tipo === 'servico')
    .reduce((sum, m) => sum + m.valor, 0);

  const saidas = movimentacoesFiltradas
    .filter(m => m.tipo === 'saida' || m.tipo === 'gasto' || m.tipo === 'taxa_cartao')
    .reduce((sum, m) => sum + m.valor, 0);

  const saldo = entradas - saidas;

  // Por forma de pagamento  
  const porFormaPagamento: Record<FormaPagamento, {
    quantidade: number;
    receitaBruta: number;
    receitaLiquida: number;
  }> = {
    dinheiro: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 },
    pix: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 },
    debito: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 },
    credito: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 },
    cartao: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 },
    boleto: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 },
    outro: { quantidade: 0, receitaBruta: 0, receitaLiquida: 0 }
  };

  [...vendasFiltradas, ...ordensFiltradas].forEach(item => {
    const forma = item.formaPagamento || 'outro';
    if (porFormaPagamento[forma]) {
      porFormaPagamento[forma].quantidade++;
      porFormaPagamento[forma].receitaBruta += (item.total_bruto || (item as any).valorTotal || (item as any).total || 0);
      porFormaPagamento[forma].receitaLiquida += (item.total_liquido || 0);
    }
  });

  // Top produtos
  const produtosMap = new Map<string, { nome: string; quantidade: number; receita: number; custo: number }>();
  
  vendasFiltradas.forEach(venda => {
    venda.itens.forEach(item => {
      // ✅ Pular items manuais (sem produtoId)
      if (!item.produtoId) return;
      
      const existing = produtosMap.get(item.produtoId) || {
        nome: item.produtoNome,
        quantidade: 0,
        receita: 0,
        custo: 0
      };
      
      existing.quantidade += item.quantidade;
      existing.receita += item.subtotal;
      
      const produto = produtos.find(p => p.id === item.produtoId);
      const custoUnitario = produto?.custo || produto?.custo_unitario || item.custoUnitario || 0;
      existing.custo += item.quantidade * custoUnitario;
      
      produtosMap.set(item.produtoId, existing);
    });
  });

  const topProdutos = Array.from(produtosMap.entries())
    .map(([produtoId, dados]) => ({
      produtoId,
      produtoNome: dados.nome,
      quantidade: dados.quantidade,
      receita: dados.receita,
      custo: dados.custo,
      lucro: dados.receita - dados.custo
    }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 10);

  // Taxas de cartão detalhadas
  const taxasCartaoDetalhadas: RelatorioFinanceiro['taxasCartaoDetalhadas'] = [];
  
  vendasFiltradas.forEach(v => {
    if (v.taxa_cartao_valor && v.taxa_cartao_valor > 0) {
      taxasCartaoDetalhadas.push({
        origem: 'Venda',
        origemId: v.id,
        valor: v.taxa_cartao_valor,
        percentual: v.taxa_cartao_percentual,
        data: v.data
      });
    }
  });

  ordensFiltradas.forEach(o => {
    if (o.taxa_cartao_valor && o.taxa_cartao_valor > 0) {
      taxasCartaoDetalhadas.push({
        origem: 'OS',
        origemId: o.id,
        valor: o.taxa_cartao_valor,
        percentual: o.taxa_cartao_percentual,
        data: o.dataAbertura
      });
    }
  });

  return {
    periodo,
    receitaBruta,
    descontos,
    taxasCartao,
    receitaLiquida,
    custos,
    lucro,
    margem,
    entradas,
    saidas,
    saldo,
    porFormaPagamento,
    vendas: {
      quantidade: vendasFiltradas.length,
      receitaBruta: receitaBrutaVendas,
      receitaLiquida: receitaLiquidaVendas,
      custos: custosVendas,
      lucro: calcLucro(receitaLiquidaVendas, custosVendas)
    },
    ordensServico: {
      quantidade: ordensFiltradas.length,
      receitaBruta: receitaBrutaOS,
      receitaLiquida: receitaLiquidaOS,
      custos: custosOS,
      lucro: calcLucro(receitaLiquidaOS, custosOS)
    },
    topProdutos,
    taxasCartaoDetalhadas
  };
}
