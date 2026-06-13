/**
 * AuthService: Singleton para gerenciar autenticação anônima no Supabase
 * Evita múltiplas chamadas simultâneas de signInAnonymously (previne 429)
 */

import { supabase } from './supabaseClient';
import { logger } from '@/utils/logger';

// Lock global para evitar múltiplas chamadas simultâneas
let authPromise: Promise<{ success: boolean; error?: string }> | null = null;
let lastAuthAttempt: number = 0;
let retryCount: number = 0;

/**
 * Garante que há uma sessão anônima ativa no Supabase
 * ✅ REABILITADO - Login via Supabase Auth
 */
export async function ensureAnonSession(): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase não configurado' };
  }

  // ✅ Verificar se já existe sessão Supabase
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (sessionData?.session) {
      // Sessão já existe
      return { success: true };
    }
  } catch (err: any) {
    logger.warn('[AuthService] Erro ao verificar sessão:', err);
  }

  // ✅ Sem sessão - retornar erro para forçar login
  return { 
    success: false, 
    error: 'Faça login para continuar' 
  };
}

/**
 * Limpa o lock de autenticação (útil para testes ou reset manual)
 */
export function clearAuthLock(): void {
  authPromise = null;
  retryCount = 0;
  lastAuthAttempt = 0;
}
