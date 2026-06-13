/**
 * Store ID Management (Multi-tenant por loja)
 * Prioridade:
 *  1) querystring ?store=UUID
 *  2) localStorage("smarttech:storeId") (ou legado "active_store_id")
 *  3) DEV only: import.meta.env.VITE_STORE_ID (fallback)
 *
 * Também:
 * - Persiste o store da URL no localStorage
 * - Mantém o parâmetro ?store na URL quando possível (replaceState)
 */

import { logger } from '@/utils/logger';
import { isLocalOnly } from './mode';
import { isDesktopApp } from './platform';

const STORE_KEY = 'smarttech:storeId';
const LEGACY_STORE_KEY = 'active_store_id';
const LEGACY_STORE_ID_KEY = 'STORE_ID'; // legado antigo
const DESKTOP_SINGLE_STORE_KEY = 'smarttech:singleStoreId';
const STORE_ID_STORAGE_KEYS = [
  DESKTOP_SINGLE_STORE_KEY,
  STORE_KEY,
  LEGACY_STORE_KEY,
  LEGACY_STORE_ID_KEY
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

export type StoreIdSource = 'desktopSingle' | 'url' | 'localStorage' | 'env' | 'missing' | 'invalid';

function safeGetLocal(key: string): string {
  try {
    return (localStorage.getItem(key) ?? '').trim();
  } catch {
    return '';
  }
}

function safeSetLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function getDesktopGlobalStoreId(): string {
  try {
    return String((window as any).__SMARTTECH_SINGLE_STORE_ID ?? '').trim();
  } catch {
    return '';
  }
}

function setDesktopGlobalStoreId(value: string): void {
  try {
    if (typeof window !== 'undefined') {
      (window as any).__SMARTTECH_SINGLE_STORE_ID = value;
    }
  } catch {
    // ignore
  }
}

function getPersistedStoreId(): string {
  for (const key of STORE_ID_STORAGE_KEYS) {
    const value = safeGetLocal(key);
    if (value) return value;
  }
  return '';
}

function persistStoreIdToAllKeys(storeId: string): void {
  for (const key of STORE_ID_STORAGE_KEYS) {
    safeSetLocal(key, storeId);
  }
  if (isDesktopApp()) setDesktopGlobalStoreId(storeId);
}

function getStableDesktopStoreId(): string {
  return getDesktopGlobalStoreId() || getPersistedStoreId();
}

function ensureStoreParamInUrl(storeId: string): void {
  // Desktop/Tauri: não manter ?store na URL (pode ficar preso em store antigo após update)
  if (isDesktopApp()) return;
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const current = url.searchParams.get('store')?.trim() || '';
    if (!current) {
      url.searchParams.set('store', storeId);
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // ignore
  }
}

export function setStoreId(
  storeId: string,
  options?: { force?: boolean; reason?: string }
): void {
  const next = (storeId ?? '').trim();
  if (!next || !isValidUUID(next)) {
    logger?.warn?.('[StoreId] ⚠️ tentativa de persistir store_id inválido, ignorando:', storeId);
    return;
  }

  const persisted = getPersistedStoreId();
  const current = isDesktopApp()
    ? (getDesktopGlobalStoreId() || persisted)
    : persisted;
  const oldStoreId = current && isValidUUID(current) ? current.trim() : null;

  if (isDesktopApp() && oldStoreId && oldStoreId !== next && !options?.force) {
    persistStoreIdToAllKeys(oldStoreId);
    if (import.meta.env.DEV) {
      logger?.warn?.(`[StoreId] 🔒 single-store por PC ativo; ignorando troca de loja ${oldStoreId} -> ${next}${options?.reason ? ` (${options.reason})` : ''}`);
    }
    ensureStoreParamInUrl(oldStoreId);
    return;
  }

  if (oldStoreId && oldStoreId === next) {
    persistStoreIdToAllKeys(next);
    ensureStoreParamInUrl(next);
    return;
  }

  persistStoreIdToAllKeys(next);

  try {
    if (typeof window !== 'undefined') {
      try {
        (window as any).__smarttechSqliteReady = false;
        (window as any).__smarttechSqliteError = null;
        (window as any).__smarttechDbCorrupted = false;
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('smarttech:store-changed', { detail: { storeId: next, oldStoreId: oldStoreId || undefined } }));
    }
  } catch {
    // ignore
  }
  ensureStoreParamInUrl(next);
}

export function getStoreId(): { storeId: string | null; source: StoreIdSource } {
  const desktopStable = isDesktopApp() ? getStableDesktopStoreId() : '';

  if (isDesktopApp() && desktopStable && isValidUUID(desktopStable)) {
    persistStoreIdToAllKeys(desktopStable);
    return { storeId: desktopStable, source: 'desktopSingle' };
  }

  // ✅ PRIORIDADE 1 (WEB): URL ?store=UUID
  // Desktop/Tauri: ignorar URL para evitar trocar de loja por querystring stale.
  if (!isDesktopApp() && typeof window !== 'undefined') {
    try {
      const urlStore = new URLSearchParams(window.location.search).get('store')?.trim() || '';
      if (urlStore) {
        if (isValidUUID(urlStore)) {
          setStoreId(urlStore); // ✅ Persistir imediatamente no localStorage
          return { storeId: urlStore, source: 'url' };
        }
        // URL tem store inválido - ignorar e continuar para tentar localStorage/env
        logger?.warn?.('[StoreId] ⚠️ store inválido na URL, ignorando:', urlStore);
      }
    } catch {
      // ignore
    }
  }

  // ✅ PRIORIDADE 2: localStorage (persistência após seleção de loja)
  if (typeof window !== 'undefined') {
    const saved = getPersistedStoreId();
    if (saved && isValidUUID(saved)) {
      persistStoreIdToAllKeys(saved);
      // Garantir que ?store esteja na URL (opcional, não obrigatório)
      ensureStoreParamInUrl(saved);
      return { storeId: saved, source: 'localStorage' };
    }
  }


  // ✅ LOCAL ONLY: se não existir store_id, auto-gerar (mantém tudo offline funcionando)
  if (isLocalOnly() && typeof window !== 'undefined') {
    try {
      const c: any = (globalThis as any).crypto;
      if (c?.randomUUID) {
        const generated = c.randomUUID();
        setStoreId(generated, { force: true, reason: 'single-store-bootstrap' });
        return { storeId: generated, source: isDesktopApp() ? 'desktopSingle' : 'localStorage' };
      }
    } catch {
      // ignore
    }
  }

  // ✅ PRIORIDADE 3: DEV-only fallback (VITE_STORE_ID)
  const envId = import.meta.env.DEV ? (import.meta.env.VITE_STORE_ID ?? '').trim() : '';
  if (envId) {
    if (isValidUUID(envId)) {
      if (isDesktopApp()) {
        setStoreId(envId, { force: true, reason: 'env-fallback' });
        return { storeId: envId, source: 'desktopSingle' };
      }
      return { storeId: envId, source: 'env' };
    }
    return { storeId: null, source: 'invalid' };
  }

  return { storeId: null, source: 'missing' };
}

/**
 * Obtém o store_id atual como UUID válido para Supabase
 * 
 * @returns UUID válido ou null (se não for UUID válido)
 */
export function getCurrentStoreId(): string | null {
  const { storeId } = getStoreId();
  if (storeId && isValidUUID(storeId)) {
    if (import.meta.env.DEV) logger.log(`[StoreId] ✅ Store ID válido (UUID): ${storeId}`);
    return storeId;
  }
  if (import.meta.env.DEV) logger.warn(`[StoreId] ⚠️ Store ID inválido/ausente (usando null para Supabase)`);
  return null;
}

/**
 * Obtém o store_id atual ou retorna null se inválido
 * Útil para garantir que sempre temos UUID válido ou null
 */
export function getValidStoreIdOrNull(): string | null {
  return getCurrentStoreId();
}

/**
 * Obtém informações de diagnóstico do store_id
 */
export function getStoreIdDiagnostics(): {
  storeId: string | null;
  isValid: boolean;
  source: StoreIdSource;
  rawStoreId: string;
  persistedStoreId: string;
} {
  const resolved = getStoreId();
  const validStoreId = resolved.storeId && isValidUUID(resolved.storeId) ? resolved.storeId : null;
  const persistedStoreId = getPersistedStoreId();
  return {
    storeId: validStoreId,
    isValid: validStoreId !== null,
    source: resolved.source,
    rawStoreId: resolved.storeId ?? '',
    persistedStoreId
  };
}
