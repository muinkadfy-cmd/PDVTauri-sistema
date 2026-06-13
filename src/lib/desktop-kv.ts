/**
 * DesktopKV - armazenamento global no SQLite (Tauri).
 * Usado para dados que NÃO podem sumir com limpeza de cache do WebView:
 * - deviceId
 * - token de licença
 */
import { isDesktopApp } from './platform';
import { getSqliteDbForStore } from './repository/sqlite-db';
import { decryptIfNeeded, encryptIfEnabled } from '@/lib/desktop-crypto';

const GLOBAL_DB = '__global__';
const SENSITIVE_KEYS = new Set<string>([
  'license_token',
  'monthly_license_state_v1',
  'smart-tech:captured-errors',
]);


async function getDb() {
  return await getSqliteDbForStore(GLOBAL_DB);
}

export async function kvGet(key: string): Promise<string | null> {
  if (!isDesktopApp()) return null;
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>('SELECT value FROM kv WHERE key = ? LIMIT 1', [key]);
  const v = Array.isArray(rows) && rows.length ? (rows[0] as any).value : null;
    if (typeof v !== 'string') return null;
  if (SENSITIVE_KEYS.has(key)) {
    try {
      return await decryptIfNeeded(v);
    } catch {
      return null;
    }
  }
  return v;
}

export async function kvSet(key: string, value: string): Promise<void> {
  let toSave = value;
  if (SENSITIVE_KEYS.has(key)) {
    try {
      toSave = await encryptIfEnabled(String(value ?? ''));
    } catch {
      toSave = String(value ?? '');
    }
  }
  if (!isDesktopApp()) return;
  const db = await getDb();
  const now = Date.now();
  await db.execute(
    'INSERT INTO kv(key, value, updatedAt) VALUES(?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
    [key, toSave, now]
  );
}

export async function kvRemove(key: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDb();
  await db.execute('DELETE FROM kv WHERE key = ?', [key]);
}


export async function kvGetMany(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const uniq = Array.from(new Set((keys || []).filter(Boolean)));
  if (!uniq.length || !isDesktopApp()) return out;
  await Promise.all(uniq.map(async (key) => {
    try {
      const v = await kvGet(key);
      if (typeof v === 'string') out[key] = v;
    } catch {
      // ignore
    }
  }));
  return out;
}

export async function kvSetMany(values: Record<string, string | null | undefined>): Promise<void> {
  const entries = Object.entries(values || {}).filter(([k, v]) => !!k && v != null);
  if (!entries.length || !isDesktopApp()) return;
  await Promise.all(entries.map(async ([key, value]) => {
    try {
      await kvSet(key, String(value));
    } catch {
      // ignore
    }
  }));
}
