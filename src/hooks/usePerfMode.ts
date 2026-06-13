import { useEffect, useState } from 'react';
import { safeGet } from '@/lib/storage';
import { APP_EVENTS } from '@/lib/app-events';

const STORAGE_KEY_PERF = 'smart-tech-perf-mode';

/**
 * Hook para ler o "Modo desempenho" (persistido via safeGet/safeSet)
 * e reagir a mudanças na mesma aba e entre abas.
 */
export function usePerfMode(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      // Padrão: ON (melhor UX no Tauri / PCs modestos)
      return Boolean(safeGet<boolean>(STORAGE_KEY_PERF, true).data);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const read = () => {
      try {
        setEnabled(Boolean(safeGet<boolean>(STORAGE_KEY_PERF, true).data));
      } catch {
        setEnabled(true);
      }
    };

    const onPerfEvent = () => read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || String(e.key).includes(STORAGE_KEY_PERF)) read();
    };

    window.addEventListener(APP_EVENTS.PERF_MODE_CHANGED, onPerfEvent as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(APP_EVENTS.PERF_MODE_CHANGED, onPerfEvent as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return enabled;
}
