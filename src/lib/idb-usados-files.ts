/**
 * Armazenamento de anexos (Usados) em IndexedDB
 *
 * Objetivos:
 * - Permitir salvar fotos/documentos 100% offline
 * - Incluir anexos no Backup/Restore (export em JSON)
 *
 * Cada registro guarda `clientId` para isolar por instância.
 */

import type { UsadoArquivoKind } from '@/types';
import { getClientId } from '@/lib/tenant';
import { logger } from '@/utils/logger';

export interface UsadoFileRecord {
  id: string;
  clientId: string;
  storeId?: string;
  usadoId: string;
  kind: UsadoArquivoKind;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  created_at: string;
  blob: Blob;
}

const DB_NAME = 'smart-tech:usados-files';
const DB_VERSION = 1;
const STORE = 'files';

function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) {
      reject(new Error('IndexedDB não disponível neste dispositivo/navegador.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('clientId', 'clientId', { unique: false });
        os.createIndex('usadoId', 'usadoId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);

    Promise.resolve(fn(store))
      .then((reqOrValue: any) => {
        if (reqOrValue && typeof reqOrValue === 'object' && 'onsuccess' in reqOrValue) {
          const req = reqOrValue as IDBRequest<T>;
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('Erro IndexedDB.'));
        } else {
          resolve(reqOrValue as T);
        }
      })
      .catch(reject);

    tx.onabort = () => reject(tx.error || new Error('Transação IndexedDB abortada.'));
    tx.onerror = () => reject(tx.error || new Error('Erro na transação IndexedDB.'));
    tx.oncomplete = () => {
      try { db.close(); } catch { /* ignore */ }
    };
  });
}

function toRecordForStorage(r: UsadoFileRecord): any {
  return {
    ...r,
    // Blob é armazenável diretamente no IDB
    blob: r.blob
  };
}

/**
 * Salva (ou sobrescreve) um arquivo no IndexedDB.
 */
export async function putUsadoFile(record: UsadoFileRecord): Promise<void> {
  await withStore('readwrite', (s) => s.put(toRecordForStorage(record)));
}

/**
 * Obtém um registro completo pelo id.
 */
export async function getUsadoFile(id: string): Promise<UsadoFileRecord | null> {
  try {
    const r = await withStore<any>('readonly', (s) => s.get(id));
    if (!r) return null;
    return r as UsadoFileRecord;
  } catch (e) {
    logger.warn('[IDB] getUsadoFile falhou:', e);
    return null;
  }
}

/**
 * Obtém apenas o Blob de um arquivo.
 */
export async function getUsadoFileBlob(id: string): Promise<Blob | null> {
  const r = await getUsadoFile(id);
  return r?.blob || null;
}

/**
 * Lista todos os arquivos do clientId atual.
 */
export async function listUsadoFilesForCurrentClient(): Promise<UsadoFileRecord[]> {
  const clientId = getClientId();
  return listUsadoFilesByClientId(clientId);
}

export async function listUsadoFilesByClientId(clientId: string): Promise<UsadoFileRecord[]> {
  if (!hasIDB()) return [];
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const idx = store.index('clientId');
    const req = idx.openCursor(IDBKeyRange.only(clientId));
    const items: UsadoFileRecord[] = [];

    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (!cursor) return;
      items.push(cursor.value as UsadoFileRecord);
      cursor.continue();
    };

    req.onerror = () => {
      logger.warn('[IDB] Cursor falhou:', req.error);
    };

    tx.oncomplete = () => {
      try { db.close(); } catch { /* ignore */ }
      resolve(items);
    };

    tx.onerror = () => {
      logger.warn('[IDB] Transação falhou:', tx.error);
      try { db.close(); } catch { /* ignore */ }
      resolve(items);
    };
  });
}

/**
 * Remove um arquivo pelo id.
 */
export async function deleteUsadoFile(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id));
}

/**
 * Limpa todos os arquivos de um clientId.
 * Usado em "limpar dados" e antes de restore.
 */
export async function clearUsadoFilesByClientId(clientId: string): Promise<void> {
  try {
    if (!hasIDB()) return;
    const all = await listUsadoFilesByClientId(clientId);
    if (all.length === 0) return;

    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const r of all) store.delete(r.id);

      tx.oncomplete = () => {
        try { db.close(); } catch { /* ignore */ }
        resolve();
      };

      tx.onerror = () => {
        logger.warn('[IDB] clearUsadoFiles transação falhou:', tx.error);
        try { db.close(); } catch { /* ignore */ }
        resolve();
      };
    });
  } catch (e) {
    logger.warn('[IDB] clearUsadoFilesByClientId falhou:', e);
  }
}
