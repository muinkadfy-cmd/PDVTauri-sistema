/**
 * Teste de Persistência de Produtos
 * Valida se produtos persistem após criar, navegar e recarregar
 */

import { criarProduto, getProdutos, deletarProduto } from '../../produtos';
import { produtosRepo } from '../../repositories';
import { logger } from '@/utils/logger';
import { getStoreId } from '@/lib/store-id';

const TEST_MARKER = '[TESTE_PERSIST_PRODUTO]';

export async function testProdutosPersistencia(): Promise<{ name: string; ok: boolean; durationMs: number; details?: string }> {
  const startTime = Date.now();
  
  try {
    // 1. Limpar produtos de teste anteriores
    const produtosExistentes = getProdutos();
    const produtosTeste = produtosExistentes.filter(p => p.nome.includes(TEST_MARKER));
    for (const produto of produtosTeste) {
      await deletarProduto(produto.id);
    }

    // 2. Criar produto de teste
    logger.log('[Teste] Criando produto de teste...');
    const produtoTeste = await criarProduto({
      nome: `${TEST_MARKER} Produto Teste Persistência`,
      preco: 99.99,
      estoque: 10,
      ativo: true,
      descricao: 'Produto criado para teste de persistência'
    });

    if (!produtoTeste) {
      throw new Error('Produto não foi criado');
    }

    const produtoId = produtoTeste.id;

    // 3. Verificar se produto está no LocalStorage
    logger.log('[Teste] Verificando LocalStorage...');
    const produtosAposCriar = produtosRepo.list();
    const produtoNoRepo = produtosAposCriar.find(p => p.id === produtoId);
    
    if (!produtoNoRepo) {
      throw new Error(`Produto ${produtoId} não encontrado no produtosRepo.list() após criar`);
    }

    // 4. Verificar se produto está em getProdutos()
    const produtosGet = getProdutos();
    const produtoNoGet = produtosGet.find(p => p.id === produtoId);
    
    if (!produtoNoGet) {
      throw new Error(`Produto ${produtoId} não encontrado em getProdutos() após criar. Total: ${produtosGet.length}, Repo: ${produtosAposCriar.length}`);
    }

    // 5. Verificar se produto persiste após recarregar do LocalStorage
    logger.log('[Teste] Verificando persistência no LocalStorage...');
    const produtosRepo2 = produtosRepo.list();
    const produtoPersistido = produtosRepo2.find(p => p.id === produtoId);
    
    if (!produtoPersistido) {
      throw new Error(`Produto ${produtoId} não persistiu no LocalStorage`);
    }

    // 6. Verificar campos obrigatórios
    if (!produtoPersistido.nome || !produtoPersistido.nome.trim()) {
      throw new Error('Produto não tem nome válido');
    }
    if (typeof produtoPersistido.preco !== 'number' || produtoPersistido.preco < 0) {
      throw new Error('Produto não tem preço válido');
    }
    if (typeof produtoPersistido.estoque !== 'number') {
      throw new Error('Produto não tem estoque válido');
    }
    if (typeof produtoPersistido.ativo !== 'boolean') {
      throw new Error('Produto não tem ativo válido');
    }

    // 7. Verificar store_id (se configurado)
    const storeId = getStoreId().storeId;
    if (storeId) {
      const produtoStoreId = (produtoPersistido as any).storeId;
      if (produtoStoreId !== storeId) {
        logger.warn(`[Teste] Produto tem store_id diferente: esperado ${storeId}, obtido ${produtoStoreId}`);
      }
    }

    // 8. Limpar produto de teste
    await deletarProduto(produtoId);

    const durationMs = Date.now() - startTime;
    return {
      name: 'Produtos - Persistência',
      ok: true,
      durationMs,
      details: `Produto criado, persistido e validado com sucesso (ID: ${produtoId})`
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    return {
      name: 'Produtos - Persistência',
      ok: false,
      durationMs,
      details: error.message || 'Erro desconhecido'
    };
  }
}
