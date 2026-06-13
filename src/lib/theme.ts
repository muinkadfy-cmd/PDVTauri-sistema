import { APP_EVENTS, emitAppEvent } from '@/lib/app-events';

export type ThemeMode = 'dark' | 'light';

/**
 * Dark-only (produto offline/desktop): mantém UI consistente e evita bugs de contraste.
 * Qualquer tentativa de 'light' é normalizada para 'dark'.
 */
const STORAGE_KEY = 'smart-tech-theme';

function normalizeTheme(_v: any): ThemeMode {
  return 'dark';
}

export function getStoredTheme(): ThemeMode {
  return 'dark';
}

export function applyTheme(_mode: ThemeMode, opts?: { silent?: boolean }): void {
  const m: ThemeMode = 'dark';

  // Evita transições durante a troca (reduz "piscar")
  try {
    document.documentElement.classList.add('theme-switching');
  } catch {
    // ignore
  }

  try {
    document.documentElement.setAttribute('data-theme', m);
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(STORAGE_KEY, m);
  } catch {
    // ignore
  }

  try {
    window.setTimeout(() => {
      try {
        document.documentElement.classList.remove('theme-switching');
      } catch {
        // ignore
      }
    }, 180);
  } catch {
    // ignore
  }

  if (!opts?.silent) {
    emitAppEvent(APP_EVENTS.THEME_CHANGED, m);
  }
}

export function toggleTheme(): ThemeMode {
  // Dark-only: mantém consistência e não alterna
  applyTheme('dark');
  return 'dark';
}

/**
 * Inicializa o tema (sem piscar).
 */
export function initTheme(): void {
  applyTheme('dark', { silent: true });
}
