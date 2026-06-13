/**
 * Desktop Persistence Diagnostics (P0-10)
 * - Mostra caminhos reais (AppData vs AppLocalData), DBs existentes e crypto.key
 * - Prova qual arquivo SQLite foi realmente aberto
 * - Conta registros por tableKey para comparar módulos que persistem vs módulos que “somem”
 */
import { isDesktopApp } from '@/lib/platform';
import { kvGet } from '@/lib/desktop-kv';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { getOpenSqliteDatabaseDiagnostics, getResolvedSqliteDbMetaForStore, getSqliteDbForStore, type SqliteDbResolution } from '@/lib/repository/sqlite-db';
import { logger } from '@/utils/logger';
import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';
import { desktopPathExists, readDesktopDir, statDesktopPathSafe } from '@/lib/capabilities/desktop-fs-adapter';

export type PersistenceDbProof = {
  requestedStoreId: string;
  fileName: string;
  resolvedPath: string;
  pickedFrom: SqliteDbResolution['pickedFrom'];
  databaseList?: Array<{ seq?: number; name?: string; file?: string }>;
  tableCounts?: Record<string, number>;
  kvCount?: number;
};

export type PersistenceInfo = {
  platform: 'desktop' | 'web';
  appDataDir?: string;
  appLocalDataDir?: string;
  dbDir?: string;
  dbFiles?: Array<{ name: string; path: string; size: number; modifiedAt?: number }>;
  cryptoKey?: { path: string; size: number; modifiedAt?: number; hasBak: boolean };
  storeIdKv?: string | null;
  activeStoreId?: string | null;
  singleStoreIdKv?: string | null;
  dbStatus?: 'ok' | 'warning' | 'critical';
  currentStoreDb?: PersistenceDbProof;
  globalDb?: PersistenceDbProof;
  openDatabases?: SqliteDbResolution[];
};

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function collectDbProof(storeId: string): Promise<PersistenceDbProof | undefined> {
  try {
    const db = await getSqliteDbForStore(storeId);
    const resolved = await getResolvedSqliteDbMetaForStore(storeId);
    const dbListRows = (await db.select(
      'PRAGMA database_list;'
    )) as Array<{ seq?: number; name?: string; file?: string }>;

    const countRows = (await db.select(
      'SELECT tableKey as tableKey, COUNT(1) as c FROM records GROUP BY tableKey ORDER BY tableKey ASC'
    )) as Array<{ tableKey?: string; c?: number }>;

    const kvRows = (await db.select(
      'SELECT COUNT(1) as c FROM kv'
    )) as Array<{ c?: number }>;

    const tableCounts = Object.fromEntries(
      (countRows || [])
        .filter((r) => typeof r?.tableKey === 'string' && r.tableKey)
        .map((r) => [String(r.tableKey), Number(r.c || 0)])
    );

    return {
      requestedStoreId: storeId,
      fileName: resolved.fileName,
      resolvedPath: resolved.resolvedPath,
      pickedFrom: resolved.pickedFrom,
      databaseList: (dbListRows || []).map((r) => ({
        seq: toNum((r as any)?.seq),
        name: typeof (r as any)?.name === 'string' ? (r as any).name : undefined,
        file: typeof (r as any)?.file === 'string' ? (r as any).file : undefined,
      })),
      tableCounts,
      kvCount: Number((kvRows?.[0] as any)?.c || 0),
    };
  } catch (error) {
    logger.error('[PersistenceInfo] Falha ao coletar prova do DB:', { storeId, error: String(error) });
    return undefined;
  }
}

