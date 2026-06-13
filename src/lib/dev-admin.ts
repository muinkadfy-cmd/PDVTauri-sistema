/**
 * Usuário padrão DEV por loja (admin/1234)
 * - Apenas em import.meta.env.DEV
 * - Usa UPSERT por (store_id, username) para evitar duplicidade
 */

import { logger } from '@/utils/logger';
import { createPasswordHash } from '@/lib/auth-supabase';
import { getCurrentStoreId } from '@/lib/store-id';
import {
  canUseDevAdminRemote,
  findRemoteDevAdmin,
  hasRemoteSession,
  upsertRemoteDevAdmin
} from '@/lib/capabilities/dev-admin-remote-adapter';

export async function ensureDevAdmin(): Promise<{ ran: boolean; created: boolean; error?: string }> {
  if (!import.meta.env.DEV) return { ran: false, created: false };

  const storeId = getCurrentStoreId();
  if (!storeId) {
    logger.warn('[DevAdmin] ❌ STORE_ID inválido/ausente. Não é possível garantir admin DEV.');
    return { ran: true, created: false, error: 'STORE_ID inválido/ausente' };
  }

  if (!(await canUseDevAdminRemote())) {
    logger.warn('[DevAdmin] ⚠️ Supabase não configurado. Pulando ensureDevAdmin.');
    return { ran: true, created: false, error: 'Supabase não configurado' };
  }

  // ✅ Não exigir autenticação no Supabase quando o usuário ainda não fez login.
  // Em /login (rota pública), queremos apenas NÃO travar a UI.
  if (!(await hasRemoteSession())) {
    return { ran: true, created: false, error: 'Falha ao ler sessão Supabase' };
  }

  try {
    logger.log('[DevAdmin] 🔍 Verificando admin DEV para store:', storeId);

    const { data: existing, error: selErr } = await findRemoteDevAdmin(storeId);

    if (selErr) {
      logger.warn('[DevAdmin] ⚠️ Erro ao consultar tabela usuarios (talvez não exista ainda):', selErr);
      return { ran: true, created: false, error: selErr.message };
    }

    if (existing) {
      logger.log('[DevAdmin] ✅ Admin DEV já existe. Nenhuma ação.');
      return { ran: true, created: false };
    }

    const password_hash = await createPasswordHash('1234');

    const { error: upsertErr } = await upsertRemoteDevAdmin(storeId, password_hash);

    if (upsertErr) {
      logger.error('[DevAdmin] ❌ Erro ao criar admin DEV:', upsertErr);
      return { ran: true, created: false, error: upsertErr.message };
    }

    logger.log('[DevAdmin] ✅ Admin DEV criado (admin/1234).');
    return { ran: true, created: true };
  } catch (e: any) {
    logger.error('[DevAdmin] ❌ Exceção ao garantir admin DEV:', e);
    return { ran: true, created: false, error: e?.message || 'Erro desconhecido' };
  }
}
