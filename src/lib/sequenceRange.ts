/**
 * Sequence Range Management (HI/LO Pattern)
 * Gerencia faixas de números sequenciais para garantir anti-duplicidade
 */

import { safeGet, safeSet } from './storage';
import { getDeviceId } from './device';
import { logger } from '@/utils/logger';
import { isLocalOnly } from './mode';
import { getCurrentStoreId, isValidUUID } from './store-id';
import { allocateRemoteSequenceRange } from '@/lib/capabilities/sequence-range-remote-adapter';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';

const RANGE_STORAGE_KEY = 'smart-tech-sequence-ranges';

export interface SequenceRange {
  entity: string; // 'os', 'venda'
  storeId: string;
  start: number;
  end: number;
  next: number; // Próximo número disponível
  deviceId: string;
  allocatedAt: string;
}

interface StoredRanges {
  [key: string]: SequenceRange; // key: `${storeId}:${entity}`
}

/**
 * Obtém ou solicita um range para uma entidade
 */

export async function getOrRequestRange(
  entity: string,
  storeId: string | null,
  blockSize: number = 100
): Promise<SequenceRange | null> {
  // Validar storeId: deve ser UUID válido ou usar o atual
  const validStoreId = storeId && isValidUUID(storeId) ? storeId : getCurrentStoreId();
  
  if (!validStoreId) {
    logger.error(`[SequenceRange] ⚠️ Store ID inválido para ${entity}. Não é possível alocar range.`);
    return null;
  }
  
  const key = `${validStoreId}:${entity}`;
  let stored = getStoredRange(key);

  // Se existe range válido e ainda tem números disponíveis
  if (stored && stored.next <= stored.end) {
    return stored;
  }


  // ✅ LOCAL ONLY: alocar range sempre local, sem servidor
  if (isLocalOnly()) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const prev = getStoredRange(key);
    const start = prev && typeof prev.end === 'number' ? (prev.end + 1) : 1;
    const end = start + Math.max(1, blockSize) - 1;
    const localRange: SequenceRange = {
      entity,
      storeId: validStoreId,
      start,
      end,
      next: start,
      deviceId,
      allocatedAt: now
    };
    saveStoredRange(key, localRange);
    return localRange;
  }

  // Se não tem range ou esgotou, solicitar novo (se online)
  if (isOnline()) {
    return await requestNewRangeOnline(entity, validStoreId, blockSize);
  }

  // Offline: retorna null (criará com número pendente)
  logger.warn(`[SequenceRange] Offline e sem range para ${entity}. Criando com número pendente.`);
  return null;
}

/**
 * Consome o próximo número do range local
 */
export function consumeNext(entity: string, storeId: string | null): number | null {
  // Validar storeId: deve ser UUID válido ou usar o atual
  const validStoreId = storeId && isValidUUID(storeId) ? storeId : getCurrentStoreId();
  
  if (!validStoreId) {
    logger.error(`[SequenceRange] ⚠️ Store ID inválido para ${entity}. Não é possível consumir número.`);
    return null;
  }
  
  const key = `${validStoreId}:${entity}`;
  let stored = getStoredRange(key);

  if ((!stored || stored.next > stored.end) && isLocalOnly()) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const start = stored && typeof stored.end === 'number' ? (stored.end + 1) : 1;
    const end = start + 100 - 1;
    const localRange: SequenceRange = { entity, storeId: validStoreId, start, end, next: start, deviceId, allocatedAt: now };
    saveStoredRange(key, localRange);
    stored = localRange;
  }
  if (!stored || stored.next > stored.end) {
    return null; // Range esgotado ou não existe
  }

  const nextNumber = stored.next;
  stored.next = nextNumber + 1;

  // Persistir atualização
  saveStoredRange(key, stored);

  logger.log(`[SequenceRange] Número consumido: ${entity} #${nextNumber}`);

  return nextNumber;
}

