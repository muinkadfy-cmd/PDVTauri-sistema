/**
 * DataRepository: Camada única de acesso a dados
 * Combina LocalStore (offline) e RemoteStore (online)
 * Implementa padrão offline-first com sincronização automática
 */

import { createLocalStore, type LocalStoreLike } from './local-store-factory';
import { addToOutbox } from './outbox';
import { isReadOnlyMode } from '@/lib/license'; // Versão síncrona (usa cache)
import { logger } from '@/utils/logger';
import { isLocalOnly } from '@/lib/mode';
import { isDesktopApp } from '@/lib/platform';
import { scheduleSqliteCheckpoint } from '@/lib/sqlite-maintenance';
import { getRepositoryRuntimeProfile, resolveRepositoryOptions } from './runtime-profile';
import { APP_EVENTS, emitAppEvent } from '@/lib/app-events';

type RemoteStoreLike<T extends { id: string }> = {
  list(): Promise<{ data: T[] | null; error: any }>;
  upsert(item: T): Promise<{ data: T | null; error: any }>;
  remove(id: string): Promise<{ success: boolean; error: any }>;
};

const SYNC_CONFLICTS_STORAGE_KEY = 'smart-tech:sync-conflicts';
const recentConflictMap = new Map<string, number>();
const CONFLICT_DEDUPE_WINDOW_MS = 60_000;

type SyncConflictRecord = {
  key: string;
  table: string;
  id: string;
  localUpdatedAt: string | null;
  remoteUpdatedAt: string | null;
  detectedAt: string;
};

function persistSyncConflict(record: SyncConflictRecord): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(SYNC_CONFLICTS_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) as SyncConflictRecord[] : [];
    const filtered = current.filter((item) => item.key !== record.key);
    const next = [record, ...filtered].slice(0, 20);
    window.localStorage.setItem(SYNC_CONFLICTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function notifySyncConflict(table: string, id: string, localUpdatedAt?: string | null, remoteUpdatedAt?: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    const key = `${table}:${id}`;
    const now = Date.now();
    const lastTs = recentConflictMap.get(key) ?? 0;
    if (now - lastTs < CONFLICT_DEDUPE_WINDOW_MS) return;
    recentConflictMap.set(key, now);

    const record: SyncConflictRecord = {
      key,
      table,
      id,
      localUpdatedAt: localUpdatedAt ?? null,
      remoteUpdatedAt: remoteUpdatedAt ?? null,
      detectedAt: new Date(now).toISOString(),
    };
    persistSyncConflict(record);
    emitAppEvent(APP_EVENTS.SYNC_CONFLICT_DETECTED, record);
  } catch {
    // ignore
  }
}

export interface RepositoryOptions {
  enableSync?: boolean; // Se false, apenas LocalStorage
  syncImmediately?: boolean; // Se true, tenta sync imediato quando online
}

export class DataRepository<T extends { id: string }> {
  private localStore: LocalStoreLike<T>;
  private remoteStore: RemoteStoreLike<T> | null = null;
  private remoteStorePromise: Promise<RemoteStoreLike<T> | null> | null = null;
  private tableName: string;
  private options: Required<RepositoryOptions>;

  constructor(
    tableName: string,
    storageKey: string,
    options: RepositoryOptions = {}
  ) {
    this.tableName = tableName;
    this.localStore = createLocalStore<T>(storageKey);
    this.options = resolveRepositoryOptions(options);

    // Modo 100% local: desabilita qualquer tentativa de sincronização/remote automaticamente
    if (isLocalOnly()) {
      this.options.enableSync = false;
      this.options.syncImmediately = false;
    }
  }


private async getRemoteStore(): Promise<RemoteStoreLike<T> | null> {
  // Desktop build é 100% local — nunca carregar RemoteStore/Supabase.
  const runtime = getRepositoryRuntimeProfile();
  if (isDesktopApp() || runtime.isDesktop) return null;

  // Se sync estiver desabilitado (ou modo local-only), não existe remoto.
  if (!this.options.enableSync || runtime.isLocalOnly) return null;

  if (this.remoteStore) return this.remoteStore;
  if (this.remoteStorePromise) return this.remoteStorePromise;

  this.remoteStorePromise = (async () => {
    try {
      const mod = await import('./remote-store');
      const store = new mod.RemoteStore<T>(this.tableName);
      this.remoteStore = store as unknown as RemoteStoreLike<T>;
      return this.remoteStore;
    } catch (e) {
      logger.warn(`[Repository:${this.tableName}] RemoteStore indisponível (sem sync):`, e);
      return null;
    } finally {
      this.remoteStorePromise = null;
    }
  })();

  return this.remoteStorePromise;
}

