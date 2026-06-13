import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';

export async function canUseFornecedoresRemote(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function listRemoteFornecedores(storeId: string): Promise<{ data: any[] | null; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) return { data: null, error: { message: 'Cliente Supabase não disponível.' } };

  return await client
    .from('fornecedores')
    .select('*')
    .eq('store_id', storeId)
    .order('nome', { ascending: true });
}

export async function createRemoteFornecedor(payload: Record<string, any>): Promise<{ data: any; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) return { data: null, error: { message: 'Cliente Supabase não disponível.' } };

  return await client
    .from('fornecedores')
    .insert(payload)
    .select('*')
    .single();
}

export async function updateRemoteFornecedor(
  id: string,
  storeId: string,
  payload: Record<string, any>
): Promise<{ data: any; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) return { data: null, error: { message: 'Cliente Supabase não disponível.' } };

  return await client
    .from('fornecedores')
    .update(payload)
    .eq('id', id)
    .eq('store_id', storeId)
    .select('*')
    .single();
}

export async function deleteRemoteFornecedor(id: string, storeId: string): Promise<{ error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) return { error: { message: 'Cliente Supabase não disponível.' } };

  const { error } = await client
    .from('fornecedores')
    .delete()
    .eq('id', id)
    .eq('store_id', storeId);

  return { error };
}
