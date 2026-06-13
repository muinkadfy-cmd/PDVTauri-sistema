import { isDesktopApp } from '@/lib/platform';

const DESKTOP_UPDATE_PENDING_KEY = 'smart-tech:desktop-update-pending';
export const DESKTOP_UPDATE_PENDING_EVENT = 'smarttech:desktop-update-pending-changed';

export type DesktopUpdaterConfig = {
  endpoints: string[];
  pubkey: string;
  target?: string;
  timeoutMs?: number;
};

export type DesktopNativeUpdateInfo = {
  available: boolean;
  currentVersion: string;
  version?: string | null;
  body?: string | null;
  date?: string | null;
  target?: string | null;
  downloadUrl?: string | null;
};

export type DesktopNativeUpdateInstallResult = {
  installed: boolean;
  checked: boolean;
  safetyPrepared?: boolean;
  reason?: 'not_desktop' | 'not_configured' | 'no_update';
  version?: string | null;
};

export type DesktopNativeUpdateInstallOptions = {
  backupBeforeInstall?: boolean;
  checkpointBeforeInstall?: boolean;
};

export type DesktopUpdatePendingState = {
  pending: boolean;
  version?: string | null;
  date?: string | null;
  downloadUrl?: string | null;
  savedAt: string;
};

function emitDesktopUpdatePendingChanged(state: DesktopUpdatePendingState | null): void {
  try {
    window.dispatchEvent(new CustomEvent(DESKTOP_UPDATE_PENDING_EVENT, { detail: state }));
  } catch {
    // ignore
  }
}

export function getDesktopUpdatePendingSync(): DesktopUpdatePendingState | null {
  if (!isDesktopApp()) return null;
  try {
    const raw = localStorage.getItem(DESKTOP_UPDATE_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesktopUpdatePendingState;
    return parsed?.pending ? parsed : null;
  } catch {
    return null;
  }
}

export function isDesktopUpdatePending(): boolean {
  return Boolean(getDesktopUpdatePendingSync()?.pending);
}

export function isDesktopUpdateInstallOnCloseEnabled(): boolean {
  if (!isDesktopApp()) return false;
  const raw = String(import.meta.env.VITE_DESKTOP_UPDATE_INSTALL_ON_CLOSE || '').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

export function setDesktopUpdatePending(update: DesktopNativeUpdateInfo | null): DesktopUpdatePendingState | null {
  if (!isDesktopApp()) return null;

  if (!update?.available) {
    try {
      localStorage.removeItem(DESKTOP_UPDATE_PENDING_KEY);
    } catch {
      // ignore
    }
    emitDesktopUpdatePendingChanged(null);
    return null;
  }

  const state: DesktopUpdatePendingState = {
    pending: true,
    version: update.version || null,
    date: update.date || null,
    downloadUrl: update.downloadUrl || null,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(DESKTOP_UPDATE_PENDING_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  emitDesktopUpdatePendingChanged(state);
  return state;
}

function parseList(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\n,;]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getDesktopUpdaterConfig(): DesktopUpdaterConfig | null {
  if (!isDesktopApp()) return null;

  const endpoints = parseList(import.meta.env.VITE_DESKTOP_UPDATE_ENDPOINTS);
  const pubkey = String(import.meta.env.VITE_DESKTOP_UPDATE_PUBKEY || '').trim();
  const target = String(import.meta.env.VITE_DESKTOP_UPDATE_TARGET || '').trim() || undefined;
  const timeoutRaw = Number(import.meta.env.VITE_DESKTOP_UPDATE_TIMEOUT_MS || 45000);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45000;

  if (!endpoints.length || !pubkey) return null;

  return { endpoints, pubkey, target, timeoutMs };
}

export function isDesktopAutoUpdateConfigured(): boolean {
  return Boolean(getDesktopUpdaterConfig());
}

export async function checkDesktopNativeUpdate(): Promise<DesktopNativeUpdateInfo | null> {
  const config = getDesktopUpdaterConfig();
  if (!config) return null;

  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<DesktopNativeUpdateInfo>('desktop_check_update', { config });
}

export async function prepareDesktopNativeUpdateInstallation(options: DesktopNativeUpdateInstallOptions = {}): Promise<void> {
  if (!isDesktopApp()) return;

  const backupBeforeInstall = options.backupBeforeInstall !== false;
  const checkpointBeforeInstall = options.checkpointBeforeInstall !== false;

  const { flushPendingWrites } = await import('@/lib/persistence-gate');
  await flushPendingWrites(15000);

  if (checkpointBeforeInstall) {
    const { forceSqliteCheckpoint } = await import('@/lib/sqlite-maintenance');
    await forceSqliteCheckpoint('desktop-update-install', 'TRUNCATE');
  }

  if (backupBeforeInstall) {
    const { runBackupBeforeClose } = await import('@/lib/auto-backup');
    await runBackupBeforeClose();
  }
}

export async function installDesktopNativeUpdate(): Promise<void> {
  const config = getDesktopUpdaterConfig();
  if (!config) throw new Error('Auto-update desktop não configurado neste build.');

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('desktop_install_update', { config });
}

export async function installDesktopNativeUpdateWithSafety(options: DesktopNativeUpdateInstallOptions = {}): Promise<void> {
  await prepareDesktopNativeUpdateInstallation(options);
  await installDesktopNativeUpdate();
}

export async function installDesktopNativeUpdateIfAvailable(options: DesktopNativeUpdateInstallOptions = {}): Promise<DesktopNativeUpdateInstallResult> {
  if (!isDesktopApp()) return { installed: false, checked: false, reason: 'not_desktop' };
  if (!isDesktopAutoUpdateConfigured()) return { installed: false, checked: false, reason: 'not_configured' };

  const update = await checkDesktopNativeUpdate();
  if (!update?.available) return { installed: false, checked: true, reason: 'no_update' };

  await installDesktopNativeUpdateWithSafety(options);
  setDesktopUpdatePending(null);
  return { installed: true, checked: true, safetyPrepared: true, version: update.version || null };
}
