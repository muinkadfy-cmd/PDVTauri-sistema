import { getCurrentSession } from '@/lib/auth-supabase';
import type { UserRole } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';
import { isAdminOrSuperAdmin } from '@/lib/access-control';
import { getCachedAllowedRoutes } from '@/lib/store-access';

/**
 * Permissões locais do Desktop offline.
 *
 * Objetivo deste arquivo:
 * - ser a fonte única de verdade para menus, Guard e botões perigosos;
 * - impedir que atendente/técnico apaguem registros;
 * - proteger financeiro, backup, usuários, licença, configurações e atualizações;
 * - preservar o funcionamento básico de balcão/OS sem depender de Supabase.
 */

type BasicAction = 'create' | 'edit' | 'delete' | 'view';
type ProtectedArea =
  | 'financeiro'
  | 'fluxo-caixa'
  | 'relatorios'
  | 'backup'
  | 'configuracoes'
  | 'usuarios'
  | 'licenca'
  | 'atualizacoes';

function getSession() {
  return getCurrentSession();
}

/** Retorna a role atual ou null. */
function getRole(): UserRole | null {
  const session = getSession();
  if (!session) return null;
  return session.role as UserRole;
}

function isPrivilegedAdmin(): boolean {
  return isAdminOrSuperAdmin(getSession());
}

/**
 * Permissão básica por ação.
 * Regra segura de produção:
 * - admin/superadmin: tudo;
 * - atendente/técnico: criar/editar/ver, mas nunca excluir;
 * - sem sessão: nada.
 */
export function hasPermission(action: BasicAction): boolean {
  const role = getRole();
  if (!role) return false;
  if (isPrivilegedAdmin()) return true;

  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(action);
}

export const canCreate = () => hasPermission('create');
export const canEdit = () => hasPermission('edit');
export const canDelete = () => hasPermission('delete');
export const canView = () => hasPermission('view');

/** Áreas sensíveis ficam somente para admin/superadmin no Desktop offline. */
export function canAccessProtectedArea(area: ProtectedArea): boolean {
  void area;
  return isPrivilegedAdmin();
}

function normalizePath(route: string): string {
  const clean = String(route || '').trim().toLowerCase();
  if (!clean) return '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function matchesRoute(pathname: string, allowed: string): boolean {
  const p = normalizePath(pathname);
  const a = normalizePath(allowed);
  return p === a || p.startsWith(`${a}/`);
}

function isProtectedPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return [
    '/financeiro',
    '/fluxo-caixa',
    '/relatorios',
    '/backup',
    '/configuracoes',
    '/configuracoes-termos-garantia',
    '/usuarios',
    '/licenca',
    '/license',
    '/ativacao',
    '/atualizacoes',
    '/lojas',
    '/permissoes-loja',
    '/supabase-test',
    '/sync-status',
    '/diagnostico-sync',
    '/admin',
  ].some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * ✅ Usado por Sidebar / DrawerMenu / AuthGuard.
 * Não usa header, localStorage manual nem flag antiga de superadmin.
 */
export function canAccessRoute(route: string): boolean {
  const session = getSession();
  const role = session?.role as UserRole | undefined;
  if (!role) return false;

  const pathname = normalizePath(route);

  if (isPrivilegedAdmin()) return true;

  // Proteção dupla: mesmo que rota antiga fique cacheada, usuário operacional não entra.
  if (isProtectedPath(pathname)) return false;

  const allowedRoutes = getCachedAllowedRoutes(role, session?.storeId);
  return allowedRoutes.some((allowed) => matchesRoute(pathname, String(allowed)));
}

/** Admin-only. */
export function canManageUsers(): boolean {
  return isPrivilegedAdmin();
}

export function canManageLicense(): boolean {
  return isPrivilegedAdmin();
}

export function canManageBackup(): boolean {
  return isPrivilegedAdmin();
}

export function canManageSettings(): boolean {
  return isPrivilegedAdmin();
}

export function canManageUpdates(): boolean {
  return isPrivilegedAdmin();
}
