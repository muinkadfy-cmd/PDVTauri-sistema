/**
 * LocalStore (Patch 9): Camada de abstração para armazenamento local.
 *
 * Antigo: LocalStorage (array inteiro em JSON) → lento e estoura quota.
 * Novo: IndexedDB (Dexie) para dados grandes + cache em memória para leitura síncrona.
 */

import { safeGet, safeSet, safeRemove } from '../storage';
import { logger } from '@/utils/logger';
import { storageKeyMatches } from '@/lib/app-events';
import { getRuntimeStoreId, getRuntimeStoreIdOrDefault } from '@/lib/runtime-context';
import { getLocalDb, makePk, SmartTechRecord } from './idb';
import { notifyRepoChanged } from './repo-broadcast';

export class LocalStore<T extends { id: string }> {
  private storageKey: string;

  // Cache em memória por store (evita JSON.parse a cada repaint)
  private cache: T[] | null = null;
  private cacheStoreId: string | null = null;
  private listenersInstalled = false;
  private preloadPromise: Promise<number> | null = null;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.ensureListeners();
  }

  private getScopeStoreId(): string {
    return getRuntimeStoreId()?.trim() || '';
  }

  private getResolvedScopeStoreId(): string {
    return getRuntimeStoreIdOrDefault();
  }

  private getFallbackSnapshotKey(): string {
    return `${this.storageKey}:fallback-snapshot`;
  }

  private getCompatPingKey(): string {
    return `${this.storageKey}:ping`;
  }

  private readFallbackSnapshot(): T[] {
    const snapshot = safeGet<T[]>(this.getFallbackSnapshotKey(), []);
    if (snapshot.success && Array.isArray(snapshot.data)) {
      return snapshot.data as T[];
    }

    const legacy = safeGet<T[]>(this.storageKey, []);
    if (legacy.success && Array.isArray(legacy.data)) {
      return legacy.data as T[];
    }

    return [];
  }

  private persistFallbackSnapshot(items: T[]): void {
    safeSet(this.getFallbackSnapshotKey(), items);
  }

  private touchCompatPing(ts = Date.now()): void {
    safeSet(this.getCompatPingKey(), ts as any);
  }

  private ensureListeners(): void {
    if (this.listenersInstalled) return;
    this.listenersInstalled = true;

    try {
      // Outras abas: invalida cache quando houver evento `storage`
      window.addEventListener('storage', (e: StorageEvent) => {
        if (storageKeyMatches(e.key, this.storageKey)) {
          this.cache = null;
        }
      });

      // Troca de loja: invalida cache (prefixo muda)
      window.addEventListener('smarttech:store-changed', () => {
        this.cache = null;
        this.cacheStoreId = this.getScopeStoreId();
      });
    } catch {
      // ignore (SSR / ambientes restritos)
    }
  }

  private ensureCacheLoaded(): T[] {
    const scope = this.getScopeStoreId();
    if (this.cache && this.cacheStoreId === scope) {
      return this.cache;
    }

    // Sem cache: inicializa vazio e dispara preload assíncrono.
    // (No boot do app, chamamos preload() para evitar flicker.)
    this.cacheStoreId = scope;
    this.cache = [];
    void this.preload();
    return this.cache;
  }

  /**
   * Preload assíncrono (Patch 9)
   * - Migra LocalStorage → IndexedDB quando necessário
   * - Carrega itens do IndexedDB para cache em memória
   */
  async preload(): Promise<number> {
    const scope = this.getScopeStoreId();
    if (this.cache && this.cacheStoreId === scope && Array.isArray(this.cache) && this.cache.length > 0) {
      return this.cache.length;
    }

    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      try {
        const storeId = this.getResolvedScopeStoreId();
        const db = getLocalDb(storeId);

        // 1) Se IDB está vazia para a tabela e LocalStorage tem dados, migrar.
        const idbCount = await db.records.where('tableKey').equals(this.storageKey).count();
        if (idbCount === 0) {
          const legacy = safeGet<T[]>(this.storageKey, []);
          const legacyList = (legacy.success && Array.isArray(legacy.data) ? legacy.data : []) as T[];
          if (legacyList.length > 0) {
            const rows: SmartTechRecord<T>[] = legacyList
              .filter((it) => it && typeof (it as any).id === 'string' && String((it as any).id).length > 0)
              .map((it) => ({
                pk: makePk(this.storageKey, it.id),
                tableKey: this.storageKey,
                id: it.id,
                value: it,
                updatedAt: Date.now()
              }));

            if (rows.length > 0) {
              await db.records.bulkPut(rows);
              // Limpar LocalStorage para evitar quota.
              safeRemove(this.storageKey);
              if (import.meta.env.DEV) {
                logger.log(`[LocalStore:${this.storageKey}] Migrado LocalStorage → IndexedDB: ${rows.length} itens`);
              }
            }
          }
        }

        // 2) Carregar do IDB para cache em memória.
        const records = await db.records.where('tableKey').equals(this.storageKey).toArray();
        const list = records.map((r) => r.value) as T[];

        this.cacheStoreId = scope;
        this.cache = list;

        // Notificar UI e outras abas.
        try {
          notifyRepoChanged(storeId, this.storageKey);
        } catch {
          // ignore
        }

        return list.length;
      } catch (err) {
        if (import.meta.env.DEV) {
          logger.warn(`[LocalStore:${this.storageKey}] preload falhou, fallback LocalStorage`, err);
        }

        // Fallback: LocalStorage
        const list = this.readFallbackSnapshot();
        this.cacheStoreId = scope;
        this.cache = list;
        return list.length;
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Lista todos os itens (sempre retorna cópia para evitar mutação externa)
   */
  list(): T[] {
    return [...this.ensureCacheLoaded()];
  }

  /**
   * Obtém item por ID
   */
  getById(id: string): T | null {
    const items = this.ensureCacheLoaded();
    return items.find(item => item.id === id) || null;
  }

  /**
   * Insere ou atualiza item
   */
  async upsert(item: T): Promise<T | null> {
    const items = this.ensureCacheLoaded();
    const existingIndex = items.findIndex(i => i.id === item.id);

    if (existingIndex >= 0) {
      items[existingIndex] = item;
    } else {
      items.push(item);
    }

    // Persistir em IndexedDB (preferido)
    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = getLocalDb(storeId);
      await db.records.put({
        pk: makePk(this.storageKey, item.id),
        tableKey: this.storageKey,
        id: item.id,
        value: item,
        updatedAt: Date.now()
      });

      // Notifica outras abas (compatibilidade com listeners de 'storage')
      notifyRepoChanged(storeId, this.storageKey);

      this.persistFallbackSnapshot(items);
      this.touchCompatPing();

      if (import.meta.env.DEV) {
        logger.log(`[LocalStore:${this.storageKey}] Salvo (IDB). Total: ${items.length}`);
      }

      return item;
    } catch (err) {
      // Fallback final: LocalStorage
      const saved = safeSet(this.storageKey, items);
      if (!saved.success) {
        logger.error(`[LocalStore:${this.storageKey}] Erro ao salvar:`, saved.error);
        return null;
      }
      return item;
    }
  }

  
  /**
   * ✅ P6: Upsert em lote (evita várias transações e reduz jank em bases grandes)
   * Retorna quantos itens foram processados.
   */
  async upsertMany(itemsToSave: T[]): Promise<number> {
    if (!itemsToSave?.length) return 0;

    const items = this.ensureCacheLoaded();
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const it of itemsToSave) {
      byId.set(it.id, it);
    }
    this.cache = Array.from(byId.values());

    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = getLocalDb(storeId);
      const now = Date.now();

      await db.transaction('rw', db.records, async () => {
        await db.records.bulkPut(
          itemsToSave.map((it) => ({
            pk: makePk(this.storageKey, it.id),
            tableKey: this.storageKey,
            id: it.id,
            value: it,
            updatedAt: now
          }))
        );
      });

      notifyRepoChanged(storeId, this.storageKey);
      this.persistFallbackSnapshot(this.cache ?? []);
      this.touchCompatPing(now);
      return itemsToSave.length;
    } catch (err) {
      // Fallback final: LocalStorage
      const saved = safeSet(this.storageKey, this.cache ?? []);
      if (!saved.success) {
        logger.error(`[LocalStore:${this.storageKey}] Erro ao salvar lote:`, saved.error);
        return 0;
      }
      return itemsToSave.length;
    }
  }

  /**
   * ✅ P6: Remove em lote
   */
  async removeMany(ids: string[]): Promise<number> {
    if (!ids?.length) return 0;

    const items = this.ensureCacheLoaded();
    const idSet = new Set(ids);
    const next = items.filter((it) => !idSet.has(it.id));
    this.cache = next;

    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = getLocalDb(storeId);
      await db.transaction('rw', db.records, async () => {
        await db.records.bulkDelete(ids.map((id) => makePk(this.storageKey, id)));
      });

      notifyRepoChanged(storeId, this.storageKey);
      this.persistFallbackSnapshot(next);
      this.touchCompatPing();
      return ids.length;
    } catch (err) {
      const saved = safeSet(this.storageKey, next);
      if (!saved.success) {
        logger.error(`[LocalStore:${this.storageKey}] Erro ao remover lote:`, saved.error);
        return 0;
      }
      return ids.length;
    }
  }

