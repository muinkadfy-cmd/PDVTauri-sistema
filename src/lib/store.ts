/**
 * Store Management (multitenant por link)
 * Wrapper compatível sobre a resolução central de store/runtime.
 */

import { logger } from '@/utils/logger';
import { getCurrentStoreId, getStoreIdDiagnostics, type StoreIdSource } from '@/lib/store-id';

/**
 * Obtém o store_id atual do runtime.
 */
export function getStoreId(): string {
  return getCurrentStoreId() || '';
}

/**
 * Valida se o store_id atual é válido (UUID)
 */
export function isStoreIdValid(): boolean {
  return !!getCurrentStoreId();
}

/**
 * Obtém informações de diagnóstico do store (DEV only)
 */
export function getStoreDiagnostics(): {
  storeId: string;
  isValid: boolean;
  source: StoreIdSource;
} {
  const diagnostics = getStoreIdDiagnostics();
  return {
    storeId: diagnostics.storeId || '',
    isValid: diagnostics.isValid,
    source: diagnostics.source
  };
}

/**
 * Gera chave de storage isolada por store
 * Formato: smarttech:${storeId}:${baseKey}
 */
export function getStorageKey(baseKey: string): string {
  return `smarttech:${getStoreId()}:${baseKey}`;
}

/**
 * Lista todas as chaves de storage do store atual
 */
export function getStoreStorageKeys(): string[] {
  if (typeof window === 'undefined' || !localStorage) {
    return [];
  }

  const prefix = `smarttech:${getStoreId()}:`;
  const keys: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch (error) {
    logger.error('[Store] Erro ao listar chaves de storage:', error);
  }

  return keys;
}
