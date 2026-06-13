import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { usadosArquivosRepo } from '@/lib/repositories';
import type { UsadoArquivo, UsadoArquivoKind } from '@/types';
import { generateId } from '@/lib/storage';
import { logger } from '@/utils/logger';
import { isLocalOnly } from '@/lib/mode';
import { getClientId } from '@/lib/tenant';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { putUsadoFile, getUsadoFileBlob, UsadoFileRecord } from '@/lib/usados-files-store';
import {
  downloadRemoteUsadoFile,
  hasUsadosRemoteStorage,
  uploadRemoteUsadoFile
} from '@/lib/capabilities/usados-upload-remote-adapter';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { openExternalUrlByPlatform } from '@/lib/capabilities/external-url-adapter';
import { downloadBlobInBrowser, saveBlobWithDialogResult } from '@/lib/capabilities/file-save-adapter';
import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';
import { ensureDesktopDir, writeDesktopFileBytes } from '@/lib/capabilities/desktop-fs-adapter';
import { isDesktopApp } from '@/lib/platform';

export const BUCKET_USADOS_PHOTOS = 'usados_aparelho_photos';
export const BUCKET_USADOS_DOCS = 'usados_documentos';

// Bucket virtual para anexos offline
export const LOCAL_USADOS_BUCKET = '__local__';

export function isLocalUsadosBucket(bucket: string): boolean {
  return bucket === LOCAL_USADOS_BUCKET;
}

export function getUsadoStorageLabel(bucket: string): string {
  return isLocalUsadosBucket(bucket) ? 'Somente local/offline' : 'Sincronizado no Supabase';
}

function isLocalBucket(bucket: string): boolean {
  return isLocalUsadosBucket(bucket);
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) throw new Error('Supabase não configurado.');
  if (!hasUsadosRemoteStorage()) throw new Error('Cliente Supabase indisponível.');
}

function requireStoreId(): string {
  const storeId = getRuntimeStoreId()?.trim() || '';
  if (!storeId) throw new Error('Loja ativa invalida ou ausente.');
  return storeId;
}

