/**
 * Supabase desativado neste build desktop/Tauri.
 *
 * Motivo:
 * - Smart Tech PDV Desktop oficial = SQLite local / offline-first.
 * - Atualização assinada NÃO depende de Supabase.
 * - Mantemos esta API como "stub" para não quebrar imports antigos enquanto
 *   os módulos legados web/sync são removidos em lotes futuros.
 */

import { logger } from '@/utils/logger';

export type SupabaseClient = any;

export const isSupabaseConfigured = (): boolean => false;

export let supabase: SupabaseClient | null = null;

export async function ensureSupabaseClient(): Promise<SupabaseClient | null> {
  return null;
}

export function getSupabaseClient(): SupabaseClient | null {
  return null;
}

export async function ensureSupabaseAuthenticated(): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: 'Supabase removido/desativado no build desktop offline.',
  };
}

export async function isSupabaseOnline(): Promise<boolean> {
  return false;
}

export async function safeSupabaseQuery<T>(
  _queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any } | null> {
  if (import.meta.env.DEV) {
    logger.info('[Supabase] Query ignorada: módulo remoto desativado no Desktop.');
  }
  return null;
}
