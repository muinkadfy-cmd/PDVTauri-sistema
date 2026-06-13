import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';

export async function canUseSalesRemoteSync(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function findRemoteVendaById(id: string): Promise<{
  data: { id: string } | null;
  error: any;
}> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase não disponível.' } };
  }

  const result = await client
    .from('vendas')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  return { data: result.data, error: result.error };
}

export async function upsertRemoteVenda(payload: Record<string, any>): Promise<{ error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { error: { message: 'Cliente Supabase não disponível.' } };
  }

  const { error } = await client
    .from('vendas')
    .upsert(payload, { onConflict: 'id' });

  return { error };
}
