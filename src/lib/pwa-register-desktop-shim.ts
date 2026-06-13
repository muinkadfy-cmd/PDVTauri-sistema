/**
 * Shim do virtual:pwa-register para build Desktop/Tauri.
 * O Desktop oficial é offline local e não registra Service Worker.
 */
export function registerSW(_options?: unknown): (reloadPage?: boolean) => Promise<void> {
  return async () => undefined;
}
