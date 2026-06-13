import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { StoreAccessRow, StoreAccessRoutes } from '@/lib/store-access';

export async function canUseStoreAccessRemote(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function fetchRemoteStoreAccess(storeId: string): Promise<{ data: StoreAccessRow | null; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase não disponível.' } };
  }

  return await client
    .from('store_access')
    .select('store_id, routes, updated_at, created_at')
    .eq('store_id', storeId)
    .maybeSingle();
}

export async function upsertRemoteStoreAccess(
  storeId: string,
  routes: StoreAccessRoutes
): Promise<{ error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { error: { message: 'Cliente Supabase não disponível.' } };
  }

  const payload = { store_id: storeId, routes };
  const { error } = await client.from('store_access').upsert(payload, { onConflict: 'store_id' });
  return { error };
}
