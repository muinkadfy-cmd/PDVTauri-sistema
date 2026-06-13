/**
 * Testes de Produtos
 */

import { Produto } from '@/types';
import { criarProduto, getProdutos, atualizarProduto, deletarProduto, getProdutoPorId } from '../../produtos';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

export async function testProdutosCRUD(): Promise<void> {
  // Criar produto
  const novoProduto = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Teste CRUD`,
    preco: 150.00,
    custo: 75.00,
    estoque: 50,
    categoria: 'Teste',
    ativo: true
  });

  if (!novoProduto || !novoProduto.id) {
    throw new Error('Falha ao criar produto');
  }

  const produtoId = novoProduto.id;

  // Listar e validar criação
  const produtos = getProdutos();
  const produtoEncontrado = produtos.find(p => p.id === produtoId);
  
  if (!produtoEncontrado) {
    throw new Error('Produto não encontrado após criação');
  }

  if (produtoEncontrado.preco !== 150.00) {
    throw new Error(`Preço do produto incorreto: ${produtoEncontrado.preco}`);
  }

  if (produtoEncontrado.estoque !== 50) {
    throw new Error(`Estoque do produto incorreto: ${produtoEncontrado.estoque}`);
  }

  // Editar produto (estoque e preço)
  const produtoAtualizado = await atualizarProduto(produtoId, {
    preco: 175.00,
    estoque: 75
  });

  if (!produtoAtualizado) {
    throw new Error('Falha ao atualizar produto');
  }

  if (produtoAtualizado.preco !== 175.00) {
    throw new Error(`Preço não foi atualizado: ${produtoAtualizado.preco}`);
  }

  if (produtoAtualizado.estoque !== 75) {
    throw new Error(`Estoque não foi atualizado: ${produtoAtualizado.estoque}`);
  }

  // Validar atualização
  const produtoVerificado = getProdutoPorId(produtoId);
  if (!produtoVerificado || produtoVerificado.preco !== 175.00) {
    throw new Error('Produto não foi atualizado corretamente');
  }

  // Excluir produto
  const deletado = await deletarProduto(produtoId);
  if (!deletado) {
    throw new Error('Falha ao deletar produto');
  }

  // Validar exclusão
  const produtoRemovido = getProdutoPorId(produtoId);
  if (produtoRemovido) {
    throw new Error('Produto ainda existe após exclusão');
  }
}

/**
 * Teste de regressão: Produto criado deve persistir após navegação
 * Este teste valida o bug: "produto criado some quando saio da aba"
 */
export async function testProdutoPersistencia(): Promise<void> {
  // Criar produto
  const novoProduto = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Teste Persistência`,
    preco: 99.99,
    estoque: 10,
    ativo: true
  });

  if (!novoProduto || !novoProduto.id) {
    throw new Error('Falha ao criar produto');
  }

  const produtoId = novoProduto.id;
  const produtoNome = novoProduto.nome;

  // Validar que produto foi salvo imediatamente
  const produtosAposCriacao = getProdutos();
  const produtoEncontradoAposCriacao = produtosAposCriacao.find(p => p.id === produtoId);
  
  if (!produtoEncontradoAposCriacao) {
    throw new Error('Produto não encontrado imediatamente após criação');
  }

  // Simular "sair da aba" - recarregar produtos do repositório
  // (simula o que acontece quando o componente remonta)
  const produtosRecarregados = getProdutos();
  const produtoEncontradoRecarregado = produtosRecarregados.find(p => p.id === produtoId);
  
  if (!produtoEncontradoRecarregado) {
    throw new Error('Produto desapareceu após recarregar (BUG DE PERSISTÊNCIA)');
  }

  if (produtoEncontradoRecarregado.nome !== produtoNome) {
    throw new Error(`Nome do produto mudou após recarregar: ${produtoEncontradoRecarregado.nome} !== ${produtoNome}`);
  }

  // Validar que produto persiste após múltiplas leituras
  for (let i = 0; i < 3; i++) {
    const produtos = getProdutos();
    const produto = produtos.find(p => p.id === produtoId);
    
    if (!produto) {
      throw new Error(`Produto desapareceu na leitura ${i + 1} (BUG DE PERSISTÊNCIA)`);
    }
  }

  // Limpar: deletar produto de teste
  await deletarProduto(produtoId);
  
  // Validar que foi deletado
  const produtoFinal = getProdutoPorId(produtoId);
  if (produtoFinal) {
    throw new Error('Produto ainda existe após deletar');
  }
}
