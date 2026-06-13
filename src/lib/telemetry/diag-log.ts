export type DiagLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DiagLogEntry {
  ts: number;           // epoch ms
  level: DiagLogLevel;
  message: string;
  meta?: unknown;
}

const STORAGE_KEY = 'st_diag_logs_v1';
const DESKTOP_KV_KEY = 'smart-tech:diag-log-v2';
const DIAG_KEYS = ['smart-tech:diagnostics-enabled', 'smart-tech-diagnostics-enabled'];
const MAX = 200;

let buf: DiagLogEntry[] = [];
let desktopHydrated = false;
let desktopSaveTimer: ReturnType<typeof setTimeout> | null = null;

function readDiagnosticsFlag(): string | null {
  try {
    for (const key of DIAG_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

function isDiagnosticsEnabled(): boolean {
  try {
    const raw = readDiagnosticsFlag();
    if (raw === null) return import.meta.env.DEV;
    return raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes';
  } catch {
    return import.meta.env.DEV;
  }
}

function shouldPersist(level: DiagLogLevel): boolean {
  // Em produção, persiste apenas warn/error (reduz IO). Debug/info só com diagnóstico ligado.
  return isDiagnosticsEnabled() || level === 'warn' || level === 'error';
}

function sanitizeEntries(input: unknown): DiagLogEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x) => x && typeof (x as any).ts === 'number' && typeof (x as any).level === 'string' && typeof (x as any).message === 'string')
    .slice(-MAX) as DiagLogEntry[];
}

function mergeEntries(current: DiagLogEntry[], incoming: DiagLogEntry[]): DiagLogEntry[] {
  const all = [...current, ...incoming]
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  const dedup = new Map<string, DiagLogEntry>();
  for (const item of all) {
    const key = `${item.ts}:${item.level}:${item.message}`;
    dedup.set(key, item);
  }
  return Array.from(dedup.values()).slice(-MAX);
}

function safeLoadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    buf = mergeEntries(buf, sanitizeEntries(JSON.parse(raw)));
  } catch {
    // ignore
  }
}

function safeSaveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buf.slice(-MAX)));
  } catch {
    // ignore
  }
}

async function safeLoadFromDesktop(): Promise<void> {
  if (desktopHydrated || typeof window === 'undefined') return;
  desktopHydrated = true;
  try {
    const platform = await import('@/lib/platform');
    if (!(platform as any).isDesktopApp?.()) return;

    const kv = await import('@/lib/desktop-kv');
    const raw = await (kv as any).kvGet?.(DESKTOP_KV_KEY);
    if (!raw) return;
    buf = mergeEntries(buf, sanitizeEntries(JSON.parse(raw)));
    safeSaveToStorage();
  } catch {
    // ignore
  }
}

function scheduleDesktopSave() {
  if (typeof window === 'undefined') return;
  if (desktopSaveTimer) clearTimeout(desktopSaveTimer);
  desktopSaveTimer = setTimeout(async () => {
    desktopSaveTimer = null;
    try {
      const platform = await import('@/lib/platform');
      if (!(platform as any).isDesktopApp?.()) return;
      const kv = await import('@/lib/desktop-kv');
      await (kv as any).kvSet?.(DESKTOP_KV_KEY, JSON.stringify(buf.slice(-MAX)));
    } catch {
      // ignore
    }
  }, 250);
}

// Load once at module init (browser only)
if (typeof window !== 'undefined') {
  safeLoadFromStorage();
  void safeLoadFromDesktop();
}

export async function hydrateDiagLogs(): Promise<void> {
  safeLoadFromStorage();
  await safeLoadFromDesktop();
}

export function diagLog(level: DiagLogLevel, message: string, meta?: unknown) {
  const entry: DiagLogEntry = { ts: Date.now(), level, message, ...(meta !== undefined ? { meta } : {}) };
  buf.push(entry);
  if (buf.length > MAX) buf = buf.slice(-MAX);
  if (shouldPersist(level)) {
    safeSaveToStorage();
    scheduleDesktopSave();
  }
}

export function markDiagSession(message: string, meta?: unknown) {
  diagLog('info', `[session] ${message}`, meta);
}

export function getDiagLogs(): DiagLogEntry[] {
  return buf.slice();
}

export async function getDiagLogsAsync(): Promise<DiagLogEntry[]> {
  await hydrateDiagLogs();
  return getDiagLogs();
}

export function clearDiagLogs() {
  buf = [];
  safeSaveToStorage();
  scheduleDesktopSave();
}
