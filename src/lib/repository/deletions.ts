/**
 * Deletions Tombstone (padrão SaaS offline-first)
 * - Evita "apagar por suposição" (itens órfãos)
 * - Propaga deleções entre dispositivos de forma determinística
 *
 * Tabela no Supabase: public.deletions
 * Colunas esperadas:
 * - id (uuid)
 * - store_id (uuid)
 * - table_name (text)
 * - record_id (uuid)
 * - deleted_at (timestamptz)
 */

type SupabaseClient = any;
import { safeGet, safeSet } from '../storage';
import { logger } from '@/utils/logger';

export interface DeletionRow {
  id?: string;
  store_id: string;
  table_name: string;
  record_id: string;
  deleted_at: string;
  deleted_by?: string | null;
  reason?: string | null;
}

const DELETIONS_CURSOR_KEY = 'deletions_cursor';
const DELETIONS_UNSUPPORTED_UNTIL_KEY = 'deletions_unsupported_until';

const PAGE_SIZE = 500;
const UNSUPPORTED_TTL_MS = 10 * 60 * 1000; // 10min

function isMissingTableError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  // PostgREST: PGRST205 "Could not find the table"
  if (code === 'PGRST205') return true;
  if (msg.includes('could not find the table')) return true;
  if (msg.includes('does not exist')) return true;
  return false;
}

function parseIso(s: string | null | undefined): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function getDeletionsCursor(): string | null {
  const res = safeGet<string | null>(DELETIONS_CURSOR_KEY, null);
  return res.success ? (res.data ?? null) : null;
}

export function setDeletionsCursor(cursorIso: string): void {
  safeSet(DELETIONS_CURSOR_KEY, cursorIso);
}

function getUnsupportedUntil(): number {
  const res = safeGet<number>(DELETIONS_UNSUPPORTED_UNTIL_KEY, 0);
  return res.success ? Number(res.data || 0) : 0;
}

function setUnsupportedUntil(ts: number): void {
  safeSet(DELETIONS_UNSUPPORTED_UNTIL_KEY, ts);
}

/**
 * Puxa tombstones do Supabase e aplica deleções localmente via reposMap.applyRemoteDelete(id).
 * - Não cria outbox
 * - Atualiza cursor incremental
 */
export async function pullAndApplyDeletions(
  supabase: SupabaseClient,
  storeId: string,
  reposMap: Record<string, { applyRemoteDelete: (id: string) => boolean }>
): Promise<{ applied: number; errors: number; supported: boolean }> {
  const now = Date.now();
  const unsupportedUntil = getUnsupportedUntil();
  if (unsupportedUntil && now < unsupportedUntil) {
    return { applied: 0, errors: 0, supported: false };
  }

  let cursor = getDeletionsCursor();
  // Se nunca rodou, começa "do zero". (Pode ser pesado, mas é correto.)
  // Para bases MUITO grandes, você pode setar manualmente o cursor após primeiro sync.
  if (!cursor) cursor = new Date(0).toISOString();

  let applied = 0;
  let errors = 0;
  let supported = true;

  let lastCursor = cursor;

  for (;;) {
    const { data, error } = await supabase
      .from('deletions')
      .select('id, store_id, table_name, record_id, deleted_at')
      .eq('store_id', storeId)
      .gt('deleted_at', lastCursor)
      .order('deleted_at', { ascending: true })
      .limit(PAGE_SIZE);

    if (error) {
      if (isMissingTableError(error)) {
        // Supabase ainda não tem a tabela. Não é fatal.
        supported = false;
        setUnsupportedUntil(Date.now() + UNSUPPORTED_TTL_MS);
        logger.warn('[Deletions] Tabela deletions não existe no Supabase (ainda).');
        break;
      }
      errors++;
      logger.error('[Deletions] Erro ao puxar tombstones:', error);
      break;
    }

    const rows = Array.isArray(data) ? (data as DeletionRow[]) : [];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const repo = reposMap[row.table_name];
      if (repo && typeof repo.applyRemoteDelete === 'function') {
        const ok = repo.applyRemoteDelete(row.record_id);
        if (ok) applied++;
      } else {
        // Tabela não existe no app (ou não tem repo). Ignorar.
      }
      // Cursor sempre avança para não reprocessar.
      lastCursor = row.deleted_at || lastCursor;
    }

    // Paginação: se veio cheio, pode haver mais.
    if (rows.length < PAGE_SIZE) break;
  }

  // Persistir cursor se avançou
  if (parseIso(lastCursor) > parseIso(cursor)) {
    setDeletionsCursor(lastCursor);
  }

  return { applied, errors, supported };
}
