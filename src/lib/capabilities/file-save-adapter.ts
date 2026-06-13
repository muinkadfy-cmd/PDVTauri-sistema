import { isDesktopApp } from '@/lib/platform';
import { sanitizeDesktopFilePath } from '@/lib/desktop/safe-path';
import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';
import { ensureDesktopDir, writeDesktopFileBytes } from '@/lib/capabilities/desktop-fs-adapter';

export interface SaveBlobDialogOptions {
  filename: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  allowedExtensions?: string[];
}

export interface SaveBlobDialogResult {
  ok: boolean;
  path?: string;
}

export function downloadBlobInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function saveBlobWithDialog(
  blob: Blob,
  options: SaveBlobDialogOptions
): Promise<boolean> {
  const result = await saveBlobWithDialogResult(blob, options);
  return result.ok;
}

export async function saveBlobWithDialogResult(
  blob: Blob,
  options: SaveBlobDialogOptions
): Promise<SaveBlobDialogResult> {
  if (!isDesktopApp()) return { ok: false };

  try {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const fs = await import('@tauri-apps/plugin-fs');
    const save = (dialog as any).save as (opts?: any) => Promise<string | null>;
    const writeFile = (fs as any).writeFile as (p: string, data: Uint8Array, opts?: any) => Promise<void>;

    const filePath = await save({
      defaultPath: options.filename,
      filters: options.filters ?? []
    });

    if (!filePath) return { ok: false };

    const sanitized = sanitizeDesktopFilePath(
      String(filePath),
      options.allowedExtensions ?? []
    );
    if (!sanitized.ok) return { ok: false };

    await writeFile(sanitized.path, new Uint8Array(await blob.arrayBuffer()));
    return { ok: true, path: sanitized.path };
  } catch {
    return { ok: false };
  }
}

export async function saveBlobToDesktopAppData(
  blob: Blob,
  filename: string,
  subdirs: string[] = []
): Promise<boolean> {
  if (!isDesktopApp()) return false;

  try {
    const paths = await getDesktopPaths();
    let targetDir = paths.appDataDir || '';
    if (!targetDir) return false;
    for (const segment of subdirs) {
      targetDir = await joinDesktopPath(targetDir, segment);
    }

    await ensureDesktopDir(targetDir);
    const target = await joinDesktopPath(targetDir, filename);
    await writeDesktopFileBytes(target, new Uint8Array(await blob.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}
