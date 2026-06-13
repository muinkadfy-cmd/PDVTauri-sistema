/**
 * Repository: Exportações principais
 */

export { DataRepository } from './data-repository';
export { LocalStore } from './local-store';
// ✅ Desktop (offline): não exportar RemoteStore aqui para não puxar Supabase no bundle inicial.
// (RemoteStore é carregado dinamicamente pelo DataRepository em builds não-desktop)
export { SCHEMAS, toSupabaseFormat, fromSupabaseFormat, validateRequiredFields } from './schema-map';
export {
  addToOutbox,
  getOutboxItems,
  getUnsyncedIdsForTable,
  getPendingOutboxItems,
  getFailedOutboxItems,
  removeFromOutbox,
  markAsSynced,
  recordOutboxError,
  cleanSyncedOutboxItems,
  clearOutboxErrors,
  getOutboxStats,
  type OutboxItem,
  type OutboxOperation
} from './outbox';
export {
  startSyncEngine,
  stopSyncEngine,
  syncOutbox,
  forceSync,
  forcePull,
  getSyncStatus
} from './sync-engine';
