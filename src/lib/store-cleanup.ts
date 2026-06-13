/**
 * Limpeza de dados restantes do store atual
 * Remove todos os dados que pertencem ao store atual ou que não têm store_id
 */

import { logger } from '@/utils/logger';
import { getStoreId } from './store';
import type { DataRepository } from './repository/data-repository';
import {
  clientesRepo,
  produtosRepo,
  vendasRepo,
  ordensRepo,
  financeiroRepo,
  cobrancasRepo,
  devolucoesRepo,
  encomendasRepo,
  recibosRepo,
  codigosRepo
} from './repositories';
import { getOutboxItems, removeFromOutbox } from './repository/outbox';

/**
 * Limpa todos os dados do store atual
 */
export async function clearStoreData(): Promise<{ 
  success: boolean; 
  removed: Record<string, number>;
  error?: string;
}> {
  const storeId = getStoreId();
  const removed: Record<string, number> = {};

  try {
    if (import.meta.env.DEV) {
      logger.log(`[StoreCleanup] Iniciando limpeza de dados do store: ${storeId}`);
    }

    // Limpar cada repositório
    const repos = [
      { name: 'clientes', repo: clientesRepo },
      { name: 'produtos', repo: produtosRepo },
      { name: 'vendas', repo: vendasRepo },
      { name: 'ordens', repo: ordensRepo },
      { name: 'financeiro', repo: financeiroRepo },
      { name: 'cobrancas', repo: cobrancasRepo },
      { name: 'devolucoes', repo: devolucoesRepo },
      { name: 'encomendas', repo: encomendasRepo },
      { name: 'recibos', repo: recibosRepo },
      { name: 'codigos', repo: codigosRepo }
    ];

    for (const { name, repo } of repos) {
      const countBefore = repo.count();
      repo.clear();
      const countAfter = repo.count();
      removed[name] = countBefore - countAfter;
      
      if (import.meta.env.DEV) {
        logger.log(`[StoreCleanup] ${name}: ${removed[name]} itens removidos`);
      }
    }

    // Limpar outbox do store atual
    const outboxItems = getOutboxItems();
    let outboxRemoved = 0;
    for (const item of outboxItems) {
      // Remover itens da outbox que pertencem ao store atual
      // (a outbox já está isolada por store devido ao prefixo de storage)
      removeFromOutbox(item.id);
      outboxRemoved++;
    }
    removed.outbox = outboxRemoved;

    if (import.meta.env.DEV) {
      logger.log(`[StoreCleanup] ✅ Limpeza concluída. Total removido:`, removed);
    }

    return {
      success: true,
      removed
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[StoreCleanup] ❌ Erro ao limpar dados:', error);
    return {
      success: false,
      removed,
      error: errorMsg
    };
  }
}

/**
 * Remove apenas dados que não pertencem ao store atual
 * (dados antigos sem store_id ou com store_id diferente)
 */
export async function removeOrphanedData(): Promise<{
  success: boolean;
  removed: Record<string, number>;
  error?: string;
}> {
  const storeId = getStoreId();
  const removed: Record<string, number> = {};

  try {
    if (import.meta.env.DEV) {
      logger.log(`[StoreCleanup] Removendo dados órfãos (não pertencem ao store: ${storeId})`);
    }

    const repos = [
      { name: 'clientes', repo: clientesRepo },
      { name: 'produtos', repo: produtosRepo },
      { name: 'vendas', repo: vendasRepo },
      { name: 'ordens', repo: ordensRepo },
      { name: 'financeiro', repo: financeiroRepo },
      { name: 'cobrancas', repo: cobrancasRepo },
      { name: 'devolucoes', repo: devolucoesRepo },
      { name: 'encomendas', repo: encomendasRepo },
      { name: 'recibos', repo: recibosRepo },
      { name: 'codigos', repo: codigosRepo }
    ];

    for (const { name, repo } of repos) {
      const items = repo.list();
      let countRemoved = 0;

      for (const item of items) {
        const itemStoreId = (item as any).store_id || (item as any).storeId;
        
        // Remover se não tem store_id ou se tem store_id diferente
        if (!itemStoreId || itemStoreId !== storeId) {
          repo.remove(item.id);
          countRemoved++;
        }
      }

      removed[name] = countRemoved;
      if (import.meta.env.DEV && countRemoved > 0) {
        logger.log(`[StoreCleanup] ${name}: ${countRemoved} itens órfãos removidos`);
      }
    }

    if (import.meta.env.DEV) {
      logger.log(`[StoreCleanup] ✅ Remoção de dados órfãos concluída:`, removed);
    }

    return {
      success: true,
      removed
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[StoreCleanup] ❌ Erro ao remover dados órfãos:', error);
    return {
      success: false,
      removed,
      error: errorMsg
    };
  }
}

const TEST_MARKER_E2E = '[TESTE_E2E]';
const TEST_MARKER_PERSIST = '[TESTE_PERSIST]';

function hasTestMarker(value: unknown, markers: string[]): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return markers.some((m) => s.includes(m));
}

/**
 * Remove dados de teste marcados com [TESTE_E2E] ou [TESTE_PERSIST]
 * Movimentações: descricao ou responsavel; outros: nome/clienteNome conforme entidade
 */
export async function removeTestData(options?: {
  markers?: string[];
}): Promise<{ success: boolean; removed: Record<string, number>; error?: string }> {
  const markers = options?.markers ?? [TEST_MARKER_E2E, TEST_MARKER_PERSIST];
  const removed: Record<string, number> = {};

  try {
    if (import.meta.env.DEV) {
      logger.log('[StoreCleanup] Removendo dados de teste:', markers);
    }

    type RepoConfig = { name: string; repo: DataRepository<{ id: string }>; check: (item: unknown) => boolean };
    const configs: RepoConfig[] = [
      { name: 'clientes', repo: clientesRepo, check: (i) => hasTestMarker((i as { nome?: string }).nome, markers) },
      { name: 'produtos', repo: produtosRepo, check: (i) => hasTestMarker((i as { nome?: string }).nome, markers) },
      {
        name: 'vendas',
        repo: vendasRepo,
        check: (i) =>
          hasTestMarker((i as { clienteNome?: string; vendedor?: string; observacoes?: string }).clienteNome, markers) ||
          hasTestMarker((i as { vendedor?: string }).vendedor, markers) ||
          hasTestMarker((i as { observacoes?: string }).observacoes, markers),
      },
      { name: 'ordens', repo: ordensRepo, check: (i) => hasTestMarker((i as { clienteNome?: string }).clienteNome, markers) },
      {
        name: 'financeiro',
        repo: financeiroRepo,
        check: (i) =>
          hasTestMarker((i as { descricao?: string; responsavel?: string }).descricao, markers) ||
          hasTestMarker((i as { responsavel?: string }).responsavel, markers),
      },
      { name: 'cobrancas', repo: cobrancasRepo, check: (i) => hasTestMarker((i as { clienteNome?: string }).clienteNome, markers) },
      { name: 'devolucoes', repo: devolucoesRepo, check: (i) => hasTestMarker((i as { clienteNome?: string }).clienteNome, markers) },
      { name: 'encomendas', repo: encomendasRepo, check: (i) => hasTestMarker((i as { clienteNome?: string }).clienteNome, markers) },
      { name: 'recibos', repo: recibosRepo, check: (i) => hasTestMarker((i as { clienteNome?: string }).clienteNome, markers) },
      { name: 'codigos', repo: codigosRepo, check: (i) => hasTestMarker((i as { codigo?: string }).codigo, markers) },
    ];

    for (const { name, repo, check } of configs) {
      const items = repo.list();
      let count = 0;
      for (const item of items) {
        if (check(item)) {
          await repo.remove(item.id);
          count++;
        }
      }
      removed[name] = count;
      if (import.meta.env.DEV && count > 0) {
        logger.log(`[StoreCleanup] ${name}: ${count} itens de teste removidos`);
      }
    }

    if (import.meta.env.DEV) {
      logger.log('[StoreCleanup] ✅ Remoção de dados de teste concluída:', removed);
    }

    return { success: true, removed };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[StoreCleanup] ❌ Erro ao remover dados de teste:', error);
    return { success: false, removed, error: errorMsg };
  }
}
