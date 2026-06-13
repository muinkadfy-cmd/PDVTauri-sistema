/**
 * Backup ZIP (Recomendado)
 *
 * Gera um .zip contendo:
 * - meta.json
 * - backup.json (sem anexos em base64)
 * - usados_files_manifest.json
 * - files/usados/<fileId> (binário)
 *
 * Restore:
 * - restaura o backup.json via restoreBackup()
 * - reidrata os anexos offline (IndexedDB) a partir do ZIP
 */

import JSZip from 'jszip';
import { scheduleSqliteCheckpoint } from '@/lib/sqlite-maintenance';

// Hardening: limites para evitar travamento/memory spike durante restore de anexos.
const MAX_ZIP_ATTACHMENTS = 5000;
const MAX_ZIP_FILE_BYTES = 25 * 1024 * 1024; // 25MB por arquivo
const MAX_ZIP_FILES_TOTAL_BYTES = 300 * 1024 * 1024; // 300MB total

import type { BackupData } from '@/lib/backup';
import { exportBackup } from '@/lib/backup';
import { putUsadoFile, getUsadoFileBlob } from '@/lib/usados-files-store';
import { LOCAL_USADOS_BUCKET } from '@/lib/usados-uploads';
import { getClientId } from '@/lib/tenant';
import { logger } from '@/utils/logger';
import { isDesktopApp } from '@/lib/platform';
import { getPinnedBackupDirectory, writeFileToDirectory, rotateBackupsInDirectory } from '@/lib/backup-folder';
import { downloadBlobInBrowser, saveBlobWithDialog } from '@/lib/capabilities/file-save-adapter';

export interface UsadosFilesManifestItem {
  id: string;
  usadoId: string;
  kind: 'photo' | 'document';
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  created_at: string;
  storeId?: string;
}

export type ZipRestoreContext = {
  zip: JSZip;
  manifest: UsadosFilesManifestItem[];
  expectedIds: string[];
  warnings: string[];
};

export type ZipRestoreResult = {
  restored: number;
  totalManifest: number;
  totalExpected: number;
  missingFromManifest: number;
  missingEntries: number;
  failed: number;
  warnings: string[];
};

async function saveBlobDesktop(blob: Blob, filename: string): Promise<boolean> {
  const ok = await saveBlobWithDialog(blob, {
    filename,
    filters: [{ name: 'Backup Smart Tech', extensions: ['zip'] }],
    allowedExtensions: ['zip']
  });
  if (!ok) {
    logger.warn('[BackupZip] Falha ao salvar via dialog/fs (desktop).');
  }
  return ok;
}


function buildZipFilename(clientId: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `backup-smart-tech-${clientId}-${date}.zip`;
}

function computeLocalRefsFromBackup(backup: BackupData): Set<string> {
  try {
    return new Set(
      (backup.data.usadosArquivos || [])
        .filter((a: any) => a?.bucket === LOCAL_USADOS_BUCKET && typeof a?.path === 'string')
        .map((a: any) => String(a.path))
    );
  } catch {
    return new Set();
  }
}

function summarizeZipManifestWarnings(expectedIds: string[], manifest: UsadosFilesManifestItem[]): string[] {
  const warnings: string[] = [];
  const expected = new Set(expectedIds);
  const manifestIds = new Set(manifest.map((item) => String(item.id || '')));

  if (manifest.length !== manifestIds.size) {
    warnings.push('ZIP contém IDs de anexos duplicados no manifesto.');
  }

  const missingFromManifest = expectedIds.filter((id) => !manifestIds.has(id));
  if (missingFromManifest.length > 0) {
    warnings.push(`ZIP sem ${missingFromManifest.length} anexo(s) esperado(s) no manifesto.`);
  }

  return warnings;
}

/**
 * Exporta Backup Completo em ZIP.
 * - backup.json vem SEM usadosFiles base64
 * - anexos offline são empacotados em files/usados/<id>
 */
