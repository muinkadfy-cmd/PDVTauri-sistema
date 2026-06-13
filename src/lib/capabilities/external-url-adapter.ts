import { isDesktopApp } from '@/lib/platform';

/**
 * Abre URLs externas usando a melhor capacidade disponível.
 * Desktop usa o navegador do sistema; Web/PWA usa nova aba com fallback.
 */
export async function openExternalUrlByPlatform(url: string): Promise<void> {
  if (!url) return;

  if (isDesktopApp()) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
      return;
    } catch {
      // fallback abaixo
    }
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
}
