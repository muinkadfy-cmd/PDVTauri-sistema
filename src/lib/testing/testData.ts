/**
 * Utilitários para Dados de Teste - Smart Tech
 * Cria e limpa dados marcados com [TESTE_E2E]
 */

import { Cliente, Produto, Venda, OrdemServico, Movimentacao } from '@/types';
import { criarCliente, getClientes, deletarCliente } from '../clientes';
import { criarProduto, getProdutos, deletarProduto } from '../produtos';
import { criarVenda, getVendas, deletarVenda } from '../vendas';
import { criarOrdem, getOrdens, deletarOrdem } from '../ordens';
import { getMovimentacoes, deleteMovimentacao } from '../data';
import { clientesRepo, produtosRepo, vendasRepo, ordensRepo, financeiroRepo } from '../repositories';
import { isSupabaseConfigured, supabase } from '../supabase';
import { logger } from '@/utils/logger';

export const TEST_MARKER = '[TESTE_E2E]';

/**
 * Identifica se um registro é de teste
 */
export function isTestData(name: string | undefined): boolean {
  return name?.includes(TEST_MARKER) || false;
}

/**
 * Cria dados de exemplo para testes
 */
export async function createTestData(): Promise<{
  cliente: Cliente | null;
  produto1: Produto | null;
  produto2: Produto | null;
}> {
  logger.log('[TestData] Criando dados de exemplo...');

  // Criar cliente de teste
  const cliente = await criarCliente({
    nome: `${TEST_MARKER} Cliente Teste`,
    telefone: '(43) 99999-9999',
    email: 'teste@example.com',
    cidade: 'Rolândia',
    estado: 'PR'
  });

  // Criar produtos de teste
  const produto1 = await criarProduto({
    nome: `${TEST_MARKER} Produto Teste 1`,
    preco: 100.00,
    custo: 50.00,
    estoque: 100,
    categoria: 'Teste',
    ativo: true
  });

  const produto2 = await criarProduto({
    nome: `${TEST_MARKER} Produto Teste 2`,
    preco: 200.00,
    custo: 100.00,
    estoque: 50,
    categoria: 'Teste',
    ativo: true
  });

  logger.log('[TestData] Dados de exemplo criados:', { cliente, produto1, produto2 });

  return { cliente, produto1, produto2 };
}

/**
 * Limpa todos os dados de teste do LocalStorage
 */
export async function cleanupTestDataLocal(): Promise<number> {
  let count = 0;

  try {
    // Limpar clientes
    const clientes = getClientes();
    for (const cliente of clientes) {
      if (isTestData(cliente.nome)) {
        await deletarCliente(cliente.id);
        count++;
      }
    }

    // Limpar produtos
    const produtos = getProdutos();
    for (const produto of produtos) {
      if (isTestData(produto.nome)) {
        await deletarProduto(produto.id);
        count++;
      }
    }

    // Limpar vendas
    const vendas = getVendas();
    for (const venda of vendas) {
      if (isTestData(venda.clienteNome) || isTestData(venda.observacoes)) {
        await deletarVenda(venda.id);
        count++;
      }
    }

    // Limpar OS
    const ordens = getOrdens();
    for (const ordem of ordens) {
      if (isTestData(ordem.clienteNome) || isTestData(ordem.observacoes)) {
        await deletarOrdem(ordem.id);
        count++;
      }
    }

    // Limpar movimentações financeiras
    const movimentacoes = getMovimentacoes();
    for (const mov of movimentacoes) {
      if (isTestData(mov.descricao) || isTestData(mov.responsavel)) {
        await deleteMovimentacao(mov.id);
        count++;
      }
    }

    logger.log(`[TestData] Limpeza local concluída: ${count} registros removidos`);
  } catch (error) {
    logger.error('[TestData] Erro ao limpar dados locais:', error);
  }

  return count;
}

/**
 * Limpa todos os dados de teste do Supabase (se habilitado)
 */
