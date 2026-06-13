/**
 * Testes de Vendas
 */

import { Venda, FormaPagamento, StatusPagamento } from '@/types';
import { criarVenda, getVendas, deletarVenda, getVendaPorId } from '../../vendas';
import { criarCliente } from '../../clientes';
import { criarProduto, getProdutoPorId } from '../../produtos';
import { 
  calcTotalBrutoVenda, 
  calcTaxaCartao, 
  calcTotalLiquido,
  normalizarVenda
} from '../../finance/calc';
import { getMovimentacoes } from '../../data';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

export async function testVendasCRUD(): Promise<void> {
  // Criar cliente e produtos para a venda
  const cliente = await criarCliente({
    nome: `${TEST_MARKER_LOCAL} Cliente Venda Teste`,
    telefone: '(43) 99999-6666'
  });

  if (!cliente || !cliente.id) {
    throw new Error('Falha ao criar cliente para venda');
  }

  const produto1 = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Venda 1`,
    preco: 100.00,
    custo: 50.00,
    estoque: 100,
    ativo: true
  });

  const produto2 = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Venda 2`,
    preco: 200.00,
    custo: 100.00,
    estoque: 50,
    ativo: true
  });

  if (!produto1 || !produto1.id || !produto2 || !produto2.id) {
    throw new Error('Falha ao criar produtos para venda');
  }

  const estoqueInicial1 = produto1.estoque;
  const estoqueInicial2 = produto2.estoque;

  // Criar venda com 2 itens
  const novaVenda = await criarVenda({
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    itens: [
      {
        produtoId: produto1.id,
        produtoNome: produto1.nome,
        quantidade: 2,
        precoUnitario: produto1.preco,
        subtotal: produto1.preco * 2,
        custoUnitario: produto1.custo || 0,
        custoTotal: (produto1.custo || 0) * 2
      },
      {
        produtoId: produto2.id,
        produtoNome: produto2.nome,
        quantidade: 1,
        precoUnitario: produto2.preco,
        subtotal: produto2.preco * 1,
        custoUnitario: produto2.custo || 0,
        custoTotal: (produto2.custo || 0) * 1
      }
    ],
    total: 400.00, // 2 * 100 + 1 * 200
    formaPagamento: 'dinheiro' as FormaPagamento,
    vendedor: `${TEST_MARKER_LOCAL} Vendedor Teste`
  });

  if (!novaVenda || !novaVenda.id) {
    throw new Error('Falha ao criar venda');
  }

  const vendaId = novaVenda.id;

  // Validar total bruto
  const totalBrutoEsperado = calcTotalBrutoVenda(novaVenda.itens);
  if (novaVenda.total !== totalBrutoEsperado) {
    throw new Error(`Total bruto incorreto: esperado ${totalBrutoEsperado}, obtido ${novaVenda.total}`);
  }

  // Validar atualização de estoque
  const produto1Atualizado = getProdutoPorId(produto1.id);
  const produto2Atualizado = getProdutoPorId(produto2.id);

  if (!produto1Atualizado || produto1Atualizado.estoque !== estoqueInicial1 - 2) {
    throw new Error(`Estoque do produto 1 não foi atualizado: esperado ${estoqueInicial1 - 2}, obtido ${produto1Atualizado?.estoque}`);
  }

  if (!produto2Atualizado || produto2Atualizado.estoque !== estoqueInicial2 - 1) {
    throw new Error(`Estoque do produto 2 não foi atualizado: esperado ${estoqueInicial2 - 1}, obtido ${produto2Atualizado?.estoque}`);
  }

  // Testar venda com cartão e taxa
  const vendaCartao = await criarVenda({
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    itens: [
      {
        produtoId: produto1.id,
        produtoNome: produto1.nome,
        quantidade: 1,
        precoUnitario: produto1.preco,
        subtotal: produto1.preco,
        custoUnitario: produto1.custo || 0,
        custoTotal: produto1.custo || 0
      }
    ],
    total: 100.00,
    desconto: 5.00,
    taxa_cartao_percentual: 3.5,
    formaPagamento: 'cartao' as FormaPagamento,
    status_pagamento: 'pago' as StatusPagamento,
    vendedor: `${TEST_MARKER_LOCAL} Vendedor Teste`
  });

  if (!vendaCartao || !vendaCartao.id) {
    throw new Error('Falha ao criar venda com cartão');
  }

  // Validar cálculo de taxa (taxa é calculada sobre total - desconto)
  const totalAposDesconto = vendaCartao.total - (vendaCartao.desconto || 0);
  const taxaEsperada = calcTaxaCartao(totalAposDesconto, vendaCartao.taxa_cartao_percentual);
  if (Math.abs((vendaCartao.taxa_cartao_valor || 0) - taxaEsperada) > 0.01) {
    throw new Error(`Taxa de cartão incorreta: esperado ${taxaEsperada}, obtido ${vendaCartao.taxa_cartao_valor}`);
  }

  // Validar total líquido
  const vendaNormalizada = normalizarVenda(vendaCartao);
  const totalLiquidoEsperado = calcTotalLiquido(
    vendaNormalizada.total_bruto || vendaNormalizada.total,
    vendaNormalizada.desconto || 0,
    vendaNormalizada.taxa_cartao_valor || 0
  );

  if (vendaNormalizada.total_liquido !== totalLiquidoEsperado) {
    throw new Error(`Total líquido incorreto: esperado ${totalLiquidoEsperado}, obtido ${vendaNormalizada.total_liquido}`);
  }

  // Validar lançamentos financeiros (entrada + saída taxa)
  const movimentacoes = getMovimentacoes();
  const lancamentosVenda = movimentacoes.filter(
    m => m.origem_id === vendaCartao.id && m.origem_tipo === 'venda'
  );

  // Deve ter pelo menos entrada (pode ter saída de taxa também)
  if (lancamentosVenda.length === 0) {
    throw new Error('Nenhum lançamento financeiro criado para venda paga');
  }

  // Excluir vendas
  await deletarVenda(vendaId);
  await deletarVenda(vendaCartao.id);

  // Validar exclusão
  const vendaRemovida = getVendaPorId(vendaId);
  if (vendaRemovida) {
    throw new Error('Venda ainda existe após exclusão');
  }
}