  /**
   * Lista todos os itens (sempre do LocalStorage)
   */
  list(): T[] {
    return this.localStore.list();
  }

  /**
   * Lista todos os itens aguardando o preload do storage.
   * Útil no Desktop/SQLite para evitar [] no 1º render.
   */
  async listAsync(): Promise<T[]> {
    try {
      await this.localStore.preload();
    } catch {
      // ignore
    }
    return this.localStore.list();
  }

  /**
   * Obtém item por ID (sempre do LocalStorage)
   */
  getById(id: string): T | null {
    return this.localStore.getById(id);
  }

  /**
   * Insere ou atualiza item (offline-first)
   */
  async upsert(item: T): Promise<T | null> {
    // Verificar modo leitura (licença expirada)
    if (isReadOnlyMode()) {
      logger.warn(`[Repository:${this.tableName}] Tentativa de escrita em modo leitura bloqueada`);
      throw new Error('Sistema em modo leitura. Licença expirada. Renove a licença para continuar.');
    }

    // 1. Sempre salva localmente primeiro
    const saved = await this.localStore.upsert(item);
    if (!saved) {
      return null;
    }

    // 2. Se sync habilitado, adiciona à outbox
    if (this.options.enableSync && !isLocalOnly()) {
      addToOutbox(this.tableName, 'upsert', item as any, item.id);

      // 3. Se sync imediato e online, tenta sincronizar agora
      if (this.options.syncImmediately) {
        this.syncItem(item.id).catch(err => {
          logger.warn(`[Repository:${this.tableName}] Erro ao sincronizar imediatamente:`, err);
        });
      }
    }

    return saved;
  }

  /**
   * Remove item (offline-first)
   */
  async remove(id: string): Promise<boolean> {
    // Verificar modo leitura (licença expirada)
    if (isReadOnlyMode()) {
      logger.warn(`[Repository:${this.tableName}] Tentativa de exclusão em modo leitura bloqueada`);
      throw new Error('Sistema em modo leitura. Licença expirada. Renove a licença para continuar.');
    }
    const item = this.localStore.getById(id);
    if (!item) {
      return false;
    }

    // 1. Sempre remove localmente primeiro
    const removed = await this.localStore.remove(id);
    if (!removed) {
      return false;
    }

    // 2. Se sync habilitado, adiciona à outbox
    if (this.options.enableSync && !isLocalOnly()) {
      addToOutbox(this.tableName, 'delete', { id } as any, id);

      // 3. Se sync imediato e online, tenta sincronizar agora
      if (this.options.syncImmediately) {
        this.syncDelete(id).catch(err => {
          logger.warn(`[Repository:${this.tableName}] Erro ao sincronizar delete:`, err);
        });
      }
    }

    return removed;
  }

  /**
   * Sincroniza um item específico (usado pelo sync engine)
   */
  async syncItem(id: string): Promise<{ success: boolean; error?: any }> {
    if (getRepositoryRuntimeProfile().isLocalOnly) return { success: true };
    const item = this.localStore.getById(id);
    if (!item) {
      return { success: false, error: { message: 'Item não encontrado localmente' } };
    }

    const remote = await this.getRemoteStore();
    if (!remote) return { success: false, error: { message: 'RemoteStore indisponível' } };

    const result = await remote.upsert(item);
    
    if (result.error) {
      return { success: false, error: result.error };
    }

    // Atualizar timestamps locais se Supabase retornou dados atualizados
    if (result.data) {
      await this.localStore.upsert(result.data);
    }

    return { success: true };
  }

  /**
   * Sincroniza delete específico
   */
  async syncDelete(id: string): Promise<{ success: boolean; error?: any }> {
    if (getRepositoryRuntimeProfile().isLocalOnly) return { success: true };
    const remote = await this.getRemoteStore();
    if (!remote) return { success: false, error: { message: 'RemoteStore indisponível' } };
    const result = await remote.remove(id);
    return result;
  }

