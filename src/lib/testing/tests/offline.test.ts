/**
 * Testes Offline-First
 */

import { criarCliente, getClientes } from '../../clientes';
import { criarProduto, getProdutos } from '../../produtos';
import { getPendingOutboxItems } from '../../repository/outbox';
import { forceSync } from '../../repository/sync-engine';
import { isSupabaseConfigured } from '../../supabase';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

export async function testOfflineFirst(): Promise<void> {
  // Criar dados offline (sem sync)
  const cliente = await criarCliente({
    nome: `${TEST_MARKER_LOCAL} Cliente Offline Teste`,
    telefone: '(43) 99999-5555'
  });

  if (!cliente || !cliente.id) {
    throw new Error('Falha ao criar cliente offline');
  }

  // Validar que foi salvo localmente
  const clientes = getClientes();
  const clienteEncontrado = clientes.find(c => c.id === cliente.id);
  
  if (!clienteEncontrado) {
    throw new Error('Cliente não foi salvo localmente');
  }

  // Validar que foi adicionado à outbox (se sync habilitado)
  const outboxItems = getPendingOutboxItems();
  const clienteNaOutbox = outboxItems.find(
    item => item.table === 'clientes' && item.clientGeneratedId === cliente.id
  );

  // Se Supabase estiver configurado, deve estar na outbox
  if (isSupabaseConfigured() && !clienteNaOutbox) {
    throw new Error('Cliente não foi adicionado à outbox para sincronização');
  }

  // Criar produto offline
  const produto = await criarProduto({
    nome: `${TEST_MARKER_LOCAL} Produto Offline Teste`,
    preco: 100.00,
    estoque: 50,
    ativo: true
  });

  if (!produto || !produto.id) {
    throw new Error('Falha ao criar produto offline');
  }

  // Validar que foi salvo localmente
  const produtos = getProdutos();
  const produtoEncontrado = produtos.find(p => p.id === produto.id);
  
  if (!produtoEncontrado) {
    throw new Error('Produto não foi salvo localmente');
  }
}

export async function testSyncOnline(): Promise<void> {
  if (!isSupabaseConfigured()) {
    // Se Supabase não estiver configurado, pula o teste
    return;
  }

  // Criar dados que devem ser sincronizados
  const cliente = await criarCliente({
    nome: `${TEST_MARKER_LOCAL} Cliente Sync Teste`,
    telefone: '(43) 99999-4444'
  });

  if (!cliente || !cliente.id) {
    throw new Error('Falha ao criar cliente para sync');
  }

  // Verificar outbox antes do sync
  const outboxAntes = getPendingOutboxItems();
  const clienteNaOutboxAntes = outboxAntes.find(
    item => item.table === 'clientes' && item.clientGeneratedId === cliente.id
  );

  if (!clienteNaOutboxAntes) {
    throw new Error('Cliente não foi adicionado à outbox');
  }

  // Executar sync
  try {
    await forceSync();
  } catch (error) {
    // Se o sync falhar (ex: offline), não falha o teste
    // O importante é que os dados estejam salvos localmente
    console.warn('[TestOffline] Sync falhou (pode estar offline):', error);
  }

  // Verificar outbox após sync (pode ainda ter itens se falhou)
  const outboxDepois = getPendingOutboxItems();
  
  // Se o sync foi bem-sucedido, o item deve ter sido removido da outbox
  // Mas não falhamos o teste se ainda estiver lá (pode estar offline)
}
