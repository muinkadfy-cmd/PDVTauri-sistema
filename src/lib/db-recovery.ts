/**
 * DB Recovery (P9)
 * - Fluxo de emergência: quando o SQLite estiver corrompido/travado
 * - Permite resetar o arquivo do banco (db + wal + shm) para que o app volte a abrir
 *
 * ⚠️ Resetar o banco APAGA os dados locais. Use apenas para restaurar um backup em seguida.
 */
import { isDesktopApp } from '@/lib/platform';
import { getValidStoreIdOrNull } from '@/lib/store-id';
import { logger } from '@/utils/logger';
import { getDesktopFsBaseDirectories, removeDesktopRelativeFile } from '@/lib/capabilities/desktop-fs-adapter';

// Mesma sanitização usada em sqlite-db.ts
function sanitizeFileToken(input: string): string {
  return (input || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

async function tryRemove(path: string, baseDir: any): Promise<void> {
  try {
    await removeDesktopRelativeFile(path, baseDir);
  } catch (e) {
    // ignora — alguns SOs não terão o arquivo (ok)
    if (import.meta.env.DEV) logger.warn('[DBRecovery] remove falhou:', path, e);
  }
}

/**
 * Reseta o arquivo do SQLite do store atual.
 * Retorna true se tentou executar (mesmo que algum arquivo não exista).
 */
export async function resetSqliteDatabaseForCurrentStore(): Promise<{ ok: boolean; error?: string }> {
  if (!isDesktopApp()) return { ok: false, error: 'Reset do banco só funciona no Desktop.' };

  const storeId = getValidStoreIdOrNull();
  if (!storeId) return { ok: false, error: 'STORE_ID inválido/ausente.' };

  try {
    const token = sanitizeFileToken(storeId);
    const dbName = `smarttech-${token}.db`;

    // O plugin rusqlite2 costuma armazenar no diretório AppData/AppLocalData dependendo do SO/config.
    // Tentamos nos dois para aumentar chance de sucesso.
    const targets = await getDesktopFsBaseDirectories();

    for (const baseDir of targets) {
      // Local antigo (raiz) e local canônico novo (db/)
      await tryRemove(dbName, baseDir);
      await tryRemove(`db/${dbName}`, baseDir);

      await tryRemove(`${dbName}-wal`, baseDir);
      await tryRemove(`db/${dbName}-wal`, baseDir);

      await tryRemove(`${dbName}-shm`, baseDir);
      await tryRemove(`db/${dbName}-shm`, baseDir);
    }

    // Marcar flag global para reabrir SQLite do zero
    try {
      (window as any).__smarttechSqliteReady = false;
      (window as any).__smarttechSqliteError = null;
      (window as any).__smarttechDbCorrupted = false;
    } catch { /* ignore */ }

    logger.warn('[DBRecovery] Reset do SQLite executado (db/wal/shm).');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao resetar banco.' };
  }
}
