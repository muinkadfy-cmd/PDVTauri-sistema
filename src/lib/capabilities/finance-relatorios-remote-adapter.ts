import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';

export async function canUseFinanceRelatoriosRemote(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function fetchRemoteFinanceRelatorios(storeId: string): Promise<{ data: any[] | null; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase indisponível' } };
  }

  return await client
    .from('vw_relatorios_financeiros')
    .select('*')
    .eq('store_id', storeId)
    .order('dia', { ascending: false });
}
