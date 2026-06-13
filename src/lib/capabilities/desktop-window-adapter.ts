import { isDesktopApp } from '@/lib/platform';

export async function togglePlatformFullscreen(): Promise<boolean> {
  if (!isDesktopApp()) {
    const doc: any = document;
    const el: any = document.documentElement;
    const isFs = !!document.fullscreenElement || !!doc.webkitFullscreenElement;

    if (!isFs) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      await req?.call(el);
      return true;
    }

    const exit = document.exitFullscreen || doc.webkitExitFullscreen;
    await exit?.call(document);
    return false;
  }

  const mod = await import('@tauri-apps/api/window');
  const win = mod.getCurrentWindow();
  const isFs = await win.isFullscreen();
  await win.setFullscreen(!isFs);
  return !isFs;
}

export async function getPlatformFullscreenState(): Promise<boolean> {
  if (!isDesktopApp()) {
    const doc: any = document;
    return !!document.fullscreenElement || !!doc.webkitFullscreenElement;
  }

  const mod = await import('@tauri-apps/api/window');
  const win = mod.getCurrentWindow();
  return !!(await win.isFullscreen());
}

export async function applyPlatformWindowChromeTheme(): Promise<void> {
  if (!isDesktopApp()) return;

  try {
    const mod = await import('@tauri-apps/api/window');
    const win = mod.getCurrentWindow();
    await win.setTheme('dark');
  } catch {
    // Theme support is best-effort; the app UI still controls its own colors.
  }
}

export async function closePlatformWindow(): Promise<void> {
  if (!isDesktopApp()) {
    try {
      window.close();
    } catch {
      // ignore
    }
    return;
  }

  const mod = await import('@tauri-apps/api/window');
  const win = mod.getCurrentWindow();
  await win.close();
}
