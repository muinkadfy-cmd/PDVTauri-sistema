import { getCurrentSession, type UserSession } from '@/lib/auth-supabase';
import type { UserRole } from '@/types';

/**
 * Access-control helpers (single source of truth)
 *
 * Objetivo:
 * - Evitar lógica duplicada (AuthGuard / Sidebar / páginas)
 * - Manter compatibilidade com versões antigas (flags em localStorage)
 * - Facilitar testes (funções puras com argumentos opcionais)
 */

export function readLegacySuperAdminFlag(): boolean {
  // Compatibilidade: versões antigas armazenavam flag em localStorage.
  // ⚠️ Segurança: isso NÃO concede permissão; serve apenas para diagnóstico/telemetria.
  return false;
}


export function isSuperAdminSession(session?: UserSession | null): boolean {
  if (!session) return false;
  const s: any = session as any;
  return Boolean(s.isSuperAdmin);
}

export function isAdminSession(session?: UserSession | null): boolean {
  return (session?.role as UserRole | undefined) === 'admin';
}

export function isAdminOrSuperAdmin(session?: UserSession | null): boolean {
  return isAdminSession(session) || isSuperAdminSession(session);
}

export function getSessionOrNull(): UserSession | null {
  return getCurrentSession();
}

export function getEffectiveRole(session?: UserSession | null): UserRole | null {
  const s = session ?? getSessionOrNull();
  if (!s) return null;
  // Mantém role original; superadmin é tratado por flag
  return (s.role as UserRole) ?? null;
}

/**
 * Admin-only / SuperAdmin override
 */
export function canManageUsers(session?: UserSession | null): boolean {
  const s = session ?? getSessionOrNull();
  return isAdminOrSuperAdmin(s);
}

export function canManageLicense(session?: UserSession | null): boolean {
  const s = session ?? getSessionOrNull();
  // Admin da loja e SuperAdmin podem acessar/licenciar
  return isAdminOrSuperAdmin(s);
}
