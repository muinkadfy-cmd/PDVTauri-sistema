import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { logger } from '@/utils/logger';

export async function canUseStoreBootstrapRemote(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function bootstrapRemoteStoreDefaults(
  storeId: string,
  options?: { storeName?: string | null }
): Promise<{ success: boolean; error?: string }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Cliente Supabase não disponível' };
  }

  try {
    const safeName = (options?.storeName?.trim() || `Loja ${storeId.slice(0, 6)}`);

    try {
      await client.from('stores').upsert({ id: storeId, name: safeName }, { onConflict: 'id' });
    } catch (e) {
      if (import.meta.env.DEV) logger.warn('[Bootstrap] upsert stores falhou (seguindo):', e);
    }

    try {
      await client.from('empresa').upsert({ store_id: storeId, nome_fantasia: '' }, { onConflict: 'store_id' });
    } catch (e) {
      if (import.meta.env.DEV) logger.warn('[Bootstrap] upsert empresa falhou (seguindo):', e);
    }

    try {
      await client.from('settings').upsert(
        { store_id: storeId, warranty_terms: '', warranty_terms_pinned: false, warranty_terms_enabled: true },
        { onConflict: 'store_id' }
      );
    } catch (e) {
      if (import.meta.env.DEV) logger.warn('[Bootstrap] upsert settings falhou (seguindo):', e);
    }

    return { success: true };
  } catch (e: any) {
    logger.warn('[Bootstrap] Exceção ao bootstrap defaults:', e);
    return { success: false, error: e?.message || 'Erro desconhecido' };
  }
}