function sanitizeFilename(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'arquivo';
  }
  
  return name
    .normalize('NFD') // Decompor caracteres Unicode (á → a + ´)
    .replace(/[\u0300-\u036f]/g, '') // Remover diacríticos (acentos)
    .replace(/[/\\?%*:|"<>]/g, '-') // Remover caracteres inválidos
    .replace(/\s+/g, '_') // Espaços → underscore
    .replace(/[^\w\-_.]/g, '') // Remover qualquer outro char especial
    .replace(/_{2,}/g, '_') // Múltiplos underscores → 1
    .replace(/^[._-]+/, '') // Remover prefixo inválido
    .replace(/[._-]+$/, '') // Remover sufixo inválido
    .slice(0, 120) // Limitar tamanho
    .toLowerCase() // Padronizar em minúsculas
    || 'arquivo'; // Fallback se tudo for removido
}

async function uploadToBucket(params: {
  usadoId: string;
  kind: UsadoArquivoKind;
  file: File;
}): Promise<UsadoArquivo> {
  // ✅ Modo LOCAL ONLY: salvar sempre no IndexedDB
  if (isLocalOnly() || !isSupabaseConfigured() || !isBrowserOnlineSafe()) {
    const now = new Date().toISOString();
    const localFileId = generateId();
    const storeId = getRuntimeStoreId() || undefined;

    const record: UsadoFileRecord = {
      id: localFileId,
      clientId: getClientId(),
      storeId,
      usadoId: params.usadoId,
      kind: params.kind,
      originalName: params.file.name || undefined,
      mimeType: params.file.type || undefined,
      sizeBytes: params.file.size || undefined,
      created_at: now,
      blob: params.file
    };

    await putUsadoFile(record);

    // Persistir metadados na tabela local (usados_arquivos)
    const row: UsadoArquivo = {
      id: generateId(),
      usadoId: params.usadoId,
      kind: params.kind,
      bucket: LOCAL_USADOS_BUCKET,
      path: localFileId,
      mimeType: params.file.type || undefined,
      originalName: params.file.name || undefined,
      sizeBytes: params.file.size || undefined,
      created_at: now,
      storeId: storeId as any
    };

    const saved = await usadosArquivosRepo.upsert(row);
    if (!saved) throw new Error('Falha ao salvar metadados do arquivo (offline)');
    return saved;
  }

  // ✅ Online (fallback legado): Supabase Storage
  requireSupabase();
  const storeId = requireStoreId();

  const bucket = params.kind === 'photo' ? BUCKET_USADOS_PHOTOS : BUCKET_USADOS_DOCS;
  
  // Sanitizar nome do arquivo
  const originalName = params.file.name || `${params.kind}.bin`;
  const sanitizedName = sanitizeFilename(originalName);
  
  // Extrair extensão do arquivo original
  const extension = originalName.includes('.') 
    ? originalName.split('.').pop()?.toLowerCase() 
    : (params.kind === 'photo' ? 'jpg' : 'pdf');
  
  // Garantir que o nome tenha extensão
  const fileName = sanitizedName.includes('.') 
    ? sanitizedName 
    : `${sanitizedName}.${extension}`;
  
  // Montar path padronizado: storeId/usadoId/timestamp-filename
  const path = `${storeId}/${params.usadoId}/${Date.now()}-${fileName}`;

  // Log para debug
  if (import.meta.env.DEV) {
    logger.log('[UsadosUploads] Upload:', {
      original: originalName,
      sanitized: fileName,
      path,
      size: params.file.size,
      type: params.file.type
    });
  }

  const { error } = await uploadRemoteUsadoFile(bucket, path, params.file);

  if (error) {
    logger.error('[UsadosUploads] Erro upload:', {
      error: error.message,
      original: originalName,
      path,
      bucket
    });
    throw new Error(error.message || 'Erro ao fazer upload');
  }

  const currentStoreId = getRuntimeStoreId();
  const row: UsadoArquivo = {
    id: generateId(),
    usadoId: params.usadoId,
    kind: params.kind,
    bucket,
    path,
    mimeType: params.file.type || undefined,
    originalName: params.file.name || undefined,
    sizeBytes: params.file.size || undefined,
    created_at: new Date().toISOString(),
    storeId: currentStoreId as any
  };

  const saved = await usadosArquivosRepo.upsert(row);
  if (!saved) throw new Error('Falha ao salvar metadados do arquivo');
  return saved;
}

export async function uploadPhoto(usadoId: string, file: File): Promise<UsadoArquivo> {
  return uploadToBucket({ usadoId, file, kind: 'photo' });
}

export async function uploadDocument(usadoId: string, file: File): Promise<UsadoArquivo> {
  return uploadToBucket({ usadoId, file, kind: 'document' });
}

function inferExtension(kind: UsadoArquivoKind, originalName?: string, mimeType?: string): string {
  const fromName = originalName?.includes('.') ? originalName.split('.').pop()?.toLowerCase() : '';
  if (fromName) return fromName;

  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('gif')) return 'gif';
  return kind === 'photo' ? 'jpg' : 'pdf';
}

function inferExtensionFromNameOrMime(fileName?: string, mimeType?: string): string {
  const fromName = fileName?.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  if (fromName) return fromName;

  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('plain')) return 'txt';
  return '';
}

function filenameWithExtension(fileName: string, mimeType?: string): string {
  const base = fileName?.trim() || 'arquivo';
  if (base.includes('.')) return base;
  const ext = inferExtensionFromNameOrMime(base, mimeType);
  return ext ? `${base}.${ext}` : base;
}

