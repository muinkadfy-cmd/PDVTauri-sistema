/**
 * Teste de Persistência de Produtos Após Navegação
 * Valida se produtos persistem após criar, navegar para outra aba e voltar
 */

import { criarProduto, getProdutos, deletarProduto } from '../../produtos';
import { produtosRepo } from '../../repositories';
import { safeGet } from '../../storage';
import { logger } from '@/utils/logger';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

/**
 * Teste que valida persistência após navegação
 * Este teste simula a navegação entre abas verificando se o produto persiste
 */
export async function testProdutosNavegacao(): Promise<void> {
  // 1. Limpar produtos de teste anteriores
  const produtosExistentes = getProdutos();
  const produtosTeste = produtosExistentes.filter(p => p.nome.includes(TEST_MARKER_LOCAL));
  for (const produto of produtosTeste) {
    await deletarProduto(produto.id);
  }

  // 2. Criar produto de teste
  logger.log('[Teste] Criando produto de teste para navegação...');
  const produtoTeste = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Teste Navegação`,
    preco: 149.99,
    estoque: 5,
    ativo: true,
    descricao: 'Produto criado para teste de persistência após navegação'
  });

  if (!produtoTeste || !produtoTeste.id) {
    throw new Error('Produto não foi criado');
  }

  const produtoId = produtoTeste.id;
  const produtoNome = produtoTeste.nome;

  // 3. Verificar se produto está na lista imediatamente após criar
  logger.log('[Teste] Verificando produto após criar...');
  const produtosAposCriar = getProdutos();
  const produtoNoGet = produtosAposCriar.find(p => p.id === produtoId);
  
  if (!produtoNoGet) {
    throw new Error(`Produto ${produtoId} não encontrado em getProdutos() após criar`);
  }

  // 4. Verificar no Repository
  const produtosRepoList = produtosRepo.list();
  const produtoNoRepo = produtosRepoList.find(p => p.id === produtoId);
  
  if (!produtoNoRepo) {
    throw new Error(`Produto ${produtoId} não encontrado no produtosRepo.list() após criar`);
  }

  // 5. Simular "trocar de aba" - recarregar produtos do LocalStorage
  // (Em um teste real, isso seria feito navegando para outra página e voltando)
  logger.log('[Teste] Simulando navegação - recarregando produtos do LocalStorage...');
  
  // Aguardar um pouco para simular tempo de navegação
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Recarregar produtos (simula voltar para a aba de produtos)
  const produtosAposNavegacao = getProdutos();
  const produtoAposNavegacao = produtosAposNavegacao.find(p => p.id === produtoId);
  
  if (!produtoAposNavegacao) {
    throw new Error(`Produto ${produtoId} não encontrado após simular navegação. Total antes: ${produtosAposCriar.length}, Total depois: ${produtosAposNavegacao.length}`);
  }

  // 6. Verificar se os dados do produto estão corretos
  if (produtoAposNavegacao.nome !== produtoNome) {
    throw new Error(`Nome do produto mudou: esperado "${produtoNome}", obtido "${produtoAposNavegacao.nome}"`);
  }

  if (produtoAposNavegacao.preco !== 149.99) {
    throw new Error(`Preço do produto mudou: esperado 149.99, obtido ${produtoAposNavegacao.preco}`);
  }

  if (produtoAposNavegacao.estoque !== 5) {
    throw new Error(`Estoque do produto mudou: esperado 5, obtido ${produtoAposNavegacao.estoque}`);
  }

  // 7. Verificar persistência no LocalStorage diretamente (multi-store)
  logger.log('[Teste] Verificando LocalStorage diretamente (multi-store)...');
  const storage = safeGet<any[]>('products', []);
  const produtosLocalStorage = (storage.success && Array.isArray(storage.data) ? storage.data : []) as any[];

  if (!produtosLocalStorage.length) {
    throw new Error('LocalStorage não contém dados de produtos');
  }

  const produtoNoStorage = produtosLocalStorage.find((p: any) => p.id === produtoId);

  if (!produtoNoStorage) {
    throw new Error(`Produto ${produtoId} não encontrado no LocalStorage`);
  }

  // 8. Verificar se produto persiste após múltiplas leituras
  logger.log('[Teste] Verificando persistência após múltiplas leituras...');
  for (let i = 0; i < 3; i++) {
    const produtosLeitura = getProdutos();
    const produtoLeitura = produtosLeitura.find(p => p.id === produtoId);
    
    if (!produtoLeitura) {
      throw new Error(`Produto ${produtoId} não encontrado na leitura ${i + 1}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // 9. Limpar produto de teste
  await deletarProduto(produtoId);
  
  // Validar que foi deletado
  const produtosFinais = getProdutos();
  const produtoFinal = produtosFinais.find(p => p.id === produtoId);
  if (produtoFinal) {
    throw new Error('Produto ainda existe após deletar');
  }
}
