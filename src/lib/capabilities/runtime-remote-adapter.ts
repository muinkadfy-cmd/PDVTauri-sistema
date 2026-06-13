import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getRuntimeStoreId } from '@/lib/runtime-context';

export function isBrowserOnlineSafe(): boolean {
  if (typeof navigator === 'undefined') return true;
  return !!navigator.onLine;
}

export function isRemoteRuntimeConfigured(): boolean {
  return isSupabaseConfigured();
}

export function canAttemptRemoteRequest(): boolean {
  return isBrowserOnlineSafe() && isRemoteRuntimeConfigured();
}

export function getRemoteRuntimeStoreId(): string | null {
  return getRuntimeStoreId();
}
