/**
 * IndexedDB (Dexie) – armazenamento local robusto.
 *
 * Por que existe:
 * - LocalStorage estoura quota (5–10MB) e custa caro (JSON.parse/stringify de arrays gigantes).
 * - IndexedDB costuma ter muito mais espaço e é mais estável para bases grandes.
 *
 * Modelo:
 * - Uma única tabela genérica `records`, indexada por `tableKey`.
 * - A chave primária é `pk = `${tableKey}:${id}``.
 */

import Dexie, { Table } from 'dexie';

export interface SmartTechRecord<T = any> {
  pk: string; // `${tableKey}:${id}`
  tableKey: string;
  id: string;
  value: T;
  updatedAt: number;
}

export interface SmartTechMeta {
  key: string;
  value: any;
}

class SmartTechDexie extends Dexie {
  records!: Table<SmartTechRecord, string>;
  meta!: Table<SmartTechMeta, string>;

  constructor(dbName: string) {
    super(dbName);
    // v1: tabela genérica de registros + metadados
    this.version(1).stores({
      records: 'pk, tableKey, id, updatedAt',
      meta: 'key'
    });
  }
}

const dbByStore = new Map<string, SmartTechDexie>();

/**
 * Um DB por store (multi-tenant). Mantém isolamento e facilita limpeza.
 */
export function getLocalDb(storeId: string): SmartTechDexie {
  const sid = (storeId || 'default').trim() || 'default';
  const name = `smarttech_local_${sid}`;
  const cached = dbByStore.get(name);
  if (cached) return cached;
  const db = new SmartTechDexie(name);
  dbByStore.set(name, db);
  return db;
}

export function makePk(tableKey: string, id: string): string {
  return `${tableKey}:${id}`;
}
