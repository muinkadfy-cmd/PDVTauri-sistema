import { ENV } from '@/lib/env';

const SUPERADMIN_KEYS = ['smart-tech:isSuperAdmin', 'is_superadmin', 'isSuperAdmin'] as const;

function readLocalSuperAdminFlag(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;
  try {
    return SUPERADMIN_KEYS.some((key) => window.localStorage.getItem(key) === 'true');
  } catch {
    return false;
  }
}

/**
 * Fonte efetiva de SuperAdmin.
 *
 * - Com Supabase configurado: depende da sessão remota/local atual
 * - Sem Supabase: aceita fallback offline por env/flags legadas
 */
export function isSuperAdmin(): boolean {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('smart-tech:session');
      const session = raw ? JSON.parse(raw) : null;
      if (session?.isSuperAdmin === true) return true;
    } catch {
      // ignore
    }
  }

  if (ENV.hasSupabase) {
    return false;
  }

  return ENV.superAdminEnabled || readLocalSuperAdminFlag();
}
