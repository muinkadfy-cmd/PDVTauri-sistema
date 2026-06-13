import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';

const USERS_TABLE = 'usuarios';

export async function canUseDevAdminRemote(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function hasRemoteSession(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data } = await client.auth.getSession();
    return !!data?.session;
  } catch {
    return false;
  }
}

export async function findRemoteDevAdmin(storeId: string): Promise<{ data: any; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) return { data: null, error: { message: 'Cliente Supabase não disponível.' } };

  return await client
    .from(USERS_TABLE)
    .select('id, username')
    .eq('store_id', storeId)
    .eq('username', 'admin')
    .maybeSingle();
}

export async function upsertRemoteDevAdmin(
  storeId: string,
  passwordHash: string
): Promise<{ error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) return { error: { message: 'Cliente Supabase não disponível.' } };

  const { error } = await client
    .from(USERS_TABLE)
    .upsert(
      {
        store_id: storeId,
        username: 'admin',
        password_hash: passwordHash,
        role: 'admin',
        active: true
      },
      { onConflict: 'store_id,username', ignoreDuplicates: true as any }
    );

  return { error };
}
