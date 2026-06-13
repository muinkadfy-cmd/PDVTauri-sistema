import { describe, it, expect, beforeEach } from 'vitest';
import { setStoreId } from '@/lib/store-id';
import { safeSet, safeGet } from '@/lib/storage';

const STORE_ID = '7371cfdc-7df5-4543-95b0-882da2de6ab9';

describe('storage prefix', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', `http://localhost/?store=${STORE_ID}`);
    setStoreId(STORE_ID);
  });

  it('prefixa chaves por store (multi-tenant)', () => {
    safeSet('clientes', [{ id: 'c1' }]);
    const keys = Object.keys(localStorage);
    expect(keys.some(k => k === `smarttech:${STORE_ID}:clientes`)).toBe(true);

    const read = safeGet<any[]>('clientes', []);
    expect(read.success).toBe(true);
    expect(read.data?.[0]?.id).toBe('c1');
  });

  it('não prefixa chaves globais (sessão/storeId)', () => {
    safeSet('smart-tech:session', { ok: true });
    expect(localStorage.getItem('smart-tech:session')).toBeTruthy();
  });
});
