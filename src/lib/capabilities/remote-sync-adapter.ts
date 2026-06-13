import {
  ensureSupabaseAuthenticated,
  ensureSupabaseClient,
  getSupabaseClient,
  isSupabaseOnline
} from '@/lib/supabaseClient';
import { canAttemptRemoteRequest, isRemoteRuntimeConfigured } from '@/lib/capabilities/runtime-remote-adapter';

export async function canUseRemoteSync(): Promise<boolean> {
  if (!isRemoteRuntimeConfigured() || !canAttemptRemoteRequest()) {
    return false;
  }

  const client = await ensureSupabaseClient();
  if (!client) return false;

  try {
    const online = await isSupabaseOnline();
    if (!online) return false;

    const authResult = await ensureSupabaseAuthenticated();
    if (!authResult.success) return false;

    const activeClient = getSupabaseClient();
    if (!activeClient) return false;

    const { data } = await activeClient.auth.getSession();
    return !!data?.session;
  } catch {
    return false;
  }
}

export async function requireRemoteSession(): Promise<void> {
  if (!isRemoteRuntimeConfigured()) {
    throw new Error('Supabase não configurado');
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }

  const authResult = await ensureSupabaseAuthenticated();
  if (!authResult.success) {
    throw new Error(authResult.error || 'Falha ao autenticar no Supabase');
  }

  const activeClient = getSupabaseClient();
  const { data } = await activeClient!.auth.getSession();
  if (!data?.session) {
    throw new Error('No session - not authenticated');
  }
}
