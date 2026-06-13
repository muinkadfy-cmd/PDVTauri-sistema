/**
 * Licença remota/Supabase desativada no build desktop.
 *
 * A licença mensal/local e a atualização assinada continuam funcionando sem Supabase.
 */

import { getRuntimeStoreId } from '@/lib/runtime-context';

export type SupabaseClient = any;

export function resolveLicenseStoreId(): string | null {
  return getRuntimeStoreId();
}

export function isLicenseStoreConfigured(): boolean {
  return !!resolveLicenseStoreId();
}

export function isLicenseRemoteConfigured(): boolean {
  return false;
}

export function getLicenseRemoteClient(): null {
  return null;
}

export async function fetchLatestRemoteLicenseByStore(_storeId: string): Promise<{ data: any; error: any }> {
  return { data: null, error: { message: 'Licença remota/Supabase desativada no Desktop.' } };
}


export async function insertRemoteLicense(_payload: Record<string, any>): Promise<{ data: any | null; error: any }> {
  return {
    data: null,
    error: { message: 'Inserção de licença remota desativada no Desktop.' },
  };
}

export async function updateRemoteLicenseByStore(
  _storeId: string,
  _payload: Record<string, any>
): Promise<{ data: any | null; error: any }> {
  return {
    data: null,
    error: { message: 'Atualização de licença remota desativada no Desktop.' },
  };
}
