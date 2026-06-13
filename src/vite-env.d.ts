/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Vite flags (normally provided by `vite/client`).
   *
   * This project also declares `ImportMetaEnv` to type custom `VITE_*` vars.
   * In some TS configurations, the original Vite fields can appear missing.
   * Restating them here keeps compatibility and avoids `import.meta.env.DEV`
   * typing errors.
   */
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;

  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DESKTOP_UPDATE_ENDPOINTS?: string;
  readonly VITE_DESKTOP_UPDATE_PUBKEY?: string;
  readonly VITE_DESKTOP_UPDATE_TARGET?: string;
  readonly VITE_DESKTOP_UPDATE_TIMEOUT_MS?: string;
  readonly VITE_DESKTOP_UPDATE_AUTO_PROMPT_ON_STARTUP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (swRegistration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  };
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
