/**
 * Outbox Pattern: Fila de operações offline para sincronização
 * Persiste operações pendentes e tenta sincronizar quando online
 */

import { safeGet, safeSet, generateId } from '../storage';
import { isLocalOnly } from '../mode';

import { logger } from '@/utils/logger';
import { APP_EVENTS, emitAppEvent, storageKeyMatches } from '@/lib/app-events';
import { getRuntimeStoreId } from '@/lib/runtime-context';

export type OutboxOperation = 'upsert' | 'delete';

export interface OutboxItem {
  id: string;
  table: string;
  operation: OutboxOperation;
  payload: Record<string, any>;
  clientGeneratedId: string; // ID gerado localmente
  createdAt: string;
  retries: number;
  lastError?: string;
  lastAttempt?: string;
  syncedAt?: string;
}

const OUTBOX_KEY = 'outbox'; // Será prefixado automaticamente com smarttech:${storeId-runtime}:
export const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 30000; // 30 segundos

// Cache leve em memória (evita JSON.parse a cada repaint)
let cache: OutboxItem[] | null = null;
let cacheStoreId: string | null = null;
let listenersInstalled = false;

function getScopeStoreId(): string {
  return getRuntimeStoreId()?.trim() || '';
}

function ensureListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (storageKeyMatches(e.key, OUTBOX_KEY)) {
        cache = null;
      }
    });
    window.addEventListener('smarttech:store-changed', () => {
      cache = null;
      cacheStoreId = getScopeStoreId();
    });
  } catch {
    // ignore
  }
}

function notifyOutboxChanged(): void {
  emitAppEvent(APP_EVENTS.OUTBOX_CHANGED, { ts: Date.now() });
}

function getCachedOutbox(): OutboxItem[] {
  ensureListeners();
  const scope = getScopeStoreId();
  if (cache && cacheStoreId === scope) return cache;
  cacheStoreId = scope;
  const result = safeGet<OutboxItem[]>(OUTBOX_KEY, []);
  cache = (result.success && Array.isArray(result.data) ? result.data : []) as OutboxItem[];
  return cache;
}

function setCachedOutbox(items: OutboxItem[]): void {
  cacheStoreId = getScopeStoreId();
  cache = items;
}


/**
 * Obtém todos os itens da outbox
 */
export function getOutboxItems(): OutboxItem[] {
  if (isLocalOnly()) return [];

  return getCachedOutbox();
}

/**
 * Retorna um Set com os IDs (clientGeneratedId) ainda não sincronizados para uma tabela.
 *
 * Útil para testes e diagnóstico (não altera estado).
 */
export function getUnsyncedIdsForTable(table: string): Set<string> {
  const set = new Set<string>();
  if (!table) return set;
  for (const i of getOutboxItems()) {
    if (i.table === table && !i.syncedAt && i.clientGeneratedId) {
      set.add(String(i.clientGeneratedId));
    }
  }
  return set;
}

/**
 * Salva itens da outbox
 */
export function saveOutboxItems(items: OutboxItem[]): boolean {
  const result = safeSet(OUTBOX_KEY, items);
  if (!result.success) {
    logger.error('[OUTBOX] Erro ao salvar outbox:', result.error);
    return false;
  }
  setCachedOutbox(items);
  notifyOutboxChanged();
  return true;
}

/**
 * Adiciona item à outbox
 */
export function addToOutbox(
  table: string,
  operation: OutboxOperation,
  payload: Record<string, any>,
  clientGeneratedId: string
): OutboxItem {
  const item: OutboxItem = {
    id: generateId(),
    table,
    operation,
    payload,
    clientGeneratedId,
    createdAt: new Date().toISOString(),
    retries: 0
  };

  if (isLocalOnly()) return item;

  // Regra: vendas são enviadas diretamente no fluxo de criação (evita loop de erro 400/429)
  if (table === 'vendas') {
    logger.warn(`[OUTBOX] IGNORANDO sincronização para tabela 'vendas' via outbox (id local: ${clientGeneratedId})`);
    return item;
  }

  const items = getOutboxItems();
  items.push(item);
  saveOutboxItems(items);

  logger.log(`[OUTBOX] Item adicionado: ${operation} ${table} (${clientGeneratedId})`);
  return item;
}

