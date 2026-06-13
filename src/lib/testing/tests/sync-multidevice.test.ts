/**
 * Teste de Sincronização Multi-Device
 * Valida se dados criados em um dispositivo aparecem no outro
 */

import { criarProduto, getProdutos, deletarProduto } from '../../produtos';
import { criarCliente, getClientes, deletarCliente } from '../../clientes';
import { produtosRepo, clientesRepo } from '../../repositories';
import { forceSync, forcePull } from '../../repository';
import { logger } from '@/utils/logger';
import { TEST_MARKER } from '../testData';
import { getStoreId } from '@/lib/store-id';

const TEST_MARKER_LOCAL = TEST_MARKER;

/**
 * Teste que valida sincronização entre dispositivos
 * IMPORTANTE: Este teste assume que ambos os dispositivos têm o MESMO store_id
 * ou nenhum store_id configurado
 */
export async function testSyncMultiDevice(): Promise<void> {
  const storeId = getStoreId().storeId;
  
  logger.log('[Teste] Iniciando teste de sincronização multi-device...', {
    storeId: storeId || 'não configurado'
  });

  // 1. Limpar dados de teste anteriores
  const produtosExistentes = getProdutos();
  const produtosTeste = produtosExistentes.filter(p => p.nome.includes(TEST_MARKER_LOCAL));
  for (const produto of produtosTeste) {
    await deletarProduto(produto.id);
  }

  const clientesExistentes = getClientes();
  const clientesTeste = clientesExistentes.filter(c => c.nome.includes(TEST_MARKER_LOCAL));
  for (const cliente of clientesTeste) {
    await deletarCliente(cliente.id);
  }

  // 2. Criar produto de teste localmente
  logger.log('[Teste] Criando produto de teste localmente...');
  const produtoTeste = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Teste Sync`,
    preco: 199.99,
    estoque: 15,
    ativo: true,
    descricao: 'Produto criado para teste de sincronização multi-device'
  });

  if (!produtoTeste || !produtoTeste.id) {
    throw new Error('Produto não foi criado');
  }

  const produtoId = produtoTeste.id;

  // 3. Verificar que produto está local
  const produtosLocal = produtosRepo.list();
  const produtoLocal = produtosLocal.find(p => p.id === produtoId);
  
  if (!produtoLocal) {
    throw new Error(`Produto ${produtoId} não encontrado localmente após criar`);
  }

  // 4. Forçar sync (push para Supabase)
  logger.log('[Teste] Forçando sync (push para Supabase)...');
  const pushResult = await forceSync();
  
  if (pushResult.errors > 0) {
    logger.warn('[Teste] Erros ao fazer push:', pushResult.errors);
  }

  // 5. Aguardar um pouco para garantir que dados foram salvos no Supabase
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 6. Simular "outro dispositivo" - fazer pull do Supabase
  logger.log('[Teste] Simulando pull do outro dispositivo...');
  const pullResult = await forcePull();
  
  if (pullResult.errors > 0) {
    logger.warn('[Teste] Erros ao fazer pull:', pullResult.errors);
  }

  // 7. Verificar se produto aparece após pull (simula outro dispositivo)
  const produtosAposPull = produtosRepo.list();
  const produtoAposPull = produtosAposPull.find(p => p.id === produtoId);
  
  if (!produtoAposPull) {
    throw new Error(`Produto ${produtoId} não encontrado após pull. Total local: ${produtosLocal.length}, Total após pull: ${produtosAposPull.length}`);
  }

  // 8. Verificar se dados estão corretos
  if (produtoAposPull.nome !== produtoTeste.nome) {
    throw new Error(`Nome do produto mudou após pull: esperado "${produtoTeste.nome}", obtido "${produtoAposPull.nome}"`);
  }

  if (produtoAposPull.preco !== 199.99) {
    throw new Error(`Preço do produto mudou após pull: esperado 199.99, obtido ${produtoAposPull.preco}`);
  }

  // 9. Teste com cliente também
  logger.log('[Teste] Criando cliente de teste localmente...');
  const clienteTeste = await criarCliente({
    nome: `${TEST_MARKER_LOCAL} Cliente Teste Sync`,
    telefone: '43999999999'
  });

  if (!clienteTeste || !clienteTeste.id) {
    throw new Error('Cliente não foi criado');
  }

  const clienteId = clienteTeste.id;

  // 10. Forçar sync do cliente
  await forceSync();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 11. Fazer pull e verificar cliente
  await forcePull();
  const clientesAposPull = clientesRepo.list();
  const clienteAposPull = clientesAposPull.find(c => c.id === clienteId);
  
  if (!clienteAposPull) {
    throw new Error(`Cliente ${clienteId} não encontrado após pull`);
  }

  // 12. Limpar dados de teste
  await deletarProduto(produtoId);
  await deletarCliente(clienteId);

  // Validar que foram deletados
  const produtosFinais = getProdutos();
  const produtoFinal = produtosFinais.find(p => p.id === produtoId);
  if (produtoFinal) {
    throw new Error('Produto ainda existe após deletar');
  }

  const clientesFinais = getClientes();
  const clienteFinal = clientesFinais.find(c => c.id === clienteId);
  if (clienteFinal) {
    throw new Error('Cliente ainda existe após deletar');
  }

  logger.log('[Teste] ✅ Teste de sincronização multi-device passou!', {
    produtoId,
    clienteId,
    storeId: storeId || 'não configurado'
  });
}
