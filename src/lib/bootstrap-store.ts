/**
 * Bootstrap de defaults por loja (multitenant)
 * - Garante registro em public.stores (para disparar trigger no Supabase)
 * - Garante defaults em empresa/settings via upsert (fallback)
 *
 * Tudo best-effort: não deve travar o app se falhar.
 */

import { requireRuntimeStoreId } from '@/lib/runtime-context';
import {
  bootstrapRemoteStoreDefaults,
  canUseStoreBootstrapRemote
} from '@/lib/capabilities/store-bootstrap-remote-adapter';

export async function bootstrapCurrentStoreDefaults(): Promise<{ success: boolean; error?: string }> {
  const storeId = requireRuntimeStoreId();
  if (!storeId) {
    return { success: false, error: 'Loja ativa inválida ou ausente no runtime' };
  }

  if (!(await canUseStoreBootstrapRemote())) {
    return { success: false, error: 'Supabase não configurado' };
  }

  return await bootstrapRemoteStoreDefaults(storeId);
}