async function openBlobWithSystemViewer(blob: Blob, fileName: string): Promise<void> {
  const resolvedName = filenameWithExtension(fileName, blob.type);

  if (isDesktopApp()) {
    const paths = await getDesktopPaths();
    const baseDir = paths.appLocalDataDir || paths.appDataDir || '';
    if (baseDir) {
      const tempDir = await joinDesktopPath(baseDir, 'temp', 'usados-preview');
      await ensureDesktopDir(tempDir);
      const safeName = sanitizeFilename(resolvedName);
      const target = await joinDesktopPath(tempDir, `${Date.now()}-${safeName}`);
      await writeDesktopFileBytes(target, new Uint8Array(await blob.arrayBuffer()));
      await openExternalUrlByPlatform(target);
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  await openExternalUrlByPlatform(url);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function promoteLocalUsadoArquivoToRemote(arquivo: UsadoArquivo): Promise<UsadoArquivo> {
  if (!isLocalBucket(arquivo.bucket)) return arquivo;
  if (isLocalOnly() || !isSupabaseConfigured() || !isBrowserOnlineSafe()) return arquivo;

  requireSupabase();
  const storeId = requireStoreId();
  const blob = await getUsadoFileBlob(arquivo.path);
  if (!blob) {
    throw new Error('Arquivo local restaurado não encontrado para envio remoto.');
  }

  const bucket = arquivo.kind === 'photo' ? BUCKET_USADOS_PHOTOS : BUCKET_USADOS_DOCS;
  const extension = inferExtension(arquivo.kind, arquivo.originalName, arquivo.mimeType || blob.type || undefined);
  const baseName = sanitizeFilename(arquivo.originalName || `${arquivo.kind}.${extension}`);
  const fileName = baseName.includes('.') ? baseName : `${baseName}.${extension}`;
  const remotePath = `${storeId}/${arquivo.usadoId}/${Date.now()}-${fileName}`;

  const file = new File([blob], arquivo.originalName || fileName, {
    type: arquivo.mimeType || blob.type || 'application/octet-stream'
  });

  const { error } = await uploadRemoteUsadoFile(bucket, remotePath, file);
  if (error) {
    throw new Error(error.message || 'Falha ao enviar anexo restaurado para o Supabase.');
  }

  const updated: UsadoArquivo = {
    ...arquivo,
    bucket,
    path: remotePath,
    mimeType: arquivo.mimeType || blob.type || undefined,
    originalName: arquivo.originalName || fileName,
    sizeBytes: arquivo.sizeBytes || blob.size || undefined,
    storeId,
  };

  const saved = await usadosArquivosRepo.upsert(updated);
  if (!saved) {
    throw new Error('Falha ao atualizar metadata do anexo restaurado após upload remoto.');
  }

  return saved;
}

export async function downloadFile(bucket: string, path: string): Promise<Blob> {
  if (isLocalBucket(bucket)) {
    const blob = await getUsadoFileBlob(path);
    if (!blob) throw new Error('Arquivo não encontrado no armazenamento offline (IndexedDB).');
    return blob;
  }

  if (!isBrowserOnlineSafe()) throw new Error('Sem internet. Download do arquivo remoto exige conexão.');
  requireSupabase();
  const { data, error } = await downloadRemoteUsadoFile(bucket, path);
  if (error || !data) throw new Error(error?.message || 'Erro ao baixar arquivo');
  return data;
}

export async function openFileInNewTab(bucket: string, path: string): Promise<void> {
  const blob = await downloadFile(bucket, path);
  await openBlobWithSystemViewer(blob, path.split('/').pop() || 'arquivo');
}

export async function openFileFromStorage(
  bucket: string,
  path: string,
  fileName?: string
): Promise<void> {
  const blob = await downloadFile(bucket, path);
  await openBlobWithSystemViewer(blob, fileName || path.split('/').pop() || 'arquivo');
}

export async function saveFileToDevice(
  bucket: string,
  path: string,
  fileName?: string
): Promise<boolean> {
  const blob = await downloadFile(bucket, path);
  const resolvedName = filenameWithExtension(fileName || path.split('/').pop() || 'arquivo', blob.type);
  const extension = inferExtensionFromNameOrMime(resolvedName, blob.type);

  if (isDesktopApp()) {
    const result = await saveBlobWithDialogResult(blob, {
      filename: resolvedName,
      filters: extension ? [{ name: 'Arquivo', extensions: [extension] }] : undefined,
      allowedExtensions: extension ? [extension] : []
    });
    return result.ok;
  }

  let downloaded = false;

  try {
    // Em mobile, o compartilhamento nativo costuma ser mais confiável que download por <a>.
    const shareCtor = (globalThis as any).File;
    const canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof (navigator as any).canShare === 'function' &&
      typeof shareCtor === 'function';

    if (canShareFiles) {
      const shareFile = new shareCtor([blob], resolvedName, {
        type: blob.type || 'application/octet-stream'
      });

      if ((navigator as any).canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: resolvedName,
          text: resolvedName
        });
        downloaded = true;
        return true;
      }
    }

    downloadBlobInBrowser(blob, resolvedName);
    downloaded = true;
    return true;
  } finally {
    if (!downloaded) {
      // Se o navegador ignorar o atributo download, ainda abrimos o arquivo para não "sumir" ao usuário.
      try {
        const fallbackUrl = URL.createObjectURL(blob);
        setTimeout(() => {
          void openExternalUrlByPlatform(fallbackUrl);
          setTimeout(() => URL.revokeObjectURL(fallbackUrl), 60_000);
        }, 250);
      } catch {
        // ignore
      }
    }
  }

  return downloaded;
}
