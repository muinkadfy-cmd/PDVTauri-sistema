/**
 * low-end-mode.ts — Modo PC Lento
 * Ativação CSS: html[data-low-end="1"]
 */

import { safeSet } from '@/lib/storage';
import { emitAppEvent, APP_EVENTS } from '@/lib/app-events';

export const STORAGE_KEY_LOW_END = 'smart-tech-low-end-mode';

export function getLowEndMode(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOW_END);
    if (raw === null) return false;
    return raw === 'true' || raw === '1';
  } catch { return false; }
}

export function setLowEndMode(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY_LOW_END, enabled ? 'true' : 'false'); } catch { }
  safeSet(STORAGE_KEY_LOW_END, enabled ? 'true' : 'false');
  applyLowEndMode(enabled);
  emitAppEvent(APP_EVENTS.LOW_END_MODE_CHANGED, { enabled });
}

export function applyLowEndMode(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) {
    root.setAttribute('data-low-end', '1');
    root.setAttribute('data-perf', '1'); // herda ajustes existentes
  } else {
    root.removeAttribute('data-low-end');
    // Mantém data-perf se foi ativado independentemente
    const perfOnly = localStorage.getItem('smart-tech-perf-mode');
    if (perfOnly !== 'true') root.removeAttribute('data-perf');
  }
}

export function detectLowEndHardware(): boolean {
  try {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as any).deviceMemory ?? 4;
    if (cores <= 2 && mem <= 4) return true;
    if (mem <= 2) return true;
    return false;
  } catch { return false; }
}

export function initLowEndMode(): void {
  try {
    if (getLowEndMode()) { applyLowEndMode(true); return; }
    if (detectLowEndHardware()) {
      sessionStorage.setItem('smart-tech-low-end-suggested', 'true');
    }
  } catch { }
}

export function isLowEndModeActive(): boolean {
  return document.documentElement.hasAttribute('data-low-end');
}

export function isLowEndSuggested(): boolean {
  return sessionStorage.getItem('smart-tech-low-end-suggested') === 'true';
}
