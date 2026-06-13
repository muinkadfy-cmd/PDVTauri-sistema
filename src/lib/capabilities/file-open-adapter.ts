import { isDesktopApp } from '@/lib/platform';
import { sanitizeDesktopFilePath } from '@/lib/desktop/safe-path';

export interface OpenFileDialogOptions {
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
  allowedExtensions?: string[];
}

export async function openFileWithDialog(
  options: OpenFileDialogOptions
): Promise<string | string[] | null> {
  if (!isDesktopApp()) return null;

  try {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const open = (dialog as any).open as (opts?: any) => Promise<string | string[] | null>;

    const selected = await open({
      multiple: options.multiple ?? false,
      filters: options.filters ?? []
    });

    if (!selected) return null;

    const sanitizeOne = (value: string): string | null => {
      const sanitized = sanitizeDesktopFilePath(
        String(value),
        options.allowedExtensions ?? []
      );
      return sanitized.ok ? sanitized.path : null;
    };

    if (Array.isArray(selected)) {
      const list = selected.map((item) => sanitizeOne(String(item))).filter((item): item is string => !!item);
      return list.length ? list : null;
    }

    return sanitizeOne(String(selected));
  } catch {
    return null;
  }
}

export async function readFileBytesByPlatform(filePath: string): Promise<Uint8Array | null> {
  if (!isDesktopApp()) return null;

  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const readFile = (fs as any).readFile as (p: string, opts?: any) => Promise<Uint8Array>;
    const data = await readFile(filePath);
    return data instanceof Uint8Array ? data : new Uint8Array(data as any);
  } catch {
    return null;
  }
}

export async function statFileByPlatform(filePath: string): Promise<{ size?: number } | null> {
  if (!isDesktopApp()) return null;

  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const stat = (fs as any).stat as (p: string, opts?: any) => Promise<{ size?: number }>;
    return await stat(filePath);
  } catch {
    return null;
  }
}
