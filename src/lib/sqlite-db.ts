/**
 * Compat wrapper para o helper SQLite principal.
 *
 * Mantemos este arquivo para evitar quebrar imports legados, mas a implementação
 * canônica vive em `@/lib/repository/sqlite-db`.
 */

export type {
  SqlDatabase,
  SqliteDbResolution,
} from '@/lib/repository/sqlite-db';

export {
  closeDatabasesForStore,
  getOpenSqliteDatabaseDiagnostics,
  getResolvedSqliteDbMetaForStore,
  getSqliteDbForStore,
} from '@/lib/repository/sqlite-db';
