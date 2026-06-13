// Detecção de plataforma (Web/PWA vs Desktop/Tauri)

// Injetado pelo Vite (vite.config.ts)
declare const __SMARTTECH_DESKTOP__: boolean | undefined;

function isDesktopBuildFlagEnabled(): boolean {
  return typeof __SMARTTECH_DESKTOP__ !== 'undefined' && Boolean(__SMARTTECH_DESKTOP__);
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  // v1/v2 expõem internos diferentes
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

/**
 * true quando o build foi gerado para Desktop (vite --mode desktop)
 * ou quando está rodando dentro do Tauri.
 */
export function isDesktopApp(): boolean {
  return isDesktopBuildFlagEnabled() || isTauriRuntime() || import.meta.env.MODE === 'desktop';
}

/** Ajuda para UI/feature flags */
export function isWebApp(): boolean {
  return !isDesktopApp();
}
