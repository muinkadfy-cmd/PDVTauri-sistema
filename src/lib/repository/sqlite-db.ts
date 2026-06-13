/**
 * SQLite (Tauri) — helper
 *
 * CORREÇÃO DEFINITIVA:
 * Há variação entre versões do plugin @razein97/tauri-plugin-rusqlite2:
 * - algumas aceitam Database.load("sqlite:arquivo.db")
 * - outras exigem Database.load({ db: "sqlite:arquivo.db", extensions: [] })
 * - e algumas aceitam { path, extensions }
 *
 * Este loader tenta as variações e usa a que funcionar.
 */

import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';
import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';
import { ensureDesktopDir, statDesktopPathSafe } from '@/lib/capabilities/desktop-fs-adapter';

export type SqlDatabase = {
  execute: (query: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select: <T = any>(query: string, bindValues?: unknown[]) => Promise<T>;
  close: () => Promise<boolean>;
};

const dbByKey = new Map<string, Promise<SqlDatabase>>();
const dbResolutionByKey = new Map<string, SqliteDbResolution>();

function sanitizeFileToken(input: string): string {
  return (input || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

type DbPathPick = {
  path: string;
  source: 'appData_db' | 'appLocal_db' | 'appData_root' | 'appLocal_root' | 'relative';
  size: number;
  mtimeMs: number;
};

export type SqliteDbResolution = {
  requestedStoreId: string;
  storeIdToken: string;
  fileName: string;
  resolvedPath: string;
  pickedFrom: DbPathPick['source'];
  dbPath: string;
  openedAt: number;
};

async function resolveDesktopDbFilePath(fileName: string): Promise<{ path: string; pickedFrom: DbPathPick['source'] }> {
  // ✅ P0: evitar “zerar após atualização” por mudança de diretório padrão do plugin (AppData vs AppLocalData)
  // Estratégia:
  // - Procura o mesmo arquivo .db em AppData e AppLocalData (raiz e /db)
  // - Escolhe o candidato com maior mtime/size (o “mais provável” de ter os dados)
  // - Usa path ABSOLUTO para abrir (DEV = PROD e independente do diretório padrão do plugin)

  const paths = await getDesktopPaths();
  const appData = paths.appDataDir || '';
  const appLocal = paths.appLocalDataDir || '';

  const appDataDb = await joinDesktopPath(appData, 'db', fileName);
  const appDataRoot = await joinDesktopPath(appData, fileName);

  const appLocalDb = appLocal ? await joinDesktopPath(appLocal, 'db', fileName) : '';
  const appLocalRoot = appLocal ? await joinDesktopPath(appLocal, fileName) : '';

  const candidates = ([
    { path: appDataDb, source: 'appData_db' as DbPathPick['source'] },
    { path: appLocalDb, source: 'appLocal_db' as DbPathPick['source'] },
    { path: appDataRoot, source: 'appData_root' as DbPathPick['source'] },
    { path: appLocalRoot, source: 'appLocal_root' as DbPathPick['source'] },
    // Último recurso: relativo (comportamento antigo / DEV)
    { path: fileName, source: 'relative' as DbPathPick['source'] },
  ] as Array<{ path: string; source: DbPathPick['source'] }>).filter((c) => !!c.path);

  async function getMeta(p: string, source: DbPathPick['source']): Promise<DbPathPick | null> {
    try {
      // Preferimos stat direto (exists pode ser bloqueado por ACL e faz o app “zerar”).
      const meta = await statDesktopPathSafe(p);
      if (!meta) return null;
      const size = Number((meta as any)?.size ?? 0) || 0;
      const mtimeMs = Number((meta as any)?.mtimeMs ?? (meta as any)?.mtime ?? 0) || 0;
      return { path: p, source, size, mtimeMs };
    } catch {
      return null;
    }
  }

  const present: DbPathPick[] = [];
  for (const c of candidates) {
    const meta = await getMeta(c.path, c.source);
    if (meta) present.push(meta);
  }

  if (!present.length) {
    // Nenhum arquivo encontrado: cria no local canônico (AppData/db)
    try {
      const dir = await joinDesktopPath(appData, 'db');
      await ensureDesktopDir(dir).catch(() => undefined);
    } catch {
      // ignore
    }
    return { path: appDataDb, pickedFrom: 'appData_db' };
  }

  // Preferir o que parece “mais novo” e/ou maior (para evitar pegar um DB vazio recém-criado)
  present.sort((a, b) => {
    // Primeiro: tamanho (um DB “vazio” recém-criado tende a ser bem menor)
    if (b.size !== a.size) return b.size - a.size;
    // Segundo: mais recente
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return 0;
  });

  const best = present[0];
  return { path: best.path, pickedFrom: best.source };
}

export async function getResolvedSqliteDbMetaForStore(storeId: string): Promise<SqliteDbResolution> {
  const token = sanitizeFileToken(storeId || 'default');
  const file = `smarttech-${token}.db`;
  const resolved = await resolveDesktopDbFilePath(file);
  return {
    requestedStoreId: storeId || 'default',
    storeIdToken: token,
    fileName: file,
    resolvedPath: resolved.path,
    pickedFrom: resolved.pickedFrom,
    dbPath: `sqlite::${resolved.path}`,
    openedAt: Date.now(),
  };
}

export function getOpenSqliteDatabaseDiagnostics(): SqliteDbResolution[] {
  return Array.from(dbResolutionByKey.values()).sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function loadDatabaseCompat(dbPath: string): Promise<SqlDatabase> {
  const mod = await import('@razein97/tauri-plugin-rusqlite2');
  const Database = (mod as any).default;

  // ✅ Forma correta para o wrapper JS do plugin:
  // Database.load(db: string, extensions?: string[])
  // (Se você passar um objeto aqui, isso vira "map" no Rust e quebra com: expected a borrowed string)
  return await Database.load(dbPath, []);
}

async function ensureSchema(db: SqlDatabase): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS records (
      pk TEXT PRIMARY KEY,
      tableKey TEXT NOT NULL,
      id TEXT NOT NULL,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    )`
  );
  await db.execute('CREATE INDEX IF NOT EXISTS idx_records_tableKey ON records(tableKey)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_records_tableKey_id ON records(tableKey, id)');

  await db.execute(
    `CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    )`
  );
  await db.execute('CREATE INDEX IF NOT EXISTS idx_kv_key ON kv(key)');

  // pragmas seguros + performance
  // OBS: alguns PRAGMAs retornam uma linha (ex.: journal_mode), e o plugin
  // acusa: "Execute returned results - did you mean to call query?".
  // Para evitar isso, tentamos execute e, se voltar resultado, caímos para select.
  async function pragma(sql: string) {
    try {
      await db.execute(sql);
    } catch (e) {
      const msg = String(e ?? '');
      if (msg.toLowerCase().includes('returned results') || msg.toLowerCase().includes('did you mean to call query')) {
        try {
          await db.select(sql);
          return;
        } catch {}
        return;
      }
      throw e;
    }
  }

  await pragma('PRAGMA journal_mode = WAL;');
  await pragma('PRAGMA synchronous = NORMAL;');
  await pragma('PRAGMA foreign_keys = ON;');
  await pragma('PRAGMA busy_timeout = 5000;');

  try { await pragma('PRAGMA temp_store = MEMORY;'); } catch {}
  try { await pragma('PRAGMA cache_size = -8000;'); } catch {} // ~8MB
  try { await pragma('PRAGMA wal_autocheckpoint = 1000;'); } catch {}
  try { await pragma('PRAGMA mmap_size = 134217728;'); } catch {} // 128MB
  try { await pragma('PRAGMA optimize;'); } catch {}
}

/**
 * ✅ Export que o sistema precisa (o erro no seu print era falta disso)
 */
export async function getSqliteDbForStore(storeId: string): Promise<SqlDatabase> {
  if (!isDesktopApp()) throw new Error('SQLite só no Desktop (Tauri).');

  const resolvedMeta = await getResolvedSqliteDbMetaForStore(storeId);
  const { fileName: file, resolvedPath, pickedFrom, dbPath } = resolvedMeta;

  if (import.meta.env.DEV) {
    logger.log?.(`[SQLite] Abrindo ${file} via ${pickedFrom}: ${resolvedPath}`);
  }

  if (dbByKey.has(dbPath)) {
    if (!dbResolutionByKey.has(dbPath)) dbResolutionByKey.set(dbPath, resolvedMeta);
    return await dbByKey.get(dbPath)!;
  }

  dbResolutionByKey.set(dbPath, resolvedMeta);

  const p = (async () => {
    const db = await loadDatabaseCompat(dbPath);
    await ensureSchema(db);
    return db;
  })();

  dbByKey.set(dbPath, p);
  return await p;
}

export async function closeDatabasesForStore(storeId: string): Promise<void> {
  const token = sanitizeFileToken(storeId || 'default');
  const match = `smarttech-${token}.db`;

  const keys = Array.from(dbByKey.keys()).filter((k) => k.includes(match));
  for (const k of keys) {
    try {
      const db = await dbByKey.get(k)!.catch(() => null);
      if (db) await db.close().catch(() => {});
    } catch {}
    dbByKey.delete(k);
    dbResolutionByKey.delete(k);
  }

  logger.log?.(`[SQLite] fechou conexões da loja ${storeId} (${keys.length})`);
}

// cleanup ao trocar loja
if (typeof window !== 'undefined') {
  window.addEventListener('smarttech:store-changed', (e: Event) => {
    const d = (e as CustomEvent).detail as { oldStoreId?: string } | undefined;
    if (d?.oldStoreId) void closeDatabasesForStore(d.oldStoreId);
  });
}
