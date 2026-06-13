import { requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';

export async function allocateRemoteSequenceRange(params: {
  storeId: string;
  entity: string;
  deviceId: string;
  blockSize: number;
}): Promise<{ data: any; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase não disponível.' } };
  }

  return await client.rpc('allocate_doc_range', {
    p_store_id: params.storeId,
    p_entity: params.entity,
    p_device_id: params.deviceId,
    p_block_size: params.blockSize
  });
}