  /**
   * Sincroniza todos os itens locais com Supabase
   */
  async syncAll(): Promise<{ synced: number; errors: number }> {
    if (getRepositoryRuntimeProfile().isLocalOnly) return { synced: 0, errors: 0 };
    const items = this.localStore.list();
    let synced = 0;
    let errors = 0;

    for (const item of items) {
      const result = await this.syncItem(item.id);
      if (result.success) {
        synced++;
      } else {
        errors++;
      }
    }

    return { synced, errors };
  }

  /**
   * Escrita local em lote para restore/importação.
   * Não cria outbox item a item e não depende do remoto.
   */
  async restoreMany(items: T[]): Promise<number> {
    if (!items?.length) return 0;

    try {
      const restored = await this.localStore.upsertMany(items);
      if (restored === items.length) return restored;
      logger.warn(
        `[Repository:${this.tableName}] restoreMany parcial em lote (${restored}/${items.length}), aplicando fallback`
      );
    } catch (err) {
      logger.warn(`[Repository:${this.tableName}] restoreMany em lote falhou, aplicando fallback:`, err);
    }

    let restored = 0;
    for (const item of items) {
      try {
        const saved = await this.localStore.upsert(item);
        if (saved) restored++;
      } catch {
        // ignore
      }
    }
    return restored;
  }