/**
 * Remove item da outbox (após sincronizar com sucesso)
 */
export function removeFromOutbox(itemId: string): boolean {
  const items = getOutboxItems();
  const filtered = items.filter(item => item.id !== itemId);
  
  if (filtered.length === items.length) {
    return false;
  }

  saveOutboxItems(filtered);
  logger.log(`[OUTBOX] Item removido: ${itemId}`);
  return true;
}

/**
 * Marca item como sincronizado
 */
export function markAsSynced(itemId: string): boolean {
  const items = getOutboxItems();
  const item = items.find(i => i.id === itemId);
  
  if (!item) {
    return false;
  }

  item.syncedAt = new Date().toISOString();
  saveOutboxItems(items);
  return true;
}

/**
 * Registra erro e incrementa retries
 */
export function recordOutboxError(itemId: string, error: string): boolean {
  const items = getOutboxItems();
  const item = items.find(i => i.id === itemId);
  
  if (!item) {
    return false;
  }

  item.retries += 1;
  item.lastError = error;
  item.lastAttempt = new Date().toISOString();
  saveOutboxItems(items);
  return true;
}

/**
 * Obtém itens pendentes (não sincronizados e com menos de MAX_RETRIES)
 */
export function getPendingOutboxItems(): OutboxItem[] {
  const items = getOutboxItems();
  return items.filter(item => 
    !item.syncedAt && 
    item.retries < MAX_RETRIES &&
    (!item.lastAttempt || Date.now() - new Date(item.lastAttempt).getTime() > RETRY_DELAY_MS)
  );
}

/**
 * Obtém itens com erro (atingiram MAX_RETRIES)
 */
export function getFailedOutboxItems(): OutboxItem[] {
  const items = getOutboxItems();
  return items.filter(item => !item.syncedAt && item.retries >= MAX_RETRIES);
}

/**
 * Limpa itens sincronizados antigos (mais de 7 dias)
 */
export function cleanSyncedOutboxItems(): number {
  const items = getOutboxItems();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const filtered = items.filter(item => {
    if (!item.syncedAt) {
      return true; // Manter não sincronizados
    }
    const syncedTime = new Date(item.syncedAt).getTime();
    return syncedTime > sevenDaysAgo; // Manter sincronizados recentes
  });

  const removed = items.length - filtered.length;
  if (removed > 0) {
    saveOutboxItems(filtered);
    logger.log(`[OUTBOX] ${removed} itens sincronizados antigos removidos`);
  }

  return removed;
}

/**
 * Limpa apenas erros (não remove os itens, só reseta retries)
 */
export function clearOutboxErrors(): number {
  const items = getOutboxItems();
  let cleared = 0;

  items.forEach(item => {
    if (item.retries >= MAX_RETRIES && item.lastError) {
      item.retries = 0;
      item.lastError = undefined;
      item.lastAttempt = undefined;
      cleared++;
    }
  });

  if (cleared > 0) {
    saveOutboxItems(items);
    logger.log(`[OUTBOX] ${cleared} erros limpos`);
  }

  return cleared;
}

/**
 * Obtém estatísticas da outbox
 */
export function getOutboxStats(): {
  total: number;
  pending: number;
  failed: number;
  synced: number;
} {
  const items = getOutboxItems();
  return {
    total: items.length,
    pending: items.filter(i => !i.syncedAt && i.retries < MAX_RETRIES).length,
    failed: items.filter(i => !i.syncedAt && i.retries >= MAX_RETRIES).length,
    synced: items.filter(i => i.syncedAt).length
  };
}
