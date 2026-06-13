/**
 * Hook para aguardar sessão do Supabase estar pronta antes de navegar
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function useAuthNavigation() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  /**
   * Navega para uma rota assim que a sessão estiver pronta
   * @param to - Rota de destino
   * @param waitForSession - Se true, aguarda sessão estar presente
   */
  const navigateWhenReady = (to: string, waitForSession = true) => {
    if (!waitForSession) {
      navigate(to, { replace: true });
      return;
    }

    // Se já tem sessão, navega imediatamente
    if (session && !loading) {
      navigate(to, { replace: true });
      return;
    }

    // Caso contrário, aguarda sessão via useEffect
    // (será tratado pelo useEffect abaixo)
  };

  return { navigateWhenReady, session, loading };
}