export async function saveBackupZip(preferPinnedFolder: boolean = true): Promise<{
  success: boolean;
  method: 'folder' | 'download';
  filename?: string;
  filesCount?: number;
  error?: string;
}> {
  try {
    scheduleSqliteCheckpoint('before-backup-zip');
    const backup = await exportBackup({ includeOfflineFilesBase64: false });
    if (!backup) return { success: false, method: 'download', error: 'Não foi possível exportar o backup.' };

    const zip = new JSZip();

    // meta
    zip.file(
      'meta.json',
      JSON.stringify(
        {
          app: 'smart-tech-pdv',
          version: backup.version,
          exportedAt: backup.exportedAt,
          clientId: backup.clientId,
          storeId: backup.storeId || undefined,
        },
        null,
        2
      )
    );

    // backup principal
    zip.file('backup.json', JSON.stringify(backup, null, 2));

    // anexos offline (usados)
    const localRefs = computeLocalRefsFromBackup(backup);
    let filesCount = 0;

    if (localRefs.size > 0) {
      // Em vez de depender de listagem do IDB, usamos os metadados
      // presentes em `usados_arquivos` e buscamos o binário pelo `path`.
      const localRows = (backup.data.usadosArquivos || [])
        .filter((a: any) => a?.bucket === LOCAL_USADOS_BUCKET && typeof a?.path === 'string')
        .map((a: any) => ({
          id: String(a.path),
          usadoId: String(a.usadoId || ''),
          kind: (a.kind as any) || 'document',
          originalName: a.originalName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          created_at: a.created_at,
          storeId: a.storeId,
        }));

      if (localRows.length > 0) {
        const manifest: UsadosFilesManifestItem[] = [];
        const folder = zip.folder('files')?.folder('usados');

        for (const r of localRows) {
          try {
            if (!folder) break;
            const blob = await getUsadoFileBlob(r.id, r.mimeType);
            if (!blob) continue;
            folder.file(String(r.id), blob);
            manifest.push({
              id: String(r.id),
              usadoId: String(r.usadoId),
              kind: r.kind as any,
              originalName: r.originalName,
              mimeType: r.mimeType,
              sizeBytes: r.sizeBytes,
              created_at: r.created_at,
              storeId: r.storeId,
            });
            filesCount++;
          } catch (e) {
            logger.warn('[BackupZip] Falha ao incluir arquivo no zip:', (r as any)?.id, e);
          }
        }

        zip.file('usados_files_manifest.json', JSON.stringify(manifest, null, 2));
      }
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const filename = buildZipFilename(backup.clientId);
    if (preferPinnedFolder) {
      const { handle, writable } = await getPinnedBackupDirectory();
      if (handle && writable) {
        const written = await writeFileToDirectory(handle, filename, blob);
        if (written.success) {
          try { void rotateBackupsInDirectory(handle, { keepLast: 30, maxAgeDays: 90 }); } catch { /* ignore */ }
          scheduleSqliteCheckpoint('after-backup-zip');
          return { success: true, method: 'folder', filename, filesCount };
        }
      }
    }

    if (isDesktopApp()) {
      const ok = await saveBlobDesktop(blob, filename);
      if (!ok) return { success: false, method: 'download', error: 'Operação cancelada.' };
      scheduleSqliteCheckpoint('after-backup-zip');
      return { success: true, method: 'download', filename, filesCount };
    }

    downloadBlobInBrowser(blob, filename);
    scheduleSqliteCheckpoint('after-backup-zip');
    return { success: true, method: 'download', filename, filesCount };
  } catch (e: any) {
    return { success: false, method: 'download', error: e?.message || 'Falha ao gerar backup ZIP.' };
  }
}

/**
 * Carrega um ZIP de backup.
 */
export async function loadBackupZipFromFile(file: File): Promise<{
  backup: BackupData;
  ctx: ZipRestoreContext;
} | null> {
  try {
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);

    const backupEntry = zip.file('backup.json');
    if (!backupEntry) throw new Error('ZIP inválido: backup.json não encontrado.');
    const backupText = await backupEntry.async('string');
    const backup = JSON.parse(backupText) as BackupData;

    const manifestEntry = zip.file('usados_files_manifest.json');
    let manifest: UsadosFilesManifestItem[] = [];
    if (manifestEntry) {
      try {
        const mt = await manifestEntry.async('string');
        const parsed = JSON.parse(mt);
        if (Array.isArray(parsed)) manifest = parsed as UsadosFilesManifestItem[];
      } catch {
        // ignore
      }
    }

    if (manifest.length > MAX_ZIP_ATTACHMENTS) {
      throw new Error(`ZIP inválido: muitos anexos no manifest (${manifest.length}).`);
    }

    // validação estrutural mínima (não bloqueia, mas evita crash)
    const v = (await import('@/lib/backup')).validateBackup(backup);
    if (!v.valid) throw new Error(`Backup inválido: ${v.error}`);

    const expectedIds = Array.from(computeLocalRefsFromBackup(backup));
    const warnings = summarizeZipManifestWarnings(expectedIds, manifest);

    return { backup, ctx: { zip, manifest, expectedIds, warnings } };
  } catch (e) {
    logger.warn('[BackupZip] Falha ao abrir ZIP:', e);
    return null;
  }
}