  /**
   * Busca itens do Supabase e merge com LocalStorage
   * IMPORTANTE: NUNCA apaga itens locais só porque não vieram no Supabase.
   * Exclusão remota deve vir por tombstone/fluxo explícito, não por inferência.
   */
  async pullFromRemote(): Promise<{ pulled: number; errors: number }> {
    if (getRepositoryRuntimeProfile().isLocalOnly) return { pulled: 0, errors: 0 };
    const remote = await this.getRemoteStore();
    if (!remote) return { pulled: 0, errors: 0 };
    const result = await remote.list();
    
    if (result.error) {
      // Erro PGRST205 = tabela não encontrada no Supabase (não crítico)
      if (result.error.code === 'PGRST205') {
        logger.log(`[Repository:${this.tableName}] Tabela não existe no Supabase, pulando sincronização`);
        return { pulled: 0, errors: 0 };
      }
      logger.error(`[Repository:${this.tableName}] Erro ao fazer pull:`, result.error);
      return { pulled: 0, errors: 1 };
    }

    if (!result.data) {
      logger.warn(`[Repository:${this.tableName}] Nenhum dado retornado do Supabase`);
      return { pulled: 0, errors: 0 };
    }

    // IMPORTANTE: Obter lista local ANTES do merge para verificar itens pendentes
    const localItemsBefore = this.localStore.list();
    const localIds = new Set(localItemsBefore.map(item => item.id));
    
    // Verificar itens na outbox (NÃO sincronizados)
    // ⚠️ CRÍTICO: não use apenas "pendentes para retry".
    // Se a última tentativa foi recente, o item sai de `getPendingOutboxItems()` por 30s,
    // e um pull pode sobrescrever mudanças locais ainda não sincronizadas.
    const { getUnsyncedIdsForTable } = await import('./outbox');
    const pendingIds = getUnsyncedIdsForTable(this.tableName);

    let pulled = 0;
    const toUpsert: T[] = [];

    if (import.meta.env.DEV) {
      logger.log(`[Repository:${this.tableName}] Pull: ${result.data.length} itens recebidos do Supabase, ${localItemsBefore.length} itens locais, ${pendingIds.size} pendentes na outbox`);
    }

    // Merge: Supabase tem prioridade (last-write-wins baseado em updated_at)
    // MAS: itens locais que não estão no Supabase NÃO são apagados (offline-first)
    const remoteIds = new Set<string>();
    
    for (const remoteItem of result.data) {
      remoteIds.add(remoteItem.id);
      const localItem = this.localStore.getById(remoteItem.id);
      
      if (!localItem) {
        // Item novo do Supabase, adiciona localmente
        toUpsert.push(remoteItem);
        pulled++;
        if (import.meta.env.DEV) {
          logger.log(`[Repository:${this.tableName}] Novo item baixado: ${remoteItem.id}`);
        }
      } else {
        // Conflito: comparar updated_at
        const localItemAny = localItem as any;
        const remoteItemAny = remoteItem as any;
        const localUpdated = localItemAny.updated_at ? new Date(localItemAny.updated_at).getTime() : 0;
        const remoteUpdated = remoteItemAny.updated_at ? new Date(remoteItemAny.updated_at).getTime() : 0;

        // Se item está pendente na outbox, NÃO sobrescrever (aguardar sync)
        if (pendingIds.has(remoteItem.id)) {
          if (
            remoteUpdated > 0 &&
            localUpdated > 0 &&
            remoteUpdated !== localUpdated
          ) {
            notifySyncConflict(
              this.tableName,
              remoteItem.id,
              localItemAny.updated_at ?? null,
              remoteItemAny.updated_at ?? null
            );
          }
          if (import.meta.env.DEV) {
            logger.log(`[Repository:${this.tableName}] Item ${remoteItem.id} está pendente na outbox, mantendo versão local`);
          }
          continue;
        }

        if (remoteUpdated >= localUpdated) {
          // Remote é mais recente, atualiza local
          toUpsert.push(remoteItem);
          pulled++;
          if (import.meta.env.DEV) {
            logger.log(`[Repository:${this.tableName}] Item atualizado: ${remoteItem.id}`);
          }
        }
        // Se local é mais recente, mantém local (será enviado na próxima sync)
      }
    }

    // ================================================================
    // RECONCILIAÇÃO DE EXCLUSÕES:
    // Verificar itens locais que não estão no Supabase
    // ================================================================
    const localOnlyIds = Array.from(localIds).filter(id => !remoteIds.has(id));
    if (localOnlyIds.length > 0) {
      if (import.meta.env.DEV) {
        logger.log(`[Repository:${this.tableName}] ${localOnlyIds.length} itens locais não estão no Supabase`);
      }
      
      // Separar em: pendentes na outbox vs órfãos (possivelmente deletados)
      const localOnlyItems = localItemsBefore.filter(item => localOnlyIds.includes(item.id));
      const itemsPendentes = localOnlyItems.filter(item => pendingIds.has(item.id));
      const itemsOrfaos = localOnlyItems.filter(item => !pendingIds.has(item.id));
      
      // CASO 1: Itens pendentes na outbox (aguardando sync)
      if (itemsPendentes.length > 0 && import.meta.env.DEV) {
        logger.log(`[Repository:${this.tableName}] ${itemsPendentes.length} itens pendentes na outbox (aguardando sync)`);
      }
      
      // CASO 2: Itens órfãos (não estão no Supabase e não estão na outbox)
      // Segurança de dados:
      // não remover localmente por ausência na listagem remota.
      // Uma resposta parcial/filtrada/atrasada pode causar falso positivo.
      if (itemsOrfaos.length > 0) {
        logger.warn(
          `[Repository:${this.tableName}] ${itemsOrfaos.length} itens locais ausentes no remoto foram preservados por segurança`
        );

        for (const item of itemsOrfaos) {
          try {
            addToOutbox(this.tableName, 'upsert', item as any, item.id);
          } catch (err) {
            logger.warn(
              `[Repository:${this.tableName}] Falha ao re-enfileirar item órfão ${item.id}:`,
              err
            );
          }
        }
      }
    }

    // ✅ P6: aplica writes em lote (muito mais rápido em SQLite/IDB)
    try {
      if (toUpsert.length > 0) {
        await this.localStore.upsertMany(toUpsert);
      }
    } catch (err) {
      logger.error(`[Repository:${this.tableName}] Erro ao aplicar lote local:`, err);
      // fallback: mantém comportamento anterior (não falhar o pull inteiro)
      for (const it of toUpsert) {
        try { await this.localStore.upsert(it); } catch { /* ignore */ }
      }
    }

    if (pulled > 0) {
      logger.log(`[Repository:${this.tableName}] Pull concluído: ${pulled} itens sincronizados`);
    }

    // P9: Em pulls grandes, agendar checkpoint do WAL (idle) para reduzir locks/arquivo -wal
    const batchSize = toUpsert.length;
    if (isDesktopApp() && batchSize >= 1500) {
      scheduleSqliteCheckpoint(`after-pull:${this.tableName}`);
    }

    return { pulled, errors: 0 };
  }

  /**
   * Limpa todos os dados locais
   */
  async clear(): Promise<boolean> {
    return this.localStore.clear();
  }

  /**
   * Conta total de itens
   */
  count(): number {
    return this.localStore.count();
  }

  /**
   * Patch 9: Preload do storage local (IndexedDB) para cache em memória.
   */
  async preloadLocal(): Promise<number> {
    return this.localStore.preload();
  }
}
