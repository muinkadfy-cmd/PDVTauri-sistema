/**
 * Registry de lojas (Minhas Lojas)
 * Lista global de store_ids criados pelo admin local.
 * Chave única no localStorage - NÃO prefixada por store.
 */

import { logger } from '@/utils/logger';

export type StoreEntry = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
};

const REGISTRY_KEY = 'smarttech:stores_registry:v1';

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !localStorage) return false;
    const t = '__st__';
    localStorage.setItem(t, t);
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * Carrega a lista de lojas do localStorage
 */
export function loadStores(): StoreEntry[] {
  if (!isStorageAvailable()) return [];

  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (x): x is StoreEntry =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as StoreEntry).id === 'string' &&
        typeof (x as StoreEntry).name === 'string' &&
        typeof (x as StoreEntry).createdAt === 'string'
    );
  } catch (error) {
    logger.error('[StoresRegistry] Erro ao carregar lojas:', error);
    return [];
  }
}

/**
 * Salva a lista de lojas no localStorage
 */
export function saveStores(list: StoreEntry[]): boolean {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    logger.error('[StoresRegistry] Erro ao salvar lojas:', error);
    return false;
  }
}

/**
 * Adiciona uma loja ao registro
 */
export function addStore(entry: StoreEntry): boolean {
  const list = loadStores();
  if (list.some((s) => s.id === entry.id)) {
    if (import.meta.env.DEV) logger.log('[StoresRegistry] Loja já existe, atualizando lastUsedAt');
    return updateStore(entry.id, { lastUsedAt: entry.lastUsedAt ?? new Date().toISOString() });
  }
  list.push(entry);
  return saveStores(list);
}

/**
 * Atualiza uma loja existente (patch parcial)
 */
export function updateStore(id: string, patch: Partial<Pick<StoreEntry, 'name' | 'lastUsedAt'>>): boolean {
  const list = loadStores();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return false;

  if (patch.name != null) list[idx].name = patch.name;
  if (patch.lastUsedAt != null) list[idx].lastUsedAt = patch.lastUsedAt;

  return saveStores(list);
}

/**
 * Remove uma loja do registro (não apaga dados da loja)
 */
export function removeStore(id: string): boolean {
  const list = loadStores().filter((s) => s.id !== id);
  if (list.length === loadStores().length) return false;
  return saveStores(list);
}

/**
 * Retorna a entrada do store atual, se estiver no registro
 */
export function getCurrentStoreEntry(storeId: string): StoreEntry | null {
  return loadStores().find((s) => s.id === storeId) ?? null;
}

/**
 * Ordena por lastUsedAt desc (mais recente primeiro)
 */
export function loadStoresSorted(): StoreEntry[] {
  const list = loadStores();
  return [...list].sort((a, b) => {
    const ta = a.lastUsedAt ?? a.createdAt;
    const tb = b.lastUsedAt ?? b.createdAt;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}
