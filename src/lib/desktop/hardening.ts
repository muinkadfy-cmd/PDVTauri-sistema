import { isDesktopApp } from '@/lib/platform';

/**
 * Hardening básico para build de venda (Desktop/Tauri):
 * - bloqueia refresh/reload (F5/Ctrl+R)
 * - bloqueia atalhos comuns de DevTools (F12/Ctrl+Shift+I)
 * - bloqueia menu de contexto (right click)
 *
 * Obs: não é "anti-hacker", é só para reduzir uso indevido e tickets.
 */

function freezeDesktopBridge(): void {
  try {
    const w = window as any;
    // Se existir algum namespace exposto para integrações, congelar para evitar overwrite acidental/malicioso.
    if (w.__SMARTTECH_DESKTOP__ && typeof w.__SMARTTECH_DESKTOP__ === 'object') {
      Object.freeze(w.__SMARTTECH_DESKTOP__);
    }
  } catch {
    // ignore
  }
}

export function applyDesktopHardening(): void {
  if (typeof window === 'undefined') return;
  if (!isDesktopApp()) return;

  // Congela bridge/namespace, se existir
  freezeDesktopBridge();

  // Bloqueia menu de contexto
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Bloqueia arrastar/soltar (evita abrir arquivo no WebView e perder estado)
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // Bloqueia atalhos
  window.addEventListener('keydown', (e) => {
    const key = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Refresh
    if (key === 'f5' || (ctrl && key === 'r') || (ctrl && shift && key === 'r')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // DevTools (não impede 100%, mas reduz)
    if (key === 'f12' || (ctrl && shift && (key === 'i' || key === 'j' || key === 'c'))) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }, { capture: true });
}
