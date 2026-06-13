/**
 * Diagnostics Mode (suporte)
 * - Persistência leve em localStorage
 * - Usado para habilitar coleta extra (perf longtasks, diag-log, etc.)
 * - Default: desligado em produção
 */

import { APP_EVENTS, emitAppEvent } from '@/lib/app-events';

const KEY = 'smart-tech:diagnostics-enabled';

function readBool(v: string | null): boolean {
  if (!v) return false;
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

export function getDiagnosticsEnabled(): boolean {
  try {
    return readBool(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function setDiagnosticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
  try {
    if (enabled) document.documentElement.dataset.diag = '1';
    else delete (document.documentElement.dataset as any).diag;
  } catch {
    // ignore
  }

  // Reaproveita evento existente (consumidores podem atualizar UI/perf)
  try {
    emitAppEvent(APP_EVENTS.PERF_MODE_CHANGED, { diagnostics: enabled });
  } catch {
    // ignore
  }
}

/**
 * Inicializa dataset no HTML no boot.
 * Deve ser chamado cedo (main.tsx).
 */
export function initDiagnosticsMode(): void {
  try {
    const enabled = getDiagnosticsEnabled();
    if (enabled) document.documentElement.dataset.diag = '1';
  } catch {
    // ignore
  }
}