/**
 * Solicita um novo range do servidor (online)
 */
export async function requestNewRangeOnline(
  entity: string,
  storeId: string | null,
  blockSize: number = 100
): Promise<SequenceRange | null> {
  // Validar storeId: deve ser UUID válido
  const validStoreId = storeId && isValidUUID(storeId) ? storeId : getCurrentStoreId();
  
  if (!validStoreId) {
    logger.error(`[SequenceRange] ⚠️ Store ID inválido para ${entity}. Não é possível chamar RPC allocate_doc_range.`);
    return null;
  }
  
  const deviceId = getDeviceId();

  try {
    logger.log(`[SequenceRange] Solicitando range: ${entity} (store_id: ${validStoreId}, blockSize: ${blockSize})`);

    const { data, error } = await allocateRemoteSequenceRange({
      storeId: validStoreId,
      entity,
      deviceId,
      blockSize
    });

    if (error) {
      logger.error('[SequenceRange] Erro ao alocar range:', error);
      return null;
    }

    if (!data || data.length === 0) {
      logger.error('[SequenceRange] Resposta vazia do servidor');
      return null;
    }

    const result = data[0];
    const range: SequenceRange = {
      entity,
      storeId: validStoreId, // UUID válido
      start: result.start_value,
      end: result.end_value,
      next: result.start_value,
      deviceId,
      allocatedAt: new Date().toISOString()
    };

    // Persistir range localmente
    const key = `${validStoreId}:${entity}`;
    saveStoredRange(key, range);

    logger.log(`[SequenceRange] Range alocado: ${entity} ${range.start}-${range.end}`);

    return range;
  } catch (error) {
    logger.error('[SequenceRange] Erro ao solicitar range:', error);
    return null;
  }
}

/**
 * Pré-aquecer ranges ao iniciar app (se online)
 */
export async function preWarmRanges(storeId: string | null, entities: string[] = ['os', 'venda']): Promise<void> {
  if (!isOnline()) {
    logger.log('[SequenceRange] Offline - pulando pré-aquecimento');
    return;
  }

  // Validar storeId: deve ser UUID válido ou usar o atual
  const validStoreId = storeId && isValidUUID(storeId) ? storeId : getCurrentStoreId();
  
  if (!validStoreId) {
    logger.warn('[SequenceRange] ⚠️ Store ID inválido, não é possível pré-aquecer ranges');
    return;
  }

  logger.log(`[SequenceRange] Pré-aquecendo ranges para store_id: ${validStoreId}...`);

  for (const entity of entities) {
    const key = `${validStoreId}:${entity}`;
    let stored = getStoredRange(key);

    // Se não tem range ou está quase esgotado (< 20 números), solicitar novo
    if (!stored || (stored.end - stored.next) < 20) {
      await requestNewRangeOnline(entity, validStoreId, 100);
    }
  }
}

/**
 * Formata número para string (0001, 0002, etc.)
 */
export function formatSequenceNumber(num: number, padding: number = 4): string {
  return String(num).padStart(padding, '0');
}

/**
 * Gera número temporário pendente
 */
export function generatePendingNumber(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PEND-${random}`;
}

// ============================================================
// Funções auxiliares de storage
// ============================================================

function getStoredRange(key: string): SequenceRange | null {
  const result = safeGet<StoredRanges>(RANGE_STORAGE_KEY, {});
  if (!result.success || !result.data) {
    return null;
  }
  return result.data[key] || null;
}

function saveStoredRange(key: string, range: SequenceRange): void {
  const result = safeGet<StoredRanges>(RANGE_STORAGE_KEY, {});
  const ranges: StoredRanges = result.success && result.data ? result.data : {};
  ranges[key] = range;
  safeSet(RANGE_STORAGE_KEY, ranges);
}

function isOnline(): boolean {
  if (isLocalOnly()) return false;
  return isBrowserOnlineSafe();
}
