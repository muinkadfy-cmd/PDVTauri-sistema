import { ensureSupabaseAuthenticated, getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

export function hasUsadosRemoteStorage(): boolean {
  return isSupabaseConfigured() && !!getSupabaseClient();
}

export async function uploadRemoteUsadoFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ error: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: { message: 'Cliente Supabase indisponível.' } };
  }

  const auth = await ensureSupabaseAuthenticated();
  if (!auth.success) {
    return { error: { message: auth.error || 'Falha ao autenticar no Supabase' } };
  }

  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined
  });

  return { error };
}

export async function downloadRemoteUsadoFile(
  bucket: string,
  path: string
): Promise<{ data: Blob | null; error: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase indisponível.' } };
  }

  const auth = await ensureSupabaseAuthenticated();
  if (!auth.success) {
    return { data: null, error: { message: auth.error || 'Falha ao autenticar no Supabase' } };
  }

  return await client.storage.from(bucket).download(path);
}
