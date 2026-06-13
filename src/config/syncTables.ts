/**
 * Configuração de Tabelas Habilitadas para Sincronização Remota
 * Lista de tabelas que existem no Supabase e devem ser sincronizadas
 */

export interface SyncTableConfig {
  enabled: boolean; // Se false, desabilita sync para esta tabela (útil para debug ou erros)
  priority?: number; // Prioridade de sincronização (menor = mais importante)
}

export const SYNC_TABLES_CONFIG: Record<string, SyncTableConfig> = {
  'settings': { enabled: true, priority: 1 },
  'pessoas': { enabled: true, priority: 2 },
  'usados': { enabled: true, priority: 3 },
  'usados_vendas': { enabled: true, priority: 3 },
  'usados_arquivos': { enabled: true, priority: 4 },
  'clientes': { enabled: true, priority: 2 },
  'produtos': { enabled: true, priority: 3 },
  'vendas': { enabled: true, priority: 3 },
  'ordens_servico': { enabled: true, priority: 3 },
  'financeiro': { enabled: true, priority: 2 },
  'cobrancas': { enabled: true, priority: 3 },
  'devolucoes': { enabled: true, priority: 3 },
  'encomendas': { enabled: true, priority: 3 },
  'recibos': { enabled: true, priority: 3 }
  // 'codigos': { enabled: false } - tabela não existe no Supabase
};

// Manter array de tabelas para compatibilidade com código existente
export const SYNC_TABLES = Object.keys(SYNC_TABLES_CONFIG).filter(
  (tableName) => SYNC_TABLES_CONFIG[tableName].enabled
) as string[];

export type SyncTableName = keyof typeof SYNC_TABLES_CONFIG;

/**
 * Verifica se uma tabela está habilitada para sincronização remota
 */
export function isTableEnabledForSync(tableName: string): boolean {
  const config = SYNC_TABLES_CONFIG[tableName];
  return config?.enabled === true;
}

/**
 * Desabilita temporariamente sincronização para uma tabela
 * Útil quando uma tabela apresenta erros persistentes
 */
export function disableTableSync(tableName: string): void {
  if (SYNC_TABLES_CONFIG[tableName]) {
    SYNC_TABLES_CONFIG[tableName].enabled = false;
    console.warn(`[SyncTables] Tabela "${tableName}" desabilitada para sincronização`);
  }
}

/**
 * Reabilita sincronização para uma tabela
 */
export function enableTableSync(tableName: string): void {
  if (SYNC_TABLES_CONFIG[tableName]) {
    SYNC_TABLES_CONFIG[tableName].enabled = true;
    console.log(`[SyncTables] Tabela "${tableName}" reabilitada para sincronização`);
  }
}

/**
 * Mapeamento de nomes de tabelas locais para nomes no Supabase
 */
export const TABLE_NAME_MAP: Record<string, string> = {
  'settings': 'settings',
  'pessoas': 'pessoas',
  'usados': 'usados',
  'usados_vendas': 'usados_vendas',
  'usados_arquivos': 'usados_arquivos',
  'clientes': 'clientes',
  'produtos': 'produtos',
  'vendas': 'vendas',
  'ordens_servico': 'ordens_servico',
  'financeiro': 'financeiro',
  'cobrancas': 'cobrancas',
  'devolucoes': 'devolucoes',
  'encomendas': 'encomendas',
  'recibos': 'recibos'
};