export async function cleanupTestDataRemote(): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) {
    return 0;
  }

  let count = 0;

  try {
    // Importar STORE_ID para filtrar por loja
    const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');
    
    // Limpar clientes (filtrado por store_id)
    let queryClientes = supabase
      .from('clientes')
      .select('id, nome')
      .like('nome', `%${TEST_MARKER}%`);
    
    if (STORE_ID_VALID && STORE_ID) {
      queryClientes = queryClientes.eq('store_id', STORE_ID);
    }
    
    const { data: clientes } = await queryClientes;

    if (clientes && clientes.length > 0) {
      const ids = clientes.map(c => c.id);
      // ✅ CRÍTICO: Adicionar filtro store_id antes de DELETE
      let deleteQuery = supabase.from('clientes').delete();
      if (STORE_ID_VALID && STORE_ID) {
        deleteQuery = deleteQuery.eq('store_id', STORE_ID);
      }
      await deleteQuery.in('id', ids);
      count += ids.length;
    }

    // Limpar produtos (filtrado por store_id)
    let queryProdutos = supabase
      .from('produtos')
      .select('id, nome')
      .like('nome', `%${TEST_MARKER}%`);
    
    if (STORE_ID_VALID && STORE_ID) {
      queryProdutos = queryProdutos.eq('store_id', STORE_ID);
    }
    
    const { data: produtos } = await queryProdutos;

    if (produtos && produtos.length > 0) {
      const ids = produtos.map(p => p.id);
      // ✅ CRÍTICO: Adicionar filtro store_id antes de DELETE
      let deleteQuery = supabase.from('produtos').delete();
      if (STORE_ID_VALID && STORE_ID) {
        deleteQuery = deleteQuery.eq('store_id', STORE_ID);
      }
      await deleteQuery.in('id', ids);
      count += ids.length;
    }

    // Limpar vendas (filtrado por store_id)
    let queryVendas = supabase
      .from('vendas')
      .select('id, cliente_nome, observacoes')
      .or(`cliente_nome.ilike.%${TEST_MARKER}%,observacoes.ilike.%${TEST_MARKER}%`);
    
    if (STORE_ID_VALID && STORE_ID) {
      queryVendas = queryVendas.eq('store_id', STORE_ID);
    }
    
    const { data: vendas } = await queryVendas;

    if (vendas && vendas.length > 0) {
      const ids = vendas.map(v => v.id);
      await supabase.from('vendas').delete().in('id', ids);
      count += ids.length;
    }

    // Limpar OS
    const { data: ordens } = await supabase
      .from('ordens_servico')
      .select('id, cliente_nome, observacoes')
      .or(`cliente_nome.ilike.%${TEST_MARKER}%,observacoes.ilike.%${TEST_MARKER}%`);

    if (ordens && ordens.length > 0) {
      const ids = ordens.map(o => o.id);
      await supabase.from('ordens_servico').delete().in('id', ids);
      count += ids.length;
    }

    // Limpar financeiro
    const { data: financeiro } = await supabase
      .from('financeiro')
      .select('id, descricao, responsavel')
      .or(`descricao.ilike.%${TEST_MARKER}%,responsavel.ilike.%${TEST_MARKER}%`);

    if (financeiro && financeiro.length > 0) {
      const ids = financeiro.map(f => f.id);
      await supabase.from('financeiro').delete().in('id', ids);
      count += ids.length;
    }

    logger.log(`[TestData] Limpeza remota concluída: ${count} registros removidos`);
  } catch (error) {
    logger.error('[TestData] Erro ao limpar dados remotos:', error);
  }

  return count;
}

/**
 * Limpa todos os dados de teste (local + remoto)
 */
export async function cleanupTestData(): Promise<{ local: number; remote: number }> {
  logger.log('[TestData] Iniciando limpeza completa de dados de teste...');

  const [local, remote] = await Promise.all([
    cleanupTestDataLocal(),
    cleanupTestDataRemote()
  ]);

  logger.log(`[TestData] Limpeza completa: ${local} local, ${remote} remoto`);

  return { local, remote };
}
