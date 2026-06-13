/**
 * Testes de sincronização e integridade de estoque
 * Garante que PULL nunca sobrescreve locais com pendência na outbox (estoque não "volta")
 */

import { getUnsyncedIdsForTable } from '../../repository';
import { criarProduto, getProdutoPorId } from '../../produtos';
import { criarVenda } from '../../vendas';
import { criarCliente } from '../../clientes';
import { TEST_MARKER } from '../testData';

/**
 * Garante que registros com pendência na outbox (syncedAt null) são protegidos no merge.
 * Após venda offline, o produto fica na outbox; getUnsyncedIdsForTable deve incluir seu id
 * para que o PULL não sobrescreva o estoque local.
 */
export async function testEstoqueNaoVolta(): Promise<void> {
  const cliente = await criarCliente({
    nome: `${TEST_MARKER} Cliente Sync Estoque`,
    telefone: '(43) 99999-7777'
  });
  if (!cliente?.id) throw new Error('Falha ao criar cliente');

  const produto = await criarProduto({
    nome: `${TEST_MARKER} Produto Sync Estoque`,
    preco: 50,
    custo: 20,
    estoque: 10,
    ativo: true
  });
  if (!produto?.id) throw new Error('Falha ao criar produto');

  const estoqueInicial = produto.estoque;
  const venda = await criarVenda({
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    itens: [
      {
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: 2,
        precoUnitario: produto.preco,
        subtotal: produto.preco * 2,
        custoUnitario: produto.custo || 0,
        custoTotal: (produto.custo || 0) * 2
      }
    ],
    total: 100,
    formaPagamento: 'dinheiro',
    vendedor: `${TEST_MARKER} Vendedor`
  });
  if (!venda?.id) throw new Error('Falha ao criar venda');

  const produtoAposVenda = getProdutoPorId(produto.id);
  if (!produtoAposVenda || produtoAposVenda.estoque !== estoqueInicial - 2) {
    throw new Error(
      `Estoque deveria ser ${estoqueInicial - 2} após venda, obtido ${produtoAposVenda?.estoque}`
    );
  }

  const unsyncedIds: Set<string> = getUnsyncedIdsForTable('produtos');
  if (!unsyncedIds.has(produto.id)) {
    throw new Error(
      `ID do produto (${produto.id}) deveria estar em getUnsyncedIdsForTable('produtos') para o PULL não sobrescrever estoque. Pendentes: ${Array.from(unsyncedIds).join(', ')}`
    );
  }
}

/**
 * Executa testVendasCRUD 10 vezes seguidas para garantir estabilidade (sem estoque voltando).
 */
export async function testVendasCRUDx10(): Promise<void> {
  const { testVendasCRUD } = await import('./vendas.test');
  for (let i = 0; i < 10; i++) {
    await testVendasCRUD();
  }
}
