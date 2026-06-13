import { logger } from '@/utils/logger';

const DB_NAME = 'smart-tech-fs-handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const BACKUP_DIR_KEY = 'backup_dir_v1';

type AnyDirHandle = any;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    logger.warn('[BackupFolder] idbGet falhou:', e);
    return null;
  }
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch (e) {
    logger.warn('[BackupFolder] idbSet falhou:', e);
    return false;
  }
}

async function idbDel(key: string): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch (e) {
    logger.warn('[BackupFolder] idbDel falhou:', e);
    return false;
  }
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

async function ensureReadWritePermission(dirHandle: AnyDirHandle): Promise<boolean> {
  try {
    if (!dirHandle?.queryPermission || !dirHandle?.requestPermission) return true;

    const opts = { mode: 'readwrite' as const };
    const q = await dirHandle.queryPermission(opts);
    if (q === 'granted') return true;
    const r = await dirHandle.requestPermission(opts);
    return r === 'granted';
  } catch (e) {
    logger.warn('[BackupFolder] permission falhou:', e);
    return false;
  }
}

export async function pickAndPinBackupDirectory(): Promise<{ success: boolean; name?: string; error?: string }> {
  if (!isDirectoryPickerSupported()) {
    return { success: false, error: 'Este navegador não suporta escolher pasta. Use o download padrão.' };
  }

  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const ok = await ensureReadWritePermission(handle);
    if (!ok) return { success: false, error: 'Permissão negada para escrever na pasta.' };

    const saved = await idbSet(BACKUP_DIR_KEY, handle);
    if (!saved) return { success: false, error: 'Não foi possível fixar a pasta (IndexedDB indisponível).' };

    return { success: true, name: handle?.name };
  } catch (e: any) {
    // cancel do picker não deve virar erro alto
    const msg = e?.name === 'AbortError' ? 'Seleção cancelada.' : (e?.message || 'Falha ao escolher pasta.');
    return { success: false, error: msg };
  }
}

export async function getPinnedBackupDirectory(): Promise<{ handle: AnyDirHandle | null; name?: string; writable: boolean }> {
  const handle = await idbGet<AnyDirHandle>(BACKUP_DIR_KEY);
  if (!handle) return { handle: null, writable: false };
  const writable = await ensureReadWritePermission(handle);
  return { handle, name: handle?.name, writable };
}

export async function clearPinnedBackupDirectory(): Promise<boolean> {
  return await idbDel(BACKUP_DIR_KEY);
}

export async function writeFileToDirectory(
  dirHandle: AnyDirHandle,
  filename: string,
  blob: Blob
): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await ensureReadWritePermission(dirHandle);
    if (!ok) return { success: false, error: 'Sem permissão para escrever na pasta.' };

    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao salvar arquivo na pasta.' };
  }
}



/**
 * P9: Rotação automática de backups na pasta fixada.
 * Mantém os backups mais recentes e apaga os muito antigos, para evitar lotar disco.
 *
 * Regras (conservadoras):
 * - manter pelo menos KEEP_LAST arquivos mais recentes
 * - remover arquivos mais antigos que MAX_AGE_DAYS (se exceder o mínimo)
 */
export async function rotateBackupsInDirectory(
  dirHandle: AnyDirHandle,
  opts?: { keepLast?: number; maxAgeDays?: number }
): Promise<{ removed: number; kept: number }> {
  const keepLast = Math.max(5, opts?.keepLast ?? 30);
  const maxAgeDays = Math.max(7, opts?.maxAgeDays ?? 90);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    const ok = await ensureReadWritePermission(dirHandle);
    if (!ok) return { removed: 0, kept: 0 };

    const entries: Array<{ name: string; lastModified: number }> = [];
    // Listar arquivos da pasta
    for await (const handle of dirHandle.values()) {
      try {
        if (!handle || handle.kind !== 'file') continue;
        const name = String(handle.name || '');
        if (!/^backup-smart-tech-.*\.(json|json\.gz|zip)$/i.test(name)) continue;
        const f = await handle.getFile();
        entries.push({ name, lastModified: Number(f.lastModified || 0) });
      } catch {
        // ignore
      }
    }

    // Ordenar: mais recente primeiro
    entries.sort((a, b) => b.lastModified - a.lastModified);

    const now = Date.now();
    const keepSet = new Set(entries.slice(0, keepLast).map(e => e.name));

    let removed = 0;
    let kept = 0;

    for (const e of entries) {
      if (keepSet.has(e.name)) { kept++; continue; }

      const age = now - (e.lastModified || 0);
      const shouldRemove = age > maxAgeMs;

      if (!shouldRemove) {
        // Não remove se ainda está dentro da janela de idade
        kept++;
        continue;
      }

      try {
        await dirHandle.removeEntry(e.name);
        removed++;
      } catch (err) {
        logger.warn('[BackupFolder] Falha ao remover backup antigo:', e.name, err);
      }
    }

    return { removed, kept };
  } catch (e) {
    logger.warn('[BackupFolder] rotateBackups falhou:', e);
    return { removed: 0, kept: 0 };
  }
}
