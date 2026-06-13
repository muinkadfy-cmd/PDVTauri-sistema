/**
 * Produtos fixados (pin) para Venda Rápida
 * Persistência por store (safeGet/safeSet já prefixa pelo STORE_ID).
 */

import { safeGet, safeSet } from '@/lib/storage';
import { APP_EVENTS, emitAppEvent } from '@/lib/app-events';

const KEY = 'smart-tech-pinned-products:v1';
const MAX_PINS = 24;

export function getPinnedProductIds(): string[] {
  const res = safeGet<string[]>(KEY, []);
  const list = (res.success && Array.isArray(res.data) ? res.data : []) as string[];
  return list.filter(Boolean);
}

export function setPinnedProductIds(ids: string[]): void {
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, MAX_PINS);
  safeSet(KEY, unique);
  emitAppEvent(APP_EVENTS.PINNED_PRODUCTS_CHANGED, { ids: unique });
}

export function isProductPinned(productId: string): boolean {
  return getPinnedProductIds().includes(productId);
}

export function togglePinnedProduct(productId: string): { pinned: boolean; ids: string[] } {
  const current = getPinnedProductIds();
  const exists = current.includes(productId);
  const next = exists ? current.filter(id => id !== productId) : [productId, ...current].slice(0, MAX_PINS);
  setPinnedProductIds(next);
  return { pinned: !exists, ids: next };
}

export function clearPinnedProducts(): void {
  setPinnedProductIds([]);
}
