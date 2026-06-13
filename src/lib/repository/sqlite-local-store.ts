/**
 * SqliteLocalStore: implementação de LocalStore para Desktop (Tauri + SQLite).
 *
 * Objetivo: manter a mesma API do LocalStore (Dexie) para reaproveitar 100% do app.
 *
 * Persistência:
 * - Tabela `records` (pk, tableKey, id, value JSON, updatedAt)
 * - Um arquivo de DB por storeId (smarttech-<store>.db)
 */

import { safeGet, safeRemove, safeSet } from '../storage';
import { logger } from '@/utils/logger';
import { storageKeyMatches } from '@/lib/app-events';
import { getRuntimeStoreId, getRuntimeStoreIdOrDefault } from '@/lib/runtime-context';
import { isDesktopApp } from '@/lib/platform';
import { getSqliteDbForStore, getResolvedSqliteDbMetaForStore } from './sqlite-db';
import { decryptIfNeeded, encryptIfEnabled, isEncryptedString } from '@/lib/desktop-crypto';
import { beginWrite, endWrite } from '@/lib/persistence-gate';

export class SqliteLocalStore<T extends { id: string }> {
  private storageKey: string;

  // Cache em memória por store
  private cache: T[] | null = null;
  private cacheStoreId: string | null = null;
  private cacheRevision = 0;
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


  private emitDesktopWriteFailure(op: string, error: unknown, extra?: Record<string, unknown>): void {
    const message = `[SqliteLocalStore:${this.storageKey}] ${op} falhou no SQLite desktop: ${String((error as any)?.message || error)}`;
    logger.error(message, error);

    try {
      (window as any).__smarttechSqliteError = message;
      (window as any).__smarttechDbCorrupted = true;
    } catch { /* ignore */ }

    try {
      window.dispatchEvent(new CustomEvent('smarttech:sqlite-write-failed', {
        detail: { tableKey: this.storageKey, op, ...extra, error: message }
      }));
    } catch { /* ignore */ }
  }

  private ensureListeners(): void {
    if (this.listenersInstalled) return;
    this.listenersInstalled = true;

    try {
      // Mantém compatibilidade: invalida cache se rolar "ping" no localStorage
      window.addEventListener('storage', (e: StorageEvent) => {
        if (storageKeyMatches(e.key, this.storageKey)) {
          this.cache = null;
        }
      });

      window.addEventListener('smarttech:store-changed', () => {
        this.cache = null;
        this.cacheStoreId = this.getScopeStoreId();
      });
    } catch {
      // ignore
    }
  }

  private ensureCacheLoaded(): T[] {
    const scope = this.getScopeStoreId();
    if (this.cache && this.cacheStoreId === scope) {
      return this.cache;
    }
    this.cacheStoreId = scope;
    this.cache = [];
    void this.preload();
    return this.cache;
  }

