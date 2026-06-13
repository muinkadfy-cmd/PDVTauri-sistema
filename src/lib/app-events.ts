/**
 * App Events (leve e sem dependências)
 * - Evita usar 'storage' como barramento global (isso causa reload/skeleton desnecessário)
 * - Ajuda a atualizar componentes na mesma aba sem polling agressivo
 */

export const APP_EVENTS = {
  OUTBOX_CHANGED: 'smart-tech:outbox-changed',
  SYNC_STATUS_CHANGED: 'smart-tech:sync-status-changed',
  SYNC_CONFLICT_DETECTED: 'smart-tech:sync-conflict-detected',
  PINNED_PRODUCTS_CHANGED: 'smart-tech:pinned-products-changed',
  THEME_CHANGED: 'smart-tech:theme-changed',
  PERF_MODE_CHANGED: 'smart-tech:perf-mode-changed',
  LOW_END_MODE_CHANGED: 'smart-tech:low-end-mode-changed',
  UI_SOUNDS_CHANGED: 'smart-tech:ui-sounds-changed',
} as const;

export type AppEventName = typeof APP_EVENTS[keyof typeof APP_EVENTS];

export function emitAppEvent<T = any>(name: AppEventName, detail?: T): void {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    // ignore
  }
}

/**
 * Match de chave de storage considerando prefixo "smarttech:{storeId}:"
 */
export function storageKeyMatches(storageKey: string | null | undefined, rawKey: string): boolean {
  if (!storageKey) return false;
  return (
    storageKey === rawKey ||
    storageKey === `${rawKey}:ping` ||
    storageKey === `${rawKey}:fallback-snapshot` ||
    storageKey.endsWith(`:${rawKey}`) ||
    storageKey.endsWith(`:${rawKey}:ping`) ||
    storageKey.endsWith(`:${rawKey}:fallback-snapshot`)
  );
}
