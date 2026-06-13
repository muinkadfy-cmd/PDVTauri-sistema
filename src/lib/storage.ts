/**
 * Camada de abstração segura para LocalStorage
 * - Tratamento de erros (quota exceeded, JSON inválido)
 * - Versionamento de schema
 * - Validação de dados
 * - Fallback gracioso
 */

import { logger } from '@/utils/logger';
import { getRuntimeStoreId } from '@/lib/runtime-context';

const STORAGE_VERSION_KEY = 'smart-tech-storage-version';
const CURRENT_STORAGE_VERSION = 1;

/**
 * Obtém o store_id atual do runtime.
 */
function getStoreIdSync(): string {
  return (getRuntimeStoreId() ?? '').trim();
}

/**
 * Adiciona prefixo de store a uma chave de storage
 * Formato: smarttech:${storeId}:${key}
 */
function prefixStorageKey(key: string): string {
  // Chaves globais (não devem ser prefixadas)
  const globalKeys = [
    'smarttech:storeId',
    'active_store_id',
    'smart-tech-client-id',
    'smart-tech-storage-version',
    'smart-tech-device-id',
    'smart-tech-license-token',
    'smart-tech-license-cache',
    'smart-tech:session',
    'smart-tech:isLogged',
    // SuperAdmin é global (não depende de store)
    'smart-tech:isSuperAdmin',
    'is_superadmin',
    'isSuperAdmin',
    'smart-tech-remember-login',
    'smart-tech-remember-email',
    'smart-tech-remember-password',
    // Configuração de impressora é por MÁQUINA (não por loja)
    'smart-tech-tamanho-papel',
    'smart-tech-economia-papel'
  ];
  
  if (globalKeys.includes(key)) {
    return key;
  }

  // Se já tem prefixo smarttech:${storeId}:, não adicionar novamente
  if (key.startsWith('smarttech:')) {
    return key;
  }

  // Aplicar novo formato: smarttech:${storeId}:${key}
  const storeId = getStoreIdSync();
  return `smarttech:${storeId}:${key}`;
}

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Verifica se LocalStorage está disponível
 */
function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém dados do LocalStorage de forma segura
 * Automaticamente aplica prefixo CLIENT_ID se configurado
 */
export function safeGet<T>(key: string, defaultValue: T | null = null): StorageResult<T> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'LocalStorage não está disponível',
      data: defaultValue ?? undefined
    };
  }

  try {
    // Aplicar prefixo CLIENT_ID se configurado
    const prefixedKey = prefixStorageKey(key);
    const item = localStorage.getItem(prefixedKey);
    if (item === null) {
      return {
        success: true,
        data: defaultValue ?? undefined
      };
    }

    const parsed = JSON.parse(item) as T;
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    logger.error(`Erro ao ler ${key} do LocalStorage:`, error);
    // Tenta limpar dados corrompidos
    try {
      const prefixedKey = prefixStorageKey(key);
      localStorage.removeItem(prefixedKey);
    } catch {
      // Ignora erro ao limpar
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao parsear JSON',
      data: defaultValue ?? undefined
    };
  }
}

/**
 * Salva dados no LocalStorage de forma segura
 */
export function safeSet<T>(key: string, value: T): StorageResult<boolean> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'LocalStorage não está disponível'
    };
  }

  try {
    // Aplicar prefixo CLIENT_ID se configurado
    const prefixedKey = prefixStorageKey(key);
    const serialized = JSON.stringify(value);
    localStorage.setItem(prefixedKey, serialized);
    return {
      success: true,
      data: true
    };
  } catch (error) {
    // QuotaExceededError ou outros erros
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error('Quota do LocalStorage excedida');
      return {
        success: false,
        error: 'Armazenamento cheio. Por favor, limpe alguns dados ou faça backup.'
      };
    }
    
    logger.error(`Erro ao salvar ${key} no LocalStorage:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao salvar'
    };
  }
}

/**
 * Atualiza dados existentes usando uma função de transformação
 */
export function safeUpdate<T>(
  key: string,
  updater: (current: T | null) => T,
  defaultValue: T | null = null
): StorageResult<T> {
  const current = safeGet<T>(key, defaultValue);
  if (!current.success && current.error !== 'LocalStorage não está disponível') {
    return current as StorageResult<T>;
  }

  try {
    const updated = updater(current.data ?? defaultValue);
    const saveResult = safeSet(key, updated);
    
    if (!saveResult.success) {
      return {
        success: false,
        error: saveResult.error
      };
    }

    return {
      success: true,
      data: updated
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar'
    };
  }
}

/**
 * Remove item do LocalStorage de forma segura
 */
export function safeRemove(key: string): StorageResult<boolean> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'LocalStorage não está disponível'
    };
  }

  try {
    // Aplicar prefixo CLIENT_ID se configurado
    const prefixedKey = prefixStorageKey(key);
    localStorage.removeItem(prefixedKey);
    return {
      success: true,
      data: true
    };
  } catch (error) {
    logger.error(`Erro ao remover ${key} do LocalStorage:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao remover'
    };
  }
}

/**
 * Limpa todo o LocalStorage (cuidado!)
 */
export function safeClear(): StorageResult<boolean> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'LocalStorage não está disponível'
    };
  }

  try {
    localStorage.clear();
    return {
      success: true,
      data: true
    };
  } catch (error) {
    logger.error('Erro ao limpar LocalStorage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao limpar'
    };
  }
}

/**
 * Obtém a versão atual do schema
 */
export function getStorageVersion(): number {
  const result = safeGet<number>(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
  return result.data ?? CURRENT_STORAGE_VERSION;
}

/**
 * Define a versão do schema
 */
export function setStorageVersion(version: number): StorageResult<boolean> {
  return safeSet(STORAGE_VERSION_KEY, version);
}

/**
 * Verifica e migra schema se necessário
 */
export function migrateStorage(): void {
  const currentVersion = getStorageVersion();
  
  if (currentVersion < CURRENT_STORAGE_VERSION) {
    logger.log(`Migrando storage da versão ${currentVersion} para ${CURRENT_STORAGE_VERSION}`);
    
    // Aqui você pode adicionar lógica de migração
    // Por exemplo, renomear chaves, transformar estruturas, etc.
    
    setStorageVersion(CURRENT_STORAGE_VERSION);
  }
}

/**
 * Gera ID único e seguro (UUID v4)
 * Compatível com Supabase que espera UUID
 */
export function generateId(): string {
  // Usa crypto.randomUUID() se disponível (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: gera UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Verifica se há espaço suficiente no LocalStorage
 */
export function checkStorageQuota(): { available: boolean; used: number; quota: number } {
  if (!isStorageAvailable()) {
    return { available: false, used: 0, quota: 0 };
  }

  try {
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Estimativa conservadora: 5MB é o limite típico
    const quota = 5 * 1024 * 1024; // 5MB em bytes
    
    return {
      available: used < quota * 0.9, // 90% do limite
      used,
      quota
    };
  } catch {
    return { available: false, used: 0, quota: 0 };
  }
}