  private makePk(id: string): string {
    return `${this.storageKey}::${id}`;
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

    // Compatibilidade com builds antigos que usavam a própria chave principal.
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

  private shouldTrace(): boolean {
    return new Set([
      'clientes',
      'produtos',
      'vendas',
      'ordens_servico',
      'financeiro',
      'usados',
      'usados_vendas',
    ]).has(this.storageKey);
  }

  private async trace(op: string, extra?: Record<string, unknown>): Promise<void> {
    if (!this.shouldTrace()) return;
    try {
      const storeId = this.getResolvedScopeStoreId();
      const dbMeta = isDesktopApp() ? await getResolvedSqliteDbMetaForStore(storeId).catch(() => null) : null;
      logger.warn(`[P0-10][SqliteLocalStore] ${op}`, {
        storageKey: this.storageKey,
        storeId,
        tableKey: this.storageKey,
        cacheCount: Array.isArray(this.cache) ? this.cache.length : null,
        dbFile: dbMeta?.fileName ?? null,
        dbPath: dbMeta?.resolvedPath ?? null,
        dbPickedFrom: dbMeta?.pickedFrom ?? null,
        ...(extra || {}),
      });
    } catch {
      // ignore
    }
  }


private applyPreloadResult(scope: string, list: T[], revAtStart: number): void {
  // Se a loja mudou enquanto carregava, não sobrescreve o cache do novo escopo
  const currentScope = this.getScopeStoreId();
  if (currentScope !== scope) return;

  // Se houve escrita enquanto o preload rodava, faz merge (prioriza cache em memória)
  if (this.cache && this.cacheStoreId === scope && this.cacheRevision !== revAtStart) {
    const map = new Map<string, T>();
    for (const it of this.cache) map.set(it.id, it);
    for (const it of list) if (!map.has(it.id)) map.set(it.id, it);
    this.cache = Array.from(map.values());
    this.cacheStoreId = scope;
    return;
  }

  this.cacheStoreId = scope;
  this.cache = list;
}


  async preload(): Promise<number> {
    if (!isDesktopApp()) {
      // Segurança: se por algum motivo for chamado no Web, cai no LocalStorage
      const result = safeGet<T[]>(this.storageKey, []);
      const list = (result.success && Array.isArray(result.data) ? result.data : []) as T[];
      this.cacheStoreId = this.getScopeStoreId();
      this.cache = list;
      return list.length;
    }

    const scope = this.getScopeStoreId();
    if (this.cache && this.cacheStoreId === scope && Array.isArray(this.cache)) {
      return this.cache.length;
    }

    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      const revAtStart = this.cacheRevision;
      const scopeAtStart = scope;
      try {
        const storeId = this.getResolvedScopeStoreId();
        const db = await getSqliteDbForStore(storeId);

        // Se SQLite está vazia e existe legado no LocalStorage, importar uma vez.
        // (No Desktop isso normalmente será vazio, mas é um fallback seguro.)
        const countRows = (await db.select(
          'SELECT COUNT(1) as c FROM records WHERE tableKey = ?',
          [this.storageKey]
        )) as Array<{ c: number }>;
        const count = Array.isArray(countRows) ? (countRows[0]?.c ?? 0) : 0;

        if (count === 0) {
          const legacy = safeGet<T[]>(this.storageKey, []);
          const legacyList = (legacy.success && Array.isArray(legacy.data) ? legacy.data : []) as T[];
          if (legacyList.length > 0) {
            // ✅ P0-02 FIX: Migração atômica com BEGIN/COMMIT/ROLLBACK
            // Crash no meio NÃO deixa dados parcialmente migrados.
            let txActive = false;
            try {
              await db.execute('BEGIN TRANSACTION');
              txActive = true;

              const nowMs = Date.now();
              for (const it of legacyList) {
                if (!it || typeof (it as any).id !== 'string') continue;
                const valueJson = await encryptIfEnabled(JSON.stringify(it));
                await db.execute(
                  'INSERT INTO records (pk, tableKey, id, value, updatedAt) VALUES ($1, $2, $3, $4, $5)\n' +
                    'ON CONFLICT(pk) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
                  [this.makePk(it.id), this.storageKey, it.id, valueJson, nowMs]
                );
              }

              await db.execute('COMMIT');
              txActive = false;

              safeRemove(this.storageKey);
              if (import.meta.env.DEV) {
                logger.log(`[SqliteLocalStore:${this.storageKey}] Migração atômica concluída: ${legacyList.length} itens`);
              }
            } catch (migrationErr) {
              // ROLLBACK garante que nenhum dado parcial fica no banco
              if (txActive) {
                try { await db.execute('ROLLBACK'); } catch { /* ignore */ }
              }
              logger.error(`[SqliteLocalStore:${this.storageKey}] Migração falhou — ROLLBACK executado:`, migrationErr);
              // Dados originais do LocalStorage permanecem intactos para próxima tentativa
              throw migrationErr;
            }
          }
        }

        // Carregar SQLite → cache
        const rows = (await db.select(
          'SELECT value FROM records WHERE tableKey = ? ORDER BY updatedAt ASC',
          [this.storageKey]
        )) as Array<{ value: string }>;

const list: T[] = [];
let encryptedRows = 0;
let decryptFailures = 0;

for (const r of (rows || [])) {
  const raw = (r as any)?.value;
  if (typeof raw !== 'string') continue;

  let json = raw;
  if (isEncryptedString(raw)) {
    encryptedRows++;
    try {
      json = await decryptIfNeeded(raw);
    } catch (e) {
      decryptFailures++;
      continue;
    }
  }

  try {
    const obj = JSON.parse(json) as T;
    if (obj && typeof (obj as any).id === 'string') list.push(obj);
  } catch {
    // ignore
  }
}

// ✅ P0: Se TODOS os registros criptografados falharam ao descriptografar,
// o app “parece que zerou”, mas o DB está lá — só ficou ilegível (crypto.key mudou/perdeu).
const severeDecryptFailure =
  encryptedRows > 0 &&
  decryptFailures === encryptedRows &&
  list.length === 0 &&
  Array.isArray(rows) &&
  rows.length > 0;

if (severeDecryptFailure) {
  const msg =
    `[SqliteLocalStore:${this.storageKey}] Falha ao descriptografar ${decryptFailures}/${encryptedRows} registros. ` +
    `Isso normalmente indica crypto.key perdido/trocado (ou ACL bloqueando leitura).`;

  logger.error(msg);

  try {
    (window as any).__smarttechDbCorrupted = true;
    (window as any).__smarttechSqliteError = msg;
  } catch { /* ignore */ }

  try {
    window.dispatchEvent(new CustomEvent('smarttech:sqlite-failed', { detail: { tableKey: this.storageKey, error: msg } }));
  } catch { /* ignore */ }

  this.applyPreloadResult(scopeAtStart, list, revAtStart);
  return list.length;
}

this.applyPreloadResult(scopeAtStart, list, revAtStart);

        // ✅ P2: Sinalizar que o SQLite está pronto para o SqliteLoadingGuard
        try {
          (window as any).__smarttechDbCorrupted = false;
          (window as any).__smarttechSqliteError = null;
        } catch { /* ignore */ }
        try {
          window.dispatchEvent(new CustomEvent('smarttech:sqlite-ready', { detail: { tableKey: this.storageKey } }));
        } catch { /* ignore */ }

        return list.length;
      } catch (err) {
        if (import.meta.env.DEV) {
          logger.warn(`[SqliteLocalStore:${this.storageKey}] preload falhou, fallback LocalStorage`, err);
        }
        // Notificar guard que este store falhou.
        // P9: se for Desktop, sinaliza erro de banco para fluxo de recuperação.
        try {
          (window as any).__smarttechSqliteError = String((err as any)?.message || err || 'Falha ao inicializar SQLite');
          (window as any).__smarttechDbCorrupted = true;
        } catch { /* ignore */ }
        try {
          window.dispatchEvent(new CustomEvent('smarttech:sqlite-failed', { detail: { tableKey: this.storageKey, error: String((err as any)?.message || err || '') } }));
        } catch { /* ignore */ }
        void this.trace('preload_fallback', { error: String((err as any)?.message || err || '') });
        const list = this.readFallbackSnapshot();
        this.applyPreloadResult(scopeAtStart, list, revAtStart);
        return list.length;
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  list(): T[] {
    return [...this.ensureCacheLoaded()];
  }

  getById(id: string): T | null {
    const items = this.ensureCacheLoaded();
    return items.find((item) => item.id === id) || null;
  }

  async upsert(item: T): Promise<T | null> {
    if (this.preloadPromise) {
      try { await this.preloadPromise; } catch { /* ignore */ }
    }
    this.cacheRevision++;
    const previous = [...this.ensureCacheLoaded()];
    const next = [...previous];
    const existingIndex = next.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) next[existingIndex] = item;
    else next.push(item);
    this.cache = next;

    if (!isDesktopApp()) {
      const saved = safeSet(this.storageKey, next);
      return saved.success ? item : null;
    }

    beginWrite(`${this.storageKey}:upsert`);
    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = await getSqliteDbForStore(storeId);
      await db.execute(
        'INSERT INTO records (pk, tableKey, id, value, updatedAt) VALUES ($1, $2, $3, $4, $5)\n' +
          'ON CONFLICT(pk) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
        [this.makePk(item.id), this.storageKey, item.id, await encryptIfEnabled(JSON.stringify(item)), Date.now()]
      );

      this.persistFallbackSnapshot(next);
      this.touchCompatPing();
      void this.trace('upsert', { itemId: item.id });

      return item;
    } catch (err) {
      this.cache = previous;
      void this.trace('upsert_failed', { itemId: item.id, error: String(err) });
      this.emitDesktopWriteFailure('upsert', err, { itemId: item.id });
      return null;
    } finally {
      endWrite(`${this.storageKey}:upsert`);
    }
  }


  /**
   * ✅ P6: Upsert em lote com transação (SQLite)
   * Reduz locks e fsyncs (muito mais rápido em HD/PC fraco).
   */
  async upsertMany(itemsToSave: T[]): Promise<number> {
    if (!itemsToSave?.length) return 0;

    if (this.preloadPromise) {
      try { await this.preloadPromise; } catch { /* ignore */ }
    }
    this.cacheRevision++;

    // Merge no cache (memória) primeiro para leitura síncrona imediata
    const previous = [...this.ensureCacheLoaded()];
    const map = new Map(previous.map((i) => [i.id, i]));
    for (const it of itemsToSave) map.set(it.id, it);
    const next = Array.from(map.values());
    this.cache = next;

    if (!isDesktopApp()) {
      const saved = safeSet(this.storageKey, next);
      return saved.success ? itemsToSave.length : 0;
    }

    const storeId = this.getResolvedScopeStoreId();
    const db = await getSqliteDbForStore(storeId);
    const now = Date.now();

    beginWrite(`${this.storageKey}:upsertMany`);
    try {
      await db.execute('BEGIN IMMEDIATE');
      for (const it of itemsToSave) {
        await db.execute(
          'INSERT INTO records (pk, tableKey, id, value, updatedAt) VALUES ($1, $2, $3, $4, $5)\n' +
            'ON CONFLICT(pk) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
          [this.makePk(it.id), this.storageKey, it.id, await encryptIfEnabled(JSON.stringify(it)), now]
        );
      }
      await db.execute('COMMIT');
      this.persistFallbackSnapshot(next);
      this.touchCompatPing(now);
      void this.trace('upsert_many', { count: itemsToSave.length });
      return itemsToSave.length;
    } catch (err) {
      void this.trace('upsert_many_failed', { count: itemsToSave.length, error: String(err) });
      try { await db.execute('ROLLBACK'); } catch { /* ignore */ }
      this.cache = previous;
      this.emitDesktopWriteFailure('upsertMany', err, { count: itemsToSave.length });
      return 0;
    } finally {
      endWrite(`${this.storageKey}:upsertMany`);
    }
  }

  /**
   * ✅ P6: Remove em lote com transação (SQLite)
   */
  async removeMany(ids: string[]): Promise<number> {
    if (!ids?.length) return 0;

    if (this.preloadPromise) {
      try { await this.preloadPromise; } catch { /* ignore */ }
    }
    this.cacheRevision++;

    const previous = [...this.ensureCacheLoaded()];
    const idSet = new Set(ids);
    const next = previous.filter((it) => !idSet.has(it.id));
    this.cache = next;

    if (!isDesktopApp()) {
      const saved = safeSet(this.storageKey, next);
      return saved.success ? ids.length : 0;
    }

    const storeId = this.getResolvedScopeStoreId();
    const db = await getSqliteDbForStore(storeId);

    beginWrite(`${this.storageKey}:removeMany`);
    try {
      await db.execute('BEGIN IMMEDIATE');
      for (const id of ids) {
        await db.execute('DELETE FROM records WHERE pk = $1', [this.makePk(id)]);
      }
      await db.execute('COMMIT');
      this.persistFallbackSnapshot(next);
      this.touchCompatPing();
      void this.trace('remove_many', { count: ids.length });
      return ids.length;
    } catch (err) {
      void this.trace('remove_many_failed', { count: ids.length, error: String(err) });
      try { await db.execute('ROLLBACK'); } catch { /* ignore */ }
      this.cache = previous;
      this.emitDesktopWriteFailure('removeMany', err, { count: ids.length });
      return 0;
    } finally {
      endWrite(`${this.storageKey}:removeMany`);
    }
  }

  async remove(id: string): Promise<boolean> {
    if (this.preloadPromise) {
      try { await this.preloadPromise; } catch { /* ignore */ }
    }
    this.cacheRevision++;
    const previous = [...this.ensureCacheLoaded()];
    const next = previous.filter((item) => item.id !== id);
    this.cache = next;

    if (!isDesktopApp()) {
      const saved = safeSet(this.storageKey, next);
      return saved.success;
    }

    beginWrite(`${this.storageKey}:remove`);
    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = await getSqliteDbForStore(storeId);
      await db.execute('DELETE FROM records WHERE pk = $1', [this.makePk(id)]);
      this.persistFallbackSnapshot(next);
      this.touchCompatPing();
      void this.trace('remove', { itemId: id });
      return true;
    } catch (err) {
      this.cache = previous;
      void this.trace('remove_failed', { itemId: id, error: String(err) });
      this.emitDesktopWriteFailure('remove', err, { itemId: id });
      return false;
    } finally {
      endWrite(`${this.storageKey}:remove`);
    }
  }

  async clear(): Promise<boolean> {
    if (this.preloadPromise) {
      try { await this.preloadPromise; } catch { /* ignore */ }
    }
    this.cacheRevision++;
    const previous = [...this.ensureCacheLoaded()];
    this.cache = [];

    if (!isDesktopApp()) {
      const saved = safeSet(this.storageKey, []);
      return saved.success;
    }

    beginWrite(`${this.storageKey}:clear`);
    try {
      const storeId = this.getResolvedScopeStoreId();
      const db = await getSqliteDbForStore(storeId);
      await db.execute('DELETE FROM records WHERE tableKey = ?', [this.storageKey]);
      this.persistFallbackSnapshot([]);
      this.touchCompatPing();
      safeRemove(this.storageKey);
      safeRemove(this.getFallbackSnapshotKey());
      safeRemove(this.getCompatPingKey());
      void this.trace('clear');
      return true;
    } catch (err) {
      this.cache = previous;
      void this.trace('clear_failed', { error: String(err) });
      this.emitDesktopWriteFailure('clear', err);
      return false;
    } finally {
      endWrite(`${this.storageKey}:clear`);
    }
  }

  count(): number {
    return this.ensureCacheLoaded().length;
  }
}
