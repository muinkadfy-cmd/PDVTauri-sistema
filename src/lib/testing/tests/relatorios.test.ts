/**
 * Testes de Relatórios e Cálculos Financeiros
 */

import {
  calcTotalBrutoVenda,
  calcTaxaCartao,
  calcTotalLiquido,
  calcCustoVenda,
  calcLucro,
  calcMargem,
  calcTotalBrutoOS,
  calcCustoOS,
  normalizarVenda,
  normalizarOS
} from '../../finance/calc';
import { Venda, OrdemServico, ItemVenda, Produto } from '@/types';

export async function testCalculosFinanceiros(): Promise<void> {
  // Teste: calcTotalBrutoVenda
  const itens: ItemVenda[] = [
    { produtoId: '1', produtoNome: 'Produto 1', quantidade: 2, precoUnitario: 100, subtotal: 200 },
    { produtoId: '2', produtoNome: 'Produto 2', quantidade: 1, precoUnitario: 150, subtotal: 150 }
  ];

  const totalBruto = calcTotalBrutoVenda(itens);
  if (totalBruto !== 350) {
    throw new Error(`calcTotalBrutoVenda incorreto: esperado 350, obtido ${totalBruto}`);
  }

  // Teste: calcTaxaCartao
  const taxa = calcTaxaCartao(1000, 3.5);
  if (taxa !== 35) {
    throw new Error(`calcTaxaCartao incorreto: esperado 35, obtido ${taxa}`);
  }

  // Teste: calcTotalLiquido
  const totalLiquido = calcTotalLiquido(1000, 50, 35);
  if (totalLiquido !== 915) {
    throw new Error(`calcTotalLiquido incorreto: esperado 915, obtido ${totalLiquido}`);
  }

  // Teste: calcCustoVenda
  const produtos: Produto[] = [
    { id: '1', nome: 'Produto 1', preco: 100, custo: 50, estoque: 10, ativo: true },
    { id: '2', nome: 'Produto 2', preco: 150, custo: 75, estoque: 5, ativo: true }
  ];

  const itensComCusto: ItemVenda[] = [
    { produtoId: '1', produtoNome: 'Produto 1', quantidade: 2, precoUnitario: 100, subtotal: 200, custoUnitario: 50, custoTotal: 100 },
    { produtoId: '2', produtoNome: 'Produto 2', quantidade: 1, precoUnitario: 150, subtotal: 150, custoUnitario: 75, custoTotal: 75 }
  ];

  const custoTotal = calcCustoVenda(itensComCusto, produtos);
  if (custoTotal !== 175) {
    throw new Error(`calcCustoVenda incorreto: esperado 175, obtido ${custoTotal}`);
  }

  // Teste: calcLucro
  const lucro = calcLucro(915, 175);
  if (lucro !== 740) {
    throw new Error(`calcLucro incorreto: esperado 740, obtido ${lucro}`);
  }

  // Teste: calcMargem
  const margem = calcMargem(740, 915);
  if (margem === null || Math.abs(margem - 80.87) > 0.1) {
    throw new Error(`calcMargem incorreto: esperado ~80.87%, obtido ${margem}`);
  }

  // Teste: calcMargem com receita zero (deve retornar null)
  const margemZero = calcMargem(100, 0);
  if (margemZero !== null) {
    throw new Error(`calcMargem com receita zero deve retornar null, obtido ${margemZero}`);
  }

  // Teste: calcTotalBrutoOS
  const totalBrutoOS = calcTotalBrutoOS(200, 300);
  if (totalBrutoOS !== 500) {
    throw new Error(`calcTotalBrutoOS incorreto: esperado 500, obtido ${totalBrutoOS}`);
  }

  // Teste: calcCustoOS
  const custoOS = calcCustoOS(300, 100);
  if (custoOS !== 400) {
    throw new Error(`calcCustoOS incorreto: esperado 400, obtido ${custoOS}`);
  }

  // Teste: normalizarVenda
  const venda: Venda = {
    id: '1',
    itens,
    total: 350,
    formaPagamento: 'cartao',
    vendedor: 'Teste',
    data: new Date().toISOString()
  };

  const vendaNormalizada = normalizarVenda(venda);
  if (!vendaNormalizada.total_bruto || vendaNormalizada.total_bruto !== 350) {
    throw new Error('normalizarVenda não calculou total_bruto corretamente');
  }

  if (vendaNormalizada.total_liquido === undefined) {
    throw new Error('normalizarVenda não calculou total_liquido');
  }

  // Teste: normalizarOS
  const ordem: OrdemServico = {
    id: '1',
    numero: 'OS-0001',
    clienteId: '1',
    clienteNome: 'Cliente Teste',
    equipamento: 'Equipamento',
    defeito: 'Defeito',
    status: 'aberta',
    dataAbertura: new Date().toISOString(),
    valorServico: 200,
    valorPecas: 300
  };

  const ordemNormalizada = normalizarOS(ordem);
  if (!ordemNormalizada.total_bruto || ordemNormalizada.total_bruto !== 500) {
    throw new Error('normalizarOS não calculou total_bruto corretamente');
  }

  if (ordemNormalizada.total_liquido === undefined) {
    throw new Error('normalizarOS não calculou total_liquido');
  }
}

export async function testCalculosComDadosVazios(): Promise<void> {
  // Teste com arrays vazios
  const totalBrutoVazio = calcTotalBrutoVenda([]);
  if (totalBrutoVazio !== 0) {
    throw new Error(`calcTotalBrutoVenda com array vazio deve retornar 0, obtido ${totalBrutoVazio}`);
  }

  // Teste com valores zero
  const totalLiquidoZero = calcTotalLiquido(0, 0, 0);
  if (totalLiquidoZero !== 0) {
    throw new Error(`calcTotalLiquido com valores zero deve retornar 0, obtido ${totalLiquidoZero}`);
  }

  // Teste com taxa zero
  const taxaZero = calcTaxaCartao(1000, 0);
  if (taxaZero !== 0) {
    throw new Error(`calcTaxaCartao com taxa zero deve retornar 0, obtido ${taxaZero}`);
  }
}
