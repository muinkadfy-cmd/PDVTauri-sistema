import { isDesktopApp } from '@/lib/platform';
import { compareVersions } from '@/lib/updates';
import { BUILD_BASE_VERSION, BUILD_VERSION } from '@/config/buildInfo';

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
  source?: 'native' | 'latest-json';
  error?: string | null;
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
  const timeoutRaw = Number(import.meta.env.VITE_DESKTOP_UPDATE_TIMEOUT_MS || 180000);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 180000;

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
  const update = await invoke<DesktopNativeUpdateInfo>('desktop_check_update', { config });
  return { ...update, source: 'native' };
}

type LatestJsonPayload = {
  version?: string;
  notes?: string;
  pub_date?: string;
  url?: string;
  platforms?: Record<string, { signature?: string; url?: string }>;
};

export async function fetchDesktopLatestJsonUpdate(error?: unknown): Promise<DesktopNativeUpdateInfo | null> {
  const config = getDesktopUpdaterConfig();
  if (!config?.endpoints.length) return null;

  const endpoint = config.endpoints[0];
  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}ts=${Date.now()}`;
  const message = error ? String((error as any)?.message || error) : null;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as LatestJsonPayload;
    const version = String(data.version || '').trim();
    if (!version) throw new Error('latest.json sem versão');

    const platform =
      data.platforms?.[config.target || 'windows-x86_64'] ||
      data.platforms?.['windows-x86_64'] ||
      Object.values(data.platforms || {})[0];
    const currentVersion = BUILD_BASE_VERSION || BUILD_VERSION;
    const available = compareVersions(version, currentVersion) > 0;

    return {
      available,
      currentVersion,
      version: available ? version : null,
      body: data.notes || null,
      date: data.pub_date || null,
      target: config.target || 'windows-x86_64',
      downloadUrl: platform?.url || data.url || null,
      source: 'latest-json',
      error: message,
    };
  } catch (fallbackError) {
    return {
      available: false,
      currentVersion: BUILD_BASE_VERSION || BUILD_VERSION,
      version: null,
      body: null,
      date: null,
      target: 'windows-x86_64',
      downloadUrl: null,
      source: 'latest-json',
      error: message || String((fallbackError as any)?.message || fallbackError),
    };
  }
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