/**
 * Restaura anexos offline (IndexedDB) a partir do ZIP.
 * Deve ser chamado APÓS restoreBackup() (que limpa o IndexedDB antes).
 */
export async function restoreUsadosFilesFromZip(ctx: ZipRestoreContext): Promise<ZipRestoreResult> {
  const clientId = getClientId();
  if (!clientId) {
    return {
      restored: 0,
      totalManifest: 0,
      totalExpected: 0,
      missingFromManifest: 0,
      missingEntries: 0,
      failed: 0,
      warnings: ['CLIENT_ID ausente durante restore de anexos.'],
    };
  }

  const manifest = Array.isArray(ctx.manifest) ? ctx.manifest : [];
  const expectedIds = Array.isArray(ctx.expectedIds) ? ctx.expectedIds : [];
  const totalManifest = manifest.length;
  const totalExpected = expectedIds.length;
  if (!totalManifest && !totalExpected) {
    return {
      restored: 0,
      totalManifest: 0,
      totalExpected: 0,
      missingFromManifest: 0,
      missingEntries: 0,
      failed: 0,
      warnings: [...(ctx.warnings || [])],
    };
  }

  let restored = 0;
  let totalBytes = 0;
  let failed = 0;
  let missingEntries = 0;
  const folderPrefix = 'files/usados/';
  const manifestIds = new Set(manifest.map((item) => String(item.id || '')));
  const missingFromManifest = expectedIds.filter((id) => !manifestIds.has(id)).length;

  for (const item of manifest) {
    try {
      const id = String(item.id);
      // Hardening: evitar path tricks dentro do zip
      if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) continue;
      const declaredSize = typeof item.sizeBytes === 'number' ? item.sizeBytes : undefined;
      if (declaredSize && declaredSize > MAX_ZIP_FILE_BYTES) {
        logger.warn('[BackupZip] Anexo muito grande (ignorando):', id, declaredSize);
        continue;
      }
      if (declaredSize && (totalBytes + declaredSize) > MAX_ZIP_FILES_TOTAL_BYTES) {
        logger.warn('[BackupZip] Limite total de anexos atingido. Parando restore de anexos.');
        break;
      }
      const entry = ctx.zip.file(folderPrefix + id);
      if (!entry) {
        missingEntries++;
        continue;
      }

      const uint = await entry.async('uint8array');
      const actualSize = (uint as Uint8Array).byteLength || (uint as any).length || 0;
      if (actualSize > MAX_ZIP_FILE_BYTES) {
        logger.warn('[BackupZip] Anexo excedeu limite ao ler (ignorando):', id, actualSize);
        continue;
      }
      totalBytes += actualSize;
      if (totalBytes > MAX_ZIP_FILES_TOTAL_BYTES) {
        logger.warn('[BackupZip] Limite total de anexos excedido. Parando restore de anexos.');
        break;
      }
      const mime = item.mimeType || 'application/octet-stream';
            // TS/DOM: BlobPart exige ArrayBuffer (não SharedArrayBuffer). Faz cópia segura.
      const safe = uint instanceof Uint8Array ? new Uint8Array(uint) : new Uint8Array(uint as any);
      const blob = new Blob([safe], { type: mime });

      await putUsadoFile({
        id,
        clientId,
        storeId: item.storeId,
        usadoId: String(item.usadoId),
        kind: item.kind,
        originalName: item.originalName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        created_at: item.created_at || new Date().toISOString(),
        blob,
      });
      restored++;
    } catch (e) {
      failed++;
      logger.warn('[BackupZip] Falha ao restaurar anexo do zip:', (item as any)?.id, e);
    }
  }

  const warnings = [...(ctx.warnings || [])];
  if (missingEntries > 0) warnings.push(`ZIP sem ${missingEntries} arquivo(s) binário(s) listado(s) no manifesto.`);
  if (failed > 0) warnings.push(`Falha ao restaurar ${failed} anexo(s) do ZIP.`);

  return {
    restored,
    totalManifest,
    totalExpected,
    missingFromManifest,
    missingEntries,
    failed,
    warnings,
  };
}
