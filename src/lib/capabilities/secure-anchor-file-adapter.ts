import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';
import { ensureDesktopDir, readDesktopFileBytes, writeDesktopFileBytes } from '@/lib/capabilities/desktop-fs-adapter';
import { isDesktopApp } from '@/lib/platform';

async function getSecureAnchorPaths(filename: string): Promise<{ filePath: string; backupPath: string } | null> {
  if (!isDesktopApp()) return null;

  const paths = await getDesktopPaths();
  if (!paths.appDataDir) return null;

  const dir = await joinDesktopPath(paths.appDataDir, 'secure');
  return {
    filePath: await joinDesktopPath(dir, filename),
    backupPath: await joinDesktopPath(dir, `${filename}.bak`)
  };
}

export async function readSecureAnchorFile(filename: string): Promise<string | null> {
  const resolved = await getSecureAnchorPaths(filename);
  if (!resolved) return null;

  try {
    const tryRead = async (target: string): Promise<string | null> => {
      try {
        const bytes = await readDesktopFileBytes(target);
        const normalized = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
        return new TextDecoder().decode(normalized);
      } catch {
        return null;
      }
    };

    return (await tryRead(resolved.filePath)) ?? (await tryRead(resolved.backupPath));
  } catch {
    return null;
  }
}

export async function writeSecureAnchorFile(filename: string, contents: string): Promise<void> {
  const resolved = await getSecureAnchorPaths(filename);
  if (!resolved) return;

  try {
    const lastSeparator = Math.max(
      resolved.filePath.lastIndexOf('\\'),
      resolved.filePath.lastIndexOf('/')
    );
    const secureDir = lastSeparator >= 0 ? resolved.filePath.slice(0, lastSeparator) : '';
    await ensureDesktopDir(secureDir).catch(() => undefined);

    const bytes = new TextEncoder().encode(contents);
    await writeDesktopFileBytes(resolved.filePath, bytes).catch(() => undefined);
    await writeDesktopFileBytes(resolved.backupPath, bytes).catch(() => undefined);
  } catch {
    // ignore
  }
}
