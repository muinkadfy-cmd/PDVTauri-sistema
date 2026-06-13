import { logger } from '@/utils/logger';
import { logStartupPersistenceSnapshot } from '@/lib/persistence-info';
import { migrateStoreData } from './store-migration';
import { installRepoBroadcastListener } from './repository/repo-broadcast';
import { isLowEndModeActive } from '@/lib/low-end-mode';
import {
  clientesRepo,
  produtosRepo,
  settingsRepo
} from './repositories';


function notifySqliteReadyForDirectRender(error?: unknown): void {
  if (typeof window === 'undefined') return;
  try { (window as any).__smarttechSqliteReady = true; } catch {}
  if (error) {
    try { (window as any).__smarttechSqliteError = String((error as any)?.message || error); } catch {}
  }
  try {
    window.dispatchEvent(new CustomEvent(error ? 'smarttech:sqlite-failed' : 'smarttech:sqlite-ready', {
      detail: {
        source: 'preload-app',
        error: error ? String((error as any)?.message || error) : '',
        directRender: true,
      },
    }));
  } catch {
    // ignore
  }
}

/**
 * Preload local (OFFLINE-FIRST) — otimizado para PC fraco.
 *
 * Regras:
 * - NUNCA bloquear a UI.
 * - Preload "crítico" mínimo: Clientes + Produtos + Settings (termos/tema).
 * - O resto é carregado por rota (ver: route-preload.ts).
 */
export async function preloadAppLocalData(): Promise<void> {
  try {
    // Migração legada (rápida e síncrona)
    migrateStoreData();
  } catch {
    // ignore
  }

  try {
    installRepoBroadcastListener();
  } catch {
    // ignore
  }

  const critical = [settingsRepo, clientesRepo, produtosRepo];

  try { await logStartupPersistenceSnapshot('preload-start'); } catch { /* ignore */ }

  let preloadError: unknown = null;

  try {
    // Em PC fraco, evitar Promise.all (pico de CPU/RAM). Carregar sequencial.
    if (isLowEndModeActive()) {
      for (const r of critical) {
        try { await r.preloadLocal(); } catch (e) { preloadError = preloadError || e; }
      }
    } else {
      const results = await Promise.allSettled(critical.map((r) => r.preloadLocal()));
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (rejected) preloadError = rejected.reason;
    }
  } finally {
    try { await logStartupPersistenceSnapshot('preload-end'); } catch { /* ignore */ }
    notifySqliteReadyForDirectRender(preloadError || undefined);
  }

  if (import.meta.env.DEV) {
    logger.log('[Preload] Cache local carregado (crítico mínimo).');
  }
}
