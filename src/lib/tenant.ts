/**
 * Tenant Management
 *
 * Conceitos no sistema:
 * - CLIENT_ID: identidade da instância (usado em Setup/Diagnóstico/Backup).
 * - STORE_ID: loja ativa (multi-tenant real) usada para isolar dados e RLS.
 *
 * Nota: o LocalStorage deste projeto já é prefixado por STORE_ID (ver src/lib/storage.ts).
 */

import { safeGet, safeSet } from './storage';
import { logger } from '@/utils/logger';
import { ENV } from './env';
import { requireRuntimeStoreId } from '@/lib/runtime-context';

const CLIENT_ID_KEY = 'smart-tech-client-id'; // chave global (não prefixada)

/* =====================
   CLIENT_ID
===================== */

/**
 * Obtém o CLIENT_ID (nunca retorna null).
 * Prioridade:
 * 1) VITE_CLIENT_ID
 * 2) localStorage
 * 3) 'local'
 */
export function getClientId(): string {
  // 1) Env
  if (ENV.clientId && ENV.clientId !== 'local') {
    const envClientId = String(ENV.clientId).trim();
    // persistir para telas/backup
    const stored = safeGet<string>(CLIENT_ID_KEY, null);
    if (!stored.success || stored.data !== envClientId) {
      safeSet(CLIENT_ID_KEY, envClientId);
    }
    return envClientId;
  }

  // 2) Storage
  const res = safeGet<string>(CLIENT_ID_KEY, null);
  if (res.success && res.data && String(res.data).trim() !== '') {
    return String(res.data).trim();
  }

  // 3) fallback
  return 'local';
}

export function setClientId(clientId: string): boolean {
  if (!clientId || !clientId.trim()) {
    logger.error('[Tenant] CLIENT_ID não pode ser vazio');
    return false;
  }

  const normalized = clientId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (normalized !== clientId.trim().toLowerCase()) {
    logger.warn(`[Tenant] CLIENT_ID normalizado: "${clientId}" → "${normalized}"`);
  }

  const result = safeSet(CLIENT_ID_KEY, normalized);
  if (result.success) {
    logger.log(`[Tenant] CLIENT_ID definido: ${normalized}`);
    // manter comportamento esperado das telas existentes
    window.location.reload();
  }
  return result.success;
}

export function isClientIdConfigured(): boolean {
  return Boolean(getClientId());
}

/* =====================
   STORE_ID
===================== */

/**
 * Fonte única para obter o store_id atual (multi-tenant) de forma segura.
 * Retorna null se inválido/ausente.
 */
export function requireStoreId(contextLabel: string): string | null {
  const storeId = requireRuntimeStoreId();
  if (!storeId) {
    logger.error(`[${contextLabel}] store_id inválido/ausente (erro interno em loja única).`);
    return null;
  }
  return storeId;
}

/**
 * Prefixo real das chaves no LocalStorage para a loja atual.
 * storage.ts usa: smarttech:${storeId}:${key}
 */
export function getStoragePrefix(): string {
  const storeId = requireRuntimeStoreId();
  if (!storeId) return '';
  return `smarttech:${storeId}:`;
}

/**
 * Limpa dados do tenant atual no LocalStorage (por STORE_ID).
 */
export function clearTenantData(): boolean {
  const prefix = getStoragePrefix();
  if (!prefix) return false;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    logger.log(`[Tenant] ${keys.length} chaves removidas (prefixo ${prefix})`);
    return true;
  } catch (e) {
    logger.error('[Tenant] Erro ao limpar dados do tenant:', e);
    return false;
  }
}
