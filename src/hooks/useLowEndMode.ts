/**
 * useLowEndMode — Hook React para o Modo PC Lento
 *
 * Uso:
 *   const { isLowEnd, toggle, suggested } = useLowEndMode();
 */

import { useEffect, useState, useCallback } from 'react';
import { getLowEndMode, setLowEndMode, isLowEndSuggested } from '@/lib/low-end-mode';
import { APP_EVENTS } from '@/lib/app-events';

interface LowEndModeState {
  /** Modo PC Lento está ativo */
  isLowEnd: boolean;
  /** Hardware fraco detectado automaticamente (sem ativação do usuário) */
  suggested: boolean;
  /** Ativar/desativar */
  toggle: () => void;
  /** Definir explicitamente */
  setMode: (enabled: boolean) => void;
}

export function useLowEndMode(): LowEndModeState {
  const [isLowEnd, setIsLowEnd] = useState<boolean>(() => getLowEndMode());
  const [suggested, setSuggested] = useState<boolean>(() => isLowEndSuggested());

  useEffect(() => {
    const sync = () => setIsLowEnd(getLowEndMode());

    window.addEventListener(APP_EVENTS.LOW_END_MODE_CHANGED, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(APP_EVENTS.LOW_END_MODE_CHANGED, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !getLowEndMode();
    setLowEndMode(next);
    setIsLowEnd(next);
    // Dispensar sugestão ao agir
    if (suggested) {
      sessionStorage.removeItem('smart-tech-low-end-suggested');
      setSuggested(false);
    }
  }, [suggested]);

  const setMode = useCallback((enabled: boolean) => {
    setLowEndMode(enabled);
    setIsLowEnd(enabled);
    sessionStorage.removeItem('smart-tech-low-end-suggested');
    setSuggested(false);
  }, []);

  return { isLowEnd, suggested, toggle, setMode };
}

// ─── Hook simplificado somente leitura ────────────────────────────────────────
// Use em componentes que só precisam saber se o modo está ativo (sem toggle).

export function useIsLowEnd(): boolean {
  const [isLowEnd, setIsLowEnd] = useState<boolean>(() => getLowEndMode());

  useEffect(() => {
    const sync = () => setIsLowEnd(getLowEndMode());
    window.addEventListener(APP_EVENTS.LOW_END_MODE_CHANGED, sync);
    return () => window.removeEventListener(APP_EVENTS.LOW_END_MODE_CHANGED, sync);
  }, []);

  return isLowEnd;
}
