/**
 * Modo administrador: controle de visibilidade de funções sensíveis.
 * Admin = dono do sistema (pode criar lojas, gerenciar licença, limpar dados, etc.)
 * 
 * ✅ CORREÇÃO CRÍTICA (Auditoria 30/01/2026): Verifica role real antes de permitir
 */

import { getCurrentSession } from './auth-supabase';

const ADMIN_FLAG_KEY = 'admin_mode';

/**
 * Retorna true se o usuário está em modo admin.
 * - URL com ?admin=1 → admin (e persiste em localStorage para próximas visitas)
 * - localStorage("admin_mode") === "1" → admin
 * 
 * ✅ CRÍTICO: Sempre verifica se usuário é SuperAdmin do SISTEMA ANTES de permitir
 */
export function isAdminMode(): boolean {
  if (typeof window === 'undefined') return false;

  // ✅ CRÍTICO: Verificar SuperAdmin real antes de permitir modo admin
  const session = getCurrentSession();
  if (!session || session.role !== 'admin') {
    // Limpar flag se não for admin (proteção contra bypass via URL)
    try {
      localStorage.removeItem(ADMIN_FLAG_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') {
    try {
      localStorage.setItem(ADMIN_FLAG_KEY, '1');
    } catch {
      /* ignore */
    }
    return true;
  }

  try {
    return localStorage.getItem(ADMIN_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Ativa o modo admin (persiste em localStorage).
 * ✅ CRÍTICO: Só permite se usuário for SuperAdmin do SISTEMA
 */
export function setAdminMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  // ✅ Verificar SuperAdmin antes de permitir ativar
  const session = getCurrentSession();
  if (!session || session.role !== 'admin') {
    return; // Não permite ativar se não for admin
  }
  
  try {
    if (enabled) {
      localStorage.setItem(ADMIN_FLAG_KEY, '1');
    } else {
      localStorage.removeItem(ADMIN_FLAG_KEY);
    }
  } catch {
    /* ignore */
  }
}
