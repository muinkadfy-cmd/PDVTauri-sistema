import { describe, it, expect, beforeEach } from 'vitest';
import { setStoreId } from '@/lib/store-id';
import {
  addToOutbox,
  getOutboxItems,
  getPendingOutboxItems,
  saveOutboxItems,
  recordOutboxError,
  markAsSynced,
  cleanSyncedOutboxItems,
  getOutboxStats,
  MAX_RETRIES,
} from '@/lib/repository/outbox';

const STORE_ID = '7371cfdc-7df5-4543-95b0-882da2de6ab9';

describe('outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', `http://localhost/?store=${STORE_ID}`);
    setStoreId(STORE_ID);
  });

  it('adiciona item e calcula stats', () => {
    expect(getOutboxItems()).toHaveLength(0);
    addToOutbox('clientes', 'upsert', { nome: 'A' }, 'c1');
    const stats = getOutboxStats();
    expect(stats.total).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.failed).toBe(0);
  });

  it('não adiciona vendas na outbox (regra especial)', () => {
    addToOutbox('clientes', 'upsert', { nome: 'A' }, 'c1');
    addToOutbox('vendas', 'upsert', { total: 10 }, 'v1');
    expect(getOutboxItems().length).toBe(1);
  });

  it('registra erro e respeita max retries', () => {
    const item = addToOutbox('clientes', 'upsert', { nome: 'A' }, 'c1');
    for (let i = 0; i < MAX_RETRIES; i++) {
      recordOutboxError(item.id, 'falhou');
    }
    const items = getOutboxItems();
    const updated = items.find(i => i.id === item.id)!;
    expect(updated.retries).toBe(MAX_RETRIES);
    expect(updated.lastError).toBeTruthy();
  });

  it('cleanSyncedOutboxItems remove itens sincronizados antigos', () => {
    const item = addToOutbox('clientes', 'upsert', { nome: 'A' }, 'c1');
    markAsSynced(item.id);

    // Força o syncedAt para 8 dias atrás
    const all = getOutboxItems();
    all[0].syncedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    saveOutboxItems(all);

    const removed = cleanSyncedOutboxItems();
    expect(removed).toBe(1);
    expect(getOutboxItems()).toHaveLength(0);
  });

  it('getPendingOutboxItems respeita lastAttempt recente', () => {
    const item = addToOutbox('clientes', 'upsert', { nome: 'A' }, 'c1');
    recordOutboxError(item.id, 'falhou');
    // Agora lastAttempt é recente, então não deve estar pendente imediatamente
    expect(getPendingOutboxItems().length).toBe(0);

    // Força lastAttempt para 1h atrás e tenta novamente
    const items = getOutboxItems();
    const target = items.find(i => i.id === item.id)!;
    target.lastAttempt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    saveOutboxItems(items);
    expect(getPendingOutboxItems().length).toBe(1);
  });
});
