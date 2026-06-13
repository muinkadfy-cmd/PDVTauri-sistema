import { ROLE_ROUTES, type UserRole } from '@/types';
import { logger } from '@/utils/logger';
import { isLocalOnly } from '@/lib/mode';
import {
  canUseStoreAccessRemote,
  fetchRemoteStoreAccess,
  upsertRemoteStoreAccess
} from '@/lib/capabilities/store-access-remote-adapter';

/**
 * Store Access / Feature flags por loja.
 *
 * Fonte: Supabase (tabela public.store_access).
 * Cache: localStorage (1h) para evitar chamadas a cada navegação.
 */

export type StoreAccessRoutes = Partial<Record<UserRole, string[]>>;

export interface StoreAccessRow {
  store_id: string;
  routes: StoreAccessRoutes;
  updated_at?: string;
  created_at?: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cacheKey = (storeId: string) => `smart-tech:store-access-cache:${storeId}`;
const STORE_ACCESS_CHANGED_EVENT = 'smart-tech:store-access-changed';

function readCache(storeId: string): StoreAccessRow | null {
  try {
    const raw = localStorage.getItem(cacheKey(storeId));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.store_id || obj.store_id !== storeId) return null;
    const cachedAt = typeof obj?.__cachedAt === 'number' ? obj.__cachedAt : 0;
    if (!cachedAt || Date.now() - cachedAt > CACHE_TTL_MS) return null;
    return obj as StoreAccessRow;
  } catch {
    return null;
  }
}

function writeCache(storeId: string, row: StoreAccessRow | null) {
  try {
    if (!row) {
      localStorage.removeItem(cacheKey(storeId));
      window.dispatchEvent(new CustomEvent(STORE_ACCESS_CHANGED_EVENT, { detail: { storeId, routes: null } }));
      return;
    }
    localStorage.setItem(cacheKey(storeId), JSON.stringify({ ...row, __cachedAt: Date.now() }));
    window.dispatchEvent(new CustomEvent(STORE_ACCESS_CHANGED_EVENT, { detail: { storeId, routes: row.routes } }));
  } catch {
    // ignore
  }
}

export function onStoreAccessChange(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener(STORE_ACCESS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(STORE_ACCESS_CHANGED_EVENT, handler);
}

export function getCachedAllowedRoutes(role: UserRole, storeId?: string | null): string[] {
  const base = ROLE_ROUTES[role] || [];
  if (!storeId || isLocalOnly() || role === 'admin') return base;

  const row = readCache(storeId);
  const custom = row?.routes?.[role];
  if (!Array.isArray(custom)) return base;

  const baseSet = new Set(base);
  const filtered = custom.filter((r) => typeof r === 'string' && baseSet.has(r));
  return filtered;
}

export async function fetchStoreAccess(storeId: string): Promise<StoreAccessRow | null> {
  if (isLocalOnly()) return null;
  const cached = readCache(storeId);
  if (cached) return cached;
  if (!(await canUseStoreAccessRemote())) return null;

  try {
    const { data, error } = await fetchRemoteStoreAccess(storeId);

    if (error) {
      if (import.meta.env.DEV) logger.warn('[StoreAccess] Falha ao buscar store_access', error);
      return null;
    }

    if (!data) return null;
    const row = data as StoreAccessRow;
    writeCache(storeId, row);
    return row;
  } catch (e) {
    if (import.meta.env.DEV) logger.warn('[StoreAccess] Erro inesperado ao buscar store_access', e);
    return null;
  }
}

/**
 * Retorna as rotas permitidas efetivas (ROLE_ROUTES ∩ store_access.routes[role]).
 * Se não houver config no banco, volta ROLE_ROUTES padrão.
 */
export async function getEffectiveAllowedRoutes(role: UserRole, storeId: string): Promise<string[]> {
  const base = ROLE_ROUTES[role] || [];
  if (isLocalOnly() || role === 'admin') return base;


  const row = await fetchStoreAccess(storeId);
  const custom = row?.routes?.[role];

  if (!Array.isArray(custom)) return base;

  // Interseção: só permite o que existe no base
  const baseSet = new Set(base);
  const filtered = custom.filter((r) => typeof r === 'string' && baseSet.has(r));
  return filtered;
}

/**
 * Salva config (apenas superadmin deve ter permissão no RLS).
 */
export async function upsertStoreAccess(storeId: string, routes: StoreAccessRoutes): Promise<{ ok: boolean; error?: string }> {
  if (isLocalOnly()) return { ok: false, error: 'Modo local: permissões por loja desativadas' };
  if (!(await canUseStoreAccessRemote())) return { ok: false, error: 'Supabase indisponível' };

  try {
    const { error } = await upsertRemoteStoreAccess(storeId, routes);
    if (error) return { ok: false, error: error.message };

    writeCache(storeId, { store_id: storeId, routes });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro ao salvar permissões' };
  }
}
