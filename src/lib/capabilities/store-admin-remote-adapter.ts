import { ensureSupabaseAuthenticated, getSupabaseClient } from '@/lib/supabaseClient';

export type StoreAdminRow = { id: string; name: string; created_at: string };
export type StoreAdminLicenseRow = {
  store_id: string;
  plan: string;
  status: string;
  expires_at?: string | null;
  updated_at?: string;
  created_at?: string;
};

async function requireStoreAdminClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cliente Supabase indisponivel');

  const auth = await ensureSupabaseAuthenticated();
  if (!auth.success) {
    throw new Error(auth.error || 'Falha ao autenticar no Supabase');
  }

  return client;
}

export async function listAdminStores(): Promise<StoreAdminRow[]> {
  const client = await requireStoreAdminClient();
  const { data, error } = await client
    .from('stores')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as StoreAdminRow[];
}

export async function listAdminLicenses(storeIds: string[]): Promise<StoreAdminLicenseRow[]> {
  if (!storeIds.length) return [];

  const client = await requireStoreAdminClient();
  const { data, error } = await client
    .from('licenses')
    .select('store_id, plan, status, expires_at, updated_at, created_at')
    .in('store_id', storeIds);

  if (error) throw error;
  return (data || []) as StoreAdminLicenseRow[];
}

export async function createAdminStore(id: string, name: string): Promise<void> {
  const client = await requireStoreAdminClient();
  const { error } = await client.from('stores').insert({ id, name });
  if (error) throw error;
}

export async function upsertAdminLicense(
  storeId: string,
  payload: Partial<StoreAdminLicenseRow>
): Promise<void> {
  const client = await requireStoreAdminClient();
  const body = {
    store_id: storeId,
    plan: payload.plan ?? 'trial',
    status: payload.status ?? 'active',
    expires_at: payload.expires_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from('licenses').upsert(body, { onConflict: 'store_id' });
  if (error) throw error;
}
