import { describe, it, expect, beforeEach } from 'vitest';
import { getStoreId, isValidUUID, setStoreId } from '@/lib/store-id';

const STORE_A = '7371cfdc-7df5-4543-95b0-882da2de6ab9';
const STORE_B = '11111111-2222-3333-4444-555555555555';

describe('store-id', () => {
  beforeEach(() => {
    localStorage.clear();
    // URL limpa
    window.history.replaceState({}, '', 'http://localhost/');
  });

  it('valida UUID corretamente', () => {
    expect(isValidUUID(STORE_A)).toBe(true);
    expect(isValidUUID('7371cfdc')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
  });

  it('setStoreId persiste em chaves legadas e garante ?store na URL', () => {
    setStoreId(STORE_A);
    expect(localStorage.getItem('smarttech:storeId')).toBe(STORE_A);
    expect(localStorage.getItem('active_store_id')).toBe(STORE_A);
    expect(localStorage.getItem('STORE_ID')).toBe(STORE_A);
    expect(window.location.search).toContain(`store=${STORE_A}`);
  });

  it('getStoreId prioriza URL, depois localStorage', () => {
    setStoreId(STORE_A);
    // Força outro store na URL
    window.history.replaceState({}, '', `http://localhost/?store=${STORE_B}`);
    const resolved = getStoreId();
    expect(resolved.storeId).toBe(STORE_B);
    expect(resolved.source).toBe('url');
  });
});
