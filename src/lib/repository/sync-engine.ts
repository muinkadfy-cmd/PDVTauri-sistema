/**
 * Sync Engine (Wrapper leve)
 *
 * ✅ P0 (Desktop/PC fraco):
 * - Evita carregar o motor completo de sync (e SCHEMAS/validações) no bundle inicial do Desktop.
 * - No Desktop / modo local-only: funções viram no-op e retornam resultados vazios.
 * - Em builds web: carrega o core sob demanda.
 */

import { isLocalOnly } from '../mode';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { isDesktopApp } from '@/lib/platform';

type CoreModule = typeof import('./sync-engine-core');

let coreRef: CoreModule | null = null;
let corePromise: Promise<CoreModule> | null = null;

async function loadCore(): Promise<CoreModule | null> {
  if (isDesktopApp() || isLocalOnly()) return null;
  if (coreRef) return coreRef;
  if (!corePromise) {
    corePromise = import('./sync-engine-core').then((m) => {
      coreRef = m;
      return m;
    });
  }
  return corePromise;
}

export function startSyncEngine(intervalMs: number = 30000): void {
  if (isDesktopApp() || isLocalOnly()) return;
  void loadCore().then((m) => m?.startSyncEngine(intervalMs));
}

export function stopSyncEngine(): void {
  if (isDesktopApp() || isLocalOnly()) return;
  void loadCore().then((m) => m?.stopSyncEngine());
}

export async function syncOutbox(): Promise<{ synced: number; errors: number }> {
  const m = await loadCore();
  if (!m) return { synced: 0, errors: 0 };
  return await m.syncOutbox();
}

export async function forceSync(): Promise<{ synced: number; errors: number }> {
  const m = await loadCore();
  if (!m) return { synced: 0, errors: 0 };
  return await m.forceSync();
}

export async function forcePull(): Promise<{ pulled: number; errors: number }> {
  const m = await loadCore();
  if (!m) return { pulled: 0, errors: 0 };
  return await m.forcePull();
}

export function getSyncStatus(): {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
} {
  if (isDesktopApp() || isLocalOnly()) {
    return {
      isOnline: isBrowserOnlineSafe(),
      isSyncing: false,
      pendingCount: 0
    };
  }

  // Se o core já estiver carregado, retorna status real.
  if (coreRef) return coreRef.getSyncStatus();

  // Antes do core carregar: não travar UI.
  return {
    isOnline: isBrowserOnlineSafe(),
    isSyncing: false,
    pendingCount: 0
  };
}
