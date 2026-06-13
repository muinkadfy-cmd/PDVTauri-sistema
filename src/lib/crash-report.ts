/**
 * Crash Report Local — 100% Offline (P1-07)
 *
 * Captura erros críticos e os persiste em arquivo de log estruturado
 * em AppData para diagnóstico pelo suporte técnico.
 *
 * Nunca envia dados para internet. Exportável via UI de suporte.
 */

import { logger } from '@/utils/logger';
import { isDesktopApp } from './platform';
import { kvGet, kvSet } from './desktop-kv';

const CRASH_LOG_KEY = 'smart-tech:captured-errors';
const MAX_ENTRIES = 200;

export interface CrashEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'unhandled' | 'rejection';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  appVersion: string;
  userAgent: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
async function readEntries(): Promise<CrashEntry[]> {
  try {
    if (isDesktopApp()) {
      const raw = await kvGet(CRASH_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    const raw = sessionStorage.getItem(CRASH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeEntries(entries: CrashEntry[]): Promise<void> {
  // Manter apenas as N mais recentes
  const trimmed = entries.slice(-MAX_ENTRIES);
  const json = JSON.stringify(trimmed);
  try {
    if (isDesktopApp()) {
      await kvSet(CRASH_LOG_KEY, json);
    } else {
      sessionStorage.setItem(CRASH_LOG_KEY, json);
    }
  } catch { /* ignore — não crashar ao tentar salvar o crash */ }
}

// ─── Captura ──────────────────────────────────────────────────────────────────
async function capture(
  level: CrashEntry['level'],
  message: string,
  extra?: { stack?: string; context?: Record<string, unknown> }
): Promise<void> {
  const entry: CrashEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: String(message).slice(0, 1000),
    stack: extra?.stack?.slice(0, 3000),
    context: extra?.context,
    appVersion: (import.meta.env.VITE_APP_VERSION as string) || '?',
    userAgent: navigator?.userAgent?.slice(0, 200) || '?',
  };

  try {
    const entries = await readEntries();
    entries.push(entry);
    await writeEntries(entries);
  } catch { /* never fail */ }
}

// ─── Export para UI de suporte ────────────────────────────────────────────────
export async function exportCrashLog(): Promise<string> {
  const entries = await readEntries();
  return JSON.stringify(entries, null, 2);
}

export async function clearCrashLog(): Promise<void> {
  await writeEntries([]);
}

export async function getCrashLogCount(): Promise<number> {
  const entries = await readEntries();
  return entries.length;
}

// ─── Inicialização — instalar handlers globais ────────────────────────────────
let _initialized = false;

export function initCrashReport(): void {
  if (_initialized || typeof window === 'undefined') return;
  _initialized = true;

  // Erros síncronos não capturados
  window.addEventListener('error', (ev: ErrorEvent) => {
    void capture('unhandled', ev.message || 'Script error', {
      stack: ev.error?.stack,
      context: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
      },
    });
  });

  // Promises rejeitadas sem .catch()
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
    void capture('rejection', message, {
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // Override console.error para capturar erros de componentes React etc.
  const _originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    _originalError(...args);
    const msg = args
      .map(a => (a instanceof Error ? a.message : String(a ?? '')))
      .join(' ')
      .slice(0, 500);
    if (msg) void capture('error', msg);
  };

  if (import.meta.env.DEV) {
    logger.log('[CrashReport] Inicializado — capturando erros localmente');
  }
}

/**
 * Captura manual de erro com contexto adicional.
 * Usar em try/catch de operações críticas (venda, backup, etc).
 */
export async function reportError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const stack = error instanceof Error ? error.stack : undefined;
  await capture('error', msg, { stack, context });
}
