import { getCurrentStoreId } from '@/lib/store-id';

export const STORE_SCOPED_TABLES = new Set<string>([
  'settings',
  'pessoas',
  'usados',
  'usados_vendas',
  'usados_arquivos',
  'clientes',
  'produtos',
  'vendas',
  'ordens_servico',
  'cobrancas',
  'devolucoes',
  'encomendas',
  'recibos',
  'financeiro',
  'fornecedores',
  'taxas_pagamento'
]);

export function isStoreScopedTable(tableName: string): boolean {
  return STORE_SCOPED_TABLES.has(String(tableName || '').trim());
}

export function resolveScopedStoreId(tableName: string): {
  required: boolean;
  storeId: string | null;
  error?: { message: string; code: 'STORE_ID_INVALID' };
} {
  const required = isStoreScopedTable(tableName);
  if (!required) {
    return { required: false, storeId: null };
  }

  const storeId = getCurrentStoreId();
  if (!storeId) {
    return {
      required: true,
      storeId: null,
      error: {
        message: 'store_id inválido/ausente. Configure a loja (URL ?store=UUID).',
        code: 'STORE_ID_INVALID'
      }
    };
  }

  return { required: true, storeId };
}
