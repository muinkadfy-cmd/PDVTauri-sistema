/**
 * Relatórios Financeiros via view public.vw_relatorios_financeiros
 * - Filtra por store_id (URL/contexto)
 * - Retorna entradas, saídas, saldo por dia
 */

import { getCurrentStoreId } from '@/lib/store-id';
import { logger } from '@/utils/logger';
import {
  canUseFinanceRelatoriosRemote,
  fetchRemoteFinanceRelatorios
} from '@/lib/capabilities/finance-relatorios-remote-adapter';

export interface RelatorioFinanceiroRow {
  store_id: string;
  dia: string; // date ISO (YYYY-MM-DD)
  entradas: number;
  saidas: number;
  saldo: number;
  [key: string]: unknown;
}

export interface FetchRelatoriosResult {
  data: RelatorioFinanceiroRow[] | null;
  error: string | null;
}

/**
 * Busca dados da view vw_relatorios_financeiros para o store atual.
 * Ordena por dia decrescente.
 */
export async function fetchRelatoriosFinanceiros(): Promise<FetchRelatoriosResult> {
  const storeId = getCurrentStoreId();
  if (!storeId) {
    return { data: null, error: 'Store ID inválido ou ausente' };
  }

  if (!(await canUseFinanceRelatoriosRemote())) {
    return { data: null, error: 'Supabase não configurado' };
  }

  try {
    const { data, error } = await fetchRemoteFinanceRelatorios(storeId);

    if (error) {
      logger.warn('[RelatoriosView] Erro ao buscar vw_relatorios_financeiros:', error);
      return { data: null, error: error.message };
    }

    const rows = (data || []) as RelatorioFinanceiroRow[];
    return { data: rows, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[RelatoriosView] Exceção:', e);
    return { data: null, error: msg };
  }
}
