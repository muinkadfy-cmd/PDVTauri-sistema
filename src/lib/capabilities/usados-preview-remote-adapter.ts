import { ensureSupabaseAuthenticated, getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import { downloadRemoteUsadoFile } from '@/lib/capabilities/usados-upload-remote-adapter';

export async function resolveRemoteUsadoPreviewUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const client = getSupabaseClient();
  if (!client) return null;

  const auth = await ensureSupabaseAuthenticated();
  if (!auth.success) return null;

  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (!error && data?.signedUrl) return data.signedUrl;

  const downloaded = await downloadRemoteUsadoFile(bucket, path);
  if (downloaded.data) {
    return URL.createObjectURL(downloaded.data);
  }

  return null;
}
