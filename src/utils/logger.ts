import { isDesktopApp } from '@/lib/platform';
import { diagLog } from '@/lib/telemetry/diag-log';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';

/**
 * Sistema de logging controlado por ambiente
 * Remove logs em produção para melhor performance e segurança
 */

const isDevelopment = import.meta.env.DEV;

function isDiag(): boolean {
  try { return getDiagnosticsEnabled(); } catch { return isDevelopment; }
}

async function tauriLog(level: 'debug' | 'info' | 'warn' | 'error', message: string) {
  if (!isDesktopApp()) return;
  try {
    const mod = await import('@tauri-apps/plugin-log');
    const fn = (mod as any)[level] as ((msg: string) => Promise<void>) | undefined;
    if (typeof fn === 'function') await fn(message);
  } catch {
    // ignore
  }
}

function stringifyArgs(args: any[]): string {
  try {
    return args.map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack || a.message;
      return JSON.stringify(a);
    }).join(' ');
  } catch {
    return String(args?.[0] ?? '');
  }
}

function buildMeta(args: any[]): Record<string, unknown> {
  const firstError = args.find((a) => a instanceof Error) as Error | undefined;
  const meta: Record<string, unknown> = {
    route: typeof location !== 'undefined' ? `${location.pathname}${location.search}${location.hash}` : '',
    href: typeof location !== 'undefined' ? location.href : '',
    desktop: isDesktopApp(),
    diagnostics: isDiag(),
  };

  if (firstError?.stack) {
    meta.stack = String(firstError.stack).slice(0, 4000);
  }

  const serializable = args
    .filter((a) => !(a instanceof Error))
    .map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.parse(JSON.stringify(a)); } catch { return String(a); }
    })
    .slice(0, 3);

  if (serializable.length) {
    meta.args = serializable;
  }

  return meta;
}

/**
 * Logger que só funciona em desenvolvimento
 */
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment || isDiag()) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment || isDiag()) {
      console.warn(...args);
    }
    const message = stringifyArgs(args);
    // No Desktop, também salva em log de arquivo (útil para suporte)
    void tauriLog('warn', message);
    // Buffer local/desktop para suporte (persistência reduzida quando diag desligado)
    try { diagLog('warn', message, buildMeta(args)); } catch {}
  },

  error: (...args: any[]) => {
    // Erros sempre são logados, mesmo em produção
    console.error(...args);
    const message = stringifyArgs(args);
    void tauriLog('error', message);
    try { diagLog('error', message, buildMeta(args)); } catch {}
  },

  info: (...args: any[]) => {
    if (isDevelopment || isDiag()) {
      console.info(...args);
    }
    const message = stringifyArgs(args);
    if (isDiag()) {
      try { diagLog('info', message, buildMeta(args)); } catch {}
    }
    if (isDesktopApp() && isDiag()) {
      void tauriLog('info', message);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment || isDiag()) {
      console.debug(...args);
    }
    const message = stringifyArgs(args);
    if (isDiag()) {
      try { diagLog('debug', message, buildMeta(args)); } catch {}
    }
    if (isDesktopApp() && isDiag()) {
      void tauriLog('debug', message);
    }
  },
};

/**
 * Log condicional baseado em flag de ambiente
 * Útil para logs importantes que devem aparecer mesmo em produção
 */
export function logIf(condition: boolean, level: 'log' | 'warn' | 'error' | 'info' | 'debug', ...args: any[]) {
  if (condition) {
    logger[level](...args);
  }
}
