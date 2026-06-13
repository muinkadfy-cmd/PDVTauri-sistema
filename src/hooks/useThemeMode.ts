import { useCallback, useEffect, useState } from 'react';
import { APP_EVENTS } from '@/lib/app-events';
import { applyTheme, getStoredTheme, type ThemeMode } from '@/lib/theme';

/**
 * Hook leve para ler/trocar tema (dark/claro) com persistência.
 * Evita usar context global para não causar re-render em cascata.
 */
export function useThemeMode() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') return attr;
    } catch {
      // ignore
    }
    return getStoredTheme();
  });

  useEffect(() => {
    const read = () => {
      try {
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr === 'light' || attr === 'dark') {
          setThemeState(attr);
          return;
        }
      } catch {
        // ignore
      }
      setThemeState(getStoredTheme());
    };

    const onThemeEvent = () => read();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === 'smart-tech-theme') read();
    };

    window.addEventListener(APP_EVENTS.THEME_CHANGED, onThemeEvent as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(APP_EVENTS.THEME_CHANGED, onThemeEvent as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setThemeState(next);
  }, [theme]);

  return { theme, setTheme, toggleTheme };
}
