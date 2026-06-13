import { isDesktopApp } from '@/lib/platform';
import { kvGet, kvSet } from '@/lib/desktop-kv';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';

type CapturedError = {
  at: string;
  source: string;
  message: string;
  stack?: string;
  route?: string;
  href?: string;
  online?: boolean;
  visibility?: string;
  storeId?: string | null;
  sessionId?: string;
};

type DesktopBreadcrumb = {
  at: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  route?: string;
  href?: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
};

const LEGACY_ERRORS_KEY = 'smart-tech:captured-errors';
const ERRORS_KEY = 'smart-tech:desktop-errors-v2';
const BREADCRUMBS_KEY = 'smart-tech:desktop-breadcrumbs-v1';
const MAX_ERRORS = 60;
const MAX_BREADCRUMBS = 250;
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function safeRoute(): string {
  try {
    return `${location.pathname}${location.search}${location.hash}`;
  } catch {
    return '';
  }
}

function safeHref(): string {
  try {
    return location.href;
  } catch {
    return '';
  }
}

function safeStoreId(): string | null {
  try {
    return localStorage.getItem('smarttech:storeId') || localStorage.getItem('active_store_id') || null;
  } catch {
    return null;
  }
}

async function readAllErrors(): Promise<CapturedError[]> {
  try {
    const raw = await kvGet(ERRORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CapturedError[]) : [];
    }
  } catch {
    // ignore
  }

  // Compatibilidade: só migra se o formato bater com o legado do error-capture.
  try {
    const legacy = await kvGet(LEGACY_ERRORS_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return [];
    const looksLikeLegacy = parsed.every((x) => x && typeof x.at === 'string' && typeof x.source === 'string' && typeof x.message === 'string');
    if (!looksLikeLegacy) return [];
    const items = parsed as CapturedError[];
    await kvSet(ERRORS_KEY, JSON.stringify(items.slice(0, MAX_ERRORS)));
    return items.slice(0, MAX_ERRORS);
  } catch {
    return [];
  }
}

async function writeAllErrors(items: CapturedError[]) {
  try {
    await kvSet(ERRORS_KEY, JSON.stringify(items.slice(0, MAX_ERRORS)));
  } catch {
    // ignore
  }
}

async function readAllBreadcrumbs(): Promise<DesktopBreadcrumb[]> {
  try {
    const raw = await kvGet(BREADCRUMBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DesktopBreadcrumb[]) : [];
  } catch {
    return [];
  }
}

async function writeAllBreadcrumbs(items: DesktopBreadcrumb[]) {
  try {
    await kvSet(BREADCRUMBS_KEY, JSON.stringify(items.slice(0, MAX_BREADCRUMBS)));
  } catch {
    // ignore
  }
}

export async function recordDesktopError(err: any, source: string, extra?: Record<string, unknown>) {
  if (!isDesktopApp()) return;
  const message =
    typeof err === 'string' ? err :
    err?.message ? String(err.message) :
    err?.reason ? String(err.reason) :
    'Erro desconhecido';

  const stack =
    typeof err?.stack === 'string' ? err.stack :
    typeof err?.error?.stack === 'string' ? err.error.stack :
    typeof extra?.stack === 'string' ? String(extra.stack) :
    undefined;

  const item: CapturedError = {
    at: new Date().toISOString(),
    source,
    message,
    stack,
    route: safeRoute(),
    href: safeHref(),
    online: isBrowserOnlineSafe(),
    visibility: typeof document !== 'undefined' ? document.visibilityState : undefined,
    storeId: safeStoreId(),
    sessionId,
  };

  const items = await readAllErrors();
  items.unshift(item);
  await writeAllErrors(items);

  await recordDesktopBreadcrumb(source, message, {
    level: 'error',
    stack: stack ? String(stack).slice(0, 1500) : undefined,
    ...extra,
  });
}

export async function recordDesktopBreadcrumb(
  source: string,
  message: string,
  meta?: Record<string, unknown> & { level?: 'info' | 'warn' | 'error' }
) {
  if (!isDesktopApp()) return;

  const items = await readAllBreadcrumbs();
  items.unshift({
    at: new Date().toISOString(),
    source,
    message: String(message).slice(0, 500),
    level: meta?.level || 'info',
    route: safeRoute(),
    href: safeHref(),
    sessionId,
    meta: meta ? Object.fromEntries(Object.entries(meta).filter(([k, v]) => k !== 'level' && v !== undefined).slice(0, 8)) : undefined,
  });
  await writeAllBreadcrumbs(items);
}

export async function getDesktopErrors(): Promise<CapturedError[]> {
  return await readAllErrors();
}

export async function getDesktopBreadcrumbs(): Promise<DesktopBreadcrumb[]> {
  return await readAllBreadcrumbs();
}

export async function getDesktopCaptureStats(): Promise<{ errors: number; breadcrumbs: number }> {
  const [errors, breadcrumbs] = await Promise.all([readAllErrors(), readAllBreadcrumbs()]);
  return { errors: errors.length, breadcrumbs: breadcrumbs.length };
}

function installRouteTracking() {
  if (typeof window === 'undefined') return;
  const patch = (method: 'pushState' | 'replaceState') => {
    const original = window.history[method];
    if (typeof original !== 'function') return;
    window.history[method] = function (...args: any[]) {
      const result = Reflect.apply(original, window.history, args as any[]);
      void recordDesktopBreadcrumb(`history.${method}`, safeRoute(), { level: 'info' });
      return result;
    } as typeof window.history[typeof method];
  };
  patch('pushState');
  patch('replaceState');
  window.addEventListener('popstate', () => {
    void recordDesktopBreadcrumb('history.popstate', safeRoute(), { level: 'info' });
  });
}

let installed = false;

export function installDesktopErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  if (!isDesktopApp()) return;
  installed = true;

  void recordDesktopBreadcrumb('session.start', 'Sessão Desktop iniciada', {
    level: 'info',
    route: safeRoute(),
    storeId: safeStoreId(),
  });

  window.addEventListener('error', (ev) => {
    void recordDesktopError(ev?.error || ev?.message, 'window.error', {
      filename: (ev as ErrorEvent)?.filename,
      lineno: (ev as ErrorEvent)?.lineno,
      colno: (ev as ErrorEvent)?.colno,
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    void recordDesktopError((ev as any)?.reason, 'unhandledrejection');
  });

  window.addEventListener('online', () => {
    void recordDesktopBreadcrumb('network.online', 'Conexão restaurada', { level: 'info' });
  });

  window.addEventListener('offline', () => {
    void recordDesktopBreadcrumb('network.offline', 'App ficou offline', { level: 'warn' });
  });

  document.addEventListener('visibilitychange', () => {
    void recordDesktopBreadcrumb('document.visibilitychange', `visibility=${document.visibilityState}`, {
      level: document.visibilityState === 'hidden' ? 'warn' : 'info',
    });
  });

  window.addEventListener('beforeunload', () => {
    void recordDesktopBreadcrumb('window.beforeunload', 'Janela/Desktop prestes a fechar', { level: 'warn' });
  });

  installRouteTracking();
}
