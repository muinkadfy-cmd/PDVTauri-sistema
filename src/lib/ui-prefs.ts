import { kvGet, kvRemove, kvSet } from '@/lib/desktop-kv';
import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';

function readLocal(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function toKvKey(key: string): string {
  return `ui_pref:${key}`;
}

export function readUiPrefLocal(key: string, fallback = ''): string {
  return readLocal(key) ?? fallback;
}

export function readUiPrefBoolLocal(key: string, fallback = false): boolean {
  const raw = readLocal(key);
  if (raw == null) return fallback;
  return raw === '1' || raw === 'true';
}

export function readUiPrefNumberLocal(key: string, fallback = 0): number {
  const raw = readLocal(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function hydrateUiPref(key: string): Promise<string | null> {
  const local = readLocal(key);
  if (!isDesktopApp()) return local;

  try {
    const remote = await kvGet(toKvKey(key));

    if (local != null && remote == null) {
      await kvSet(toKvKey(key), local);
      return local;
    }

    if ((local == null || local === '') && remote != null) {
      writeLocal(key, remote);
      return remote;
    }

    return remote ?? local;
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[UiPrefs] Falha ao hidratar ${key}:`, error);
    }
    return local;
  }
}

export async function setUiPref(key: string, value: string | null): Promise<void> {
  writeLocal(key, value);
  if (!isDesktopApp()) return;

  try {
    if (value == null) {
      await kvRemove(toKvKey(key));
    } else {
      await kvSet(toKvKey(key), value);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[UiPrefs] Falha ao persistir ${key}:`, error);
    }
    throw error;
  }
}
