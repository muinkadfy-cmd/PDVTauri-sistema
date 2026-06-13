export async function ensureDesktopDir(path: string): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const mkdir = (fs as any).mkdir as (p: string, opts?: any) => Promise<void>;
  await mkdir(path, { recursive: true });
}

export async function statDesktopPath(path: string): Promise<any> {
  const fs = await import('@tauri-apps/plugin-fs');
  const stat = (fs as any).stat as (p: string) => Promise<any>;
  return await stat(path);
}

export async function statDesktopPathSafe(path: string): Promise<any | null> {
  try {
    return await statDesktopPath(path);
  } catch {
    return null;
  }
}

export async function desktopPathExists(path: string): Promise<boolean> {
  return !!(await statDesktopPathSafe(path));
}

export async function readDesktopDir(path: string, opts?: any): Promise<any[]> {
  const fs = await import('@tauri-apps/plugin-fs');
  const readDir = (fs as any).readDir as (p: string, opts?: any) => Promise<any[]>;
  return await readDir(path, opts);
}

export async function readDesktopFileBytes(path: string): Promise<Uint8Array> {
  const fs = await import('@tauri-apps/plugin-fs');
  const readFile = (fs as any).readFile as (p: string, opts?: any) => Promise<Uint8Array>;
  const bytes = await readFile(path);
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
}

export async function writeDesktopFileBytes(path: string, bytes: Uint8Array): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const writeFile = (fs as any).writeFile as (p: string, data: Uint8Array, opts?: any) => Promise<void>;
  await writeFile(path, bytes);
}

export async function removeDesktopRelativeFile(path: string, baseDir: any): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const remove = (fs as any).remove as (p: string, opts?: any) => Promise<void>;
  await remove(path, { baseDir });
}

export async function removeDesktopAbsolutePath(path: string): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const remove = (fs as any).remove as (p: string, opts?: any) => Promise<void>;
  await remove(path, { recursive: true }).catch(() => remove(path));
}

export async function getDesktopFsBaseDirectories(): Promise<any[]> {
  const { BaseDirectory } = await import('@tauri-apps/plugin-fs');
  return [BaseDirectory.AppData, BaseDirectory.AppLocalData];
}