/**
   * Remove item por ID
   */
  async remove(id: string): Promise<boolean> {
    const items = this.ensureCacheLoaded();
    const next = items.filter(item => item.id !== id);

    this.cache = next;

    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = getLocalDb(storeId);
      await db.records.delete(makePk(this.storageKey, id));
      notifyRepoChanged(storeId, this.storageKey);
      this.persistFallbackSnapshot(next);
      this.touchCompatPing();
      return true;
    } catch (err) {
      // Fallback: LocalStorage
      const saved = safeSet(this.storageKey, next);
      if (!saved.success) {
        logger.error(`[LocalStore:${this.storageKey}] Erro ao remover:`, saved.error);
        return false;
      }
      return true;
    }
  }

  /**
   * Limpa todos os dados
   */
  async clear(): Promise<boolean> {
    this.cache = [];
    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = getLocalDb(storeId);
      const keys = await db.records.where('tableKey').equals(this.storageKey).primaryKeys();
      await db.records.bulkDelete(keys as string[]);
      notifyRepoChanged(storeId, this.storageKey);
      this.persistFallbackSnapshot([]);
      this.touchCompatPing();
      safeRemove(this.storageKey);
      safeRemove(this.getFallbackSnapshotKey());
      safeRemove(this.getCompatPingKey());
      return true;
    } catch {
      const saved = safeSet(this.storageKey, []);
      if (!saved.success) {
        logger.error(`[LocalStore:${this.storageKey}] Erro ao limpar:`, saved.error);
        return false;
      }
      return true;
    }
  }

  /**
   * Conta itens
   */
  count(): number {
    return this.ensureCacheLoaded().length;
  }
}
