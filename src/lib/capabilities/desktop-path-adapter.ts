import { isDesktopApp } from '@/lib/platform';

export interface DesktopPathSnapshot {
  appDataDir?: string;
  appLocalDataDir?: string;
  appLogDir?: string;
}

export async function getDesktopPaths(): Promise<DesktopPathSnapshot> {
  if (!isDesktopApp()) return {};

  const pathMod = await import('@tauri-apps/api/path');
  const out: DesktopPathSnapshot = {};

  try {
    out.appDataDir = await pathMod.appDataDir();
  } catch {
    // ignore
  }

  try {
    out.appLocalDataDir = await pathMod.appLocalDataDir();
  } catch {
    // ignore
  }

  try {
    out.appLogDir = await pathMod.appLogDir();
  } catch {
    // ignore
  }

  return out;
}

export async function joinDesktopPath(...segments: string[]): Promise<string> {
  const pathMod = await import('@tauri-apps/api/path');
  return await pathMod.join(...segments);
}
