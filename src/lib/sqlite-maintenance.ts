/**
 * SQLite Maintenance (P9)
 * - Faz checkpoint do WAL e optimize de forma throttled (evita travar UI)
 * - Usado após: backup, restore, grandes sincronizações (batch writes)
 *
 * Objetivo (PDV offline): reduzir risco de WAL gigante, diminuir locks e melhorar performance em disco lento.
 */
import { isDesktopApp } from '@/lib/platform';
import { getValidStoreIdOrNull } from '@/lib/store-id';
import { logger } from '@/utils/logger';
import { getSqliteDbForStore } from '@/lib/repository/sqlite-db';

type CheckpointMode = 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE';

let lastRunMs = 0;
let scheduled = false;

/** Intervalo mínimo entre checkpoints (ms). */
const MIN_INTERVAL_MS = 2 * 60 * 1000; // 2 min

function runInIdle(fn: () => void) {
  const ric = (globalThis as any).requestIdleCallback as undefined | ((cb: any, opts?: any) => any);
  if (ric) return ric(fn, { timeout: 1200 });
  return window.setTimeout(fn, 400);
}

async function runCheckpointNow(reason: string, mode: CheckpointMode = 'TRUNCATE'): Promise<void> {
  if (!isDesktopApp()) return;
  const storeId = getValidStoreIdOrNull();
  if (!storeId) return;

  try {
    const db = await getSqliteDbForStore(storeId);

    try { await db.execute(`PRAGMA wal_checkpoint(${mode});`); } catch { /* ignore */ }
    try { await db.execute('PRAGMA optimize;'); } catch { /* ignore */ }

    if (import.meta.env.DEV) logger.log('[SQLiteMaintenance] checkpoint ok:', reason);
  } catch (e) {
    logger.warn('[SQLiteMaintenance] checkpoint falhou:', reason, e);
  }
}

/**
 * Agenda um checkpoint throttled. Seguro chamar várias vezes.
 */
export function scheduleSqliteCheckpoint(reason: string, mode: CheckpointMode = 'TRUNCATE'): void {
  if (!isDesktopApp()) return;

  const now = Date.now();
  if (now - lastRunMs < MIN_INTERVAL_MS) return;
  if (scheduled) return;

  scheduled = true;
  runInIdle(async () => {
    scheduled = false;
    lastRunMs = Date.now();
    await runCheckpointNow(reason, mode);
  });
}

/**
 * Força checkpoint imediato (usar com cuidado).
 * Útil após restore.
 */
export async function forceSqliteCheckpoint(reason: string, mode: CheckpointMode = 'TRUNCATE'): Promise<void> {
  lastRunMs = Date.now();
  await runCheckpointNow(reason, mode);
}