export async function getPersistenceInfo(): Promise<PersistenceInfo> {
  if (!isDesktopApp()) {
    return { platform: 'web' };
  }

  try {
    const paths = await getDesktopPaths();
    const appData = paths.appDataDir || '';
    const appLocal = paths.appLocalDataDir || '';
    const dbDir = appData ? await joinDesktopPath(appData, 'db') : '';
    const secureDir = appData ? await joinDesktopPath(appData, 'secure') : '';

    const files: PersistenceInfo['dbFiles'] = [];
    try {
      const entries = await readDesktopDir(dbDir);
      for (const e of entries || []) {
        const name = String((e as any)?.name ?? (e as any)?.path?.split?.(/[\\/]/).pop?.() ?? '');
        const p = String((e as any)?.path ?? '');
        if (!name || !p) continue;
        if (!name.toLowerCase().endsWith('.db')) continue;
        try {
          const st = await statDesktopPathSafe(p);
          if (!st) throw new Error('missing stat');
          files.push({
            name,
            path: p,
            size: toNum((st as any)?.size),
            modifiedAt: toNum((st as any)?.mtimeMs ?? (st as any)?.modifiedAt ?? (st as any)?.mtime),
          });
        } catch {
          files.push({ name, path: p, size: 0 });
        }
      }
    } catch {
      // ignore
    }

    const cryptoPath = secureDir ? await joinDesktopPath(secureDir, 'crypto.key') : '';
    const cryptoBakPath = secureDir ? await joinDesktopPath(secureDir, 'crypto.key.bak') : '';
    let cryptoKey: PersistenceInfo['cryptoKey'] | undefined = undefined;
    try {
      const st = await statDesktopPathSafe(cryptoPath);
      if (!st) throw new Error('missing stat');
      cryptoKey = {
        path: cryptoPath,
        size: toNum((st as any)?.size),
        modifiedAt: toNum((st as any)?.mtimeMs ?? (st as any)?.modifiedAt ?? (st as any)?.mtime),
        hasBak: await desktopPathExists(cryptoBakPath),
      };
    } catch {
      // ignore
    }

    let storeIdKv: string | null = null;
    let singleStoreIdKv: string | null = null;
    try { storeIdKv = await kvGet('store_id'); } catch { storeIdKv = null; }
    try { singleStoreIdKv = await kvGet('single_store_id'); } catch { singleStoreIdKv = null; }

    const activeStoreId = getRuntimeStoreId();

    const currentStoreDb = activeStoreId ? await collectDbProof(activeStoreId) : undefined;
    const globalDb = await collectDbProof('__global__');
    const openDatabases = getOpenSqliteDatabaseDiagnostics();

    const dbStatus: PersistenceInfo['dbStatus'] = !files.length
      ? 'critical'
      : (!currentStoreDb?.databaseList?.length ? 'warning' : 'ok');

    return {
      platform: 'desktop',
      appDataDir: appData,
      appLocalDataDir: appLocal || undefined,
      dbDir,
      dbFiles: files.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0)),
      cryptoKey,
      storeIdKv,
      activeStoreId,
      singleStoreIdKv,
      dbStatus,
      currentStoreDb,
      globalDb,
      openDatabases,
    };
  } catch (error) {
    logger.error('[PersistenceInfo] Falha geral ao coletar diagnóstico:', error);
    return { platform: 'desktop', dbStatus: 'critical' };
  }
}

export async function logStartupPersistenceSnapshot(reason: string): Promise<void> {
  try {
    const info = await getPersistenceInfo();
    logger.warn(`[PersistenceStartup] reason=${reason}`, {
      platform: info.platform,
      dbStatus: info.dbStatus,
      activeStoreId: info.activeStoreId,
      storeIdKv: info.storeIdKv,
      singleStoreIdKv: info.singleStoreIdKv,
      currentStoreDb: info.currentStoreDb ? {
        fileName: info.currentStoreDb.fileName,
        resolvedPath: info.currentStoreDb.resolvedPath,
        pickedFrom: info.currentStoreDb.pickedFrom,
        tableCounts: info.currentStoreDb.tableCounts,
        kvCount: info.currentStoreDb.kvCount,
      } : null,
      globalDb: info.globalDb ? {
        fileName: info.globalDb.fileName,
        resolvedPath: info.globalDb.resolvedPath,
        pickedFrom: info.globalDb.pickedFrom,
        tableCounts: info.globalDb.tableCounts,
        kvCount: info.globalDb.kvCount,
      } : null,
      dbFiles: (info.dbFiles || []).map((f) => ({ name: f.name, size: f.size, modifiedAt: f.modifiedAt })),
    });
  } catch (error) {
    logger.error(`[PersistenceStartup] Falha ao registrar snapshot (${reason}):`, error);
  }
}
