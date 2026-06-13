import type { UsadoArquivoKind } from '@/types';
import { getClientId } from '@/lib/tenant';
import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';
import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';
import { ensureDesktopDir, readDesktopFileBytes, removeDesktopAbsolutePath, writeDesktopFileBytes } from '@/lib/capabilities/desktop-fs-adapter';

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

async function getDesktopUsadosDir(clientId: string): Promise<string> {
  const paths = await getDesktopPaths();
  const base = paths.appDataDir || '';
  return base ? await joinDesktopPath(base, 'files', 'usados', clientId) : '';
}

function safeIdToken(input: string): string {
  return String(input || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
}

async function ensureDir(dir: string): Promise<void> {
  try {
    if (!dir) return;
    await ensureDesktopDir(dir).catch(() => undefined);
  } catch (error) {
    logger.warn('[UsadosFilesCapability] ensureDir falhou:', error);
  }
}

async function writeBytes(filePath: string, bytes: Uint8Array): Promise<void> {
  await writeDesktopFileBytes(filePath, bytes);
}

async function readBytes(filePath: string): Promise<Uint8Array | null> {
  try {
    const data = await readDesktopFileBytes(filePath);
    return data instanceof Uint8Array ? data : new Uint8Array(data as any);
  } catch {
    return null;
  }
}

async function removePath(filePath: string): Promise<void> {
  try {
    await removeDesktopAbsolutePath(filePath);
  } catch {
    // ignore
  }
}

async function desktopFilePath(clientId: string, id: string): Promise<string> {
  const dir = await getDesktopUsadosDir(clientId);
  await ensureDir(dir);
  return dir ? await joinDesktopPath(dir, safeIdToken(id)) : safeIdToken(id);
}

async function getWebStoreModule() {
  return await import('@/lib/idb-usados-files');
}

export async function putUsadoFileByPlatform(record: UsadoFileRecord): Promise<void> {
  if (!isDesktopApp()) {
    const mod = await getWebStoreModule();
    return await mod.putUsadoFile(record);
  }

  const clientId = record.clientId || getClientId() || 'default';
  const fp = await desktopFilePath(clientId, record.id);
  const bytes = new Uint8Array(await record.blob.arrayBuffer());
  await writeBytes(fp, bytes);
}

export async function getUsadoFileBlobByPlatform(
  id: string,
  mimeType?: string
): Promise<Blob | null> {
  if (!isDesktopApp()) {
    const mod = await getWebStoreModule();
    const blob = await mod.getUsadoFileBlob(id);
    if (!blob) return null;
    return mimeType ? blob.slice(0, blob.size, mimeType) : blob;
  }

  const clientId = getClientId() || 'default';
  const fp = await desktopFilePath(clientId, id);
  const bytes = await readBytes(fp);
  if (!bytes) return null;
  const safe = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes as any);
  return new Blob([safe], { type: mimeType || 'application/octet-stream' });
}

export async function deleteUsadoFileByPlatform(id: string): Promise<void> {
  if (!isDesktopApp()) {
    const mod = await getWebStoreModule();
    return await mod.deleteUsadoFile(id);
  }

  const clientId = getClientId() || 'default';
  const fp = await desktopFilePath(clientId, id);
  await removePath(fp);
}

export async function clearUsadoFilesByClientIdByPlatform(clientId: string): Promise<void> {
  if (!isDesktopApp()) {
    const mod = await getWebStoreModule();
    return await mod.clearUsadoFilesByClientId(clientId);
  }

  try {
    const dir = await getDesktopUsadosDir(clientId || 'default');
    await removePath(dir);
  } catch (error) {
    logger.warn('[UsadosFilesCapability] clear falhou:', error);
  }
}
