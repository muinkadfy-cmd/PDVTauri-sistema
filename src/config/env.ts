/**
 * Configuração de Ambiente
 * Centraliza acesso às variáveis de ambiente do Vite com validação
 */

/**
 * Regex para validar UUID (qualquer versão)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida se uma string é um UUID válido
 * @param str - String a ser validada
 * @returns true se for UUID válido, false caso contrário
 */
export function isValidUuid(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  return UUID_REGEX.test(str.trim());
}

/**
 * Store ID (multitenant)
 * Prioridade:
 *  a) querystring ?store=UUID (se presente e válido) -> persiste em localStorage("smarttech:storeId")
 *  b) localStorage("smarttech:storeId") (ou legado "active_store_id")
 *  c) VITE_STORE_ID (fallback para modo loja única)
 */
import { getStoreId } from '@/lib/store-id';

const STORE_RESOLVED = getStoreId();
// Se o store_id está explícito porém inválido (URL/localStorage/env), NÃO fazer fallback silencioso.
// Isso força o app a bloquear/avisar em vez de operar na loja errada.
export const STORE_ID =
  STORE_RESOLVED.source === 'invalid'
    ? ''
    : (STORE_RESOLVED.storeId ?? (import.meta.env.DEV ? (import.meta.env.VITE_STORE_ID ?? '') : ''));
export const STORE_ID_SOURCE = STORE_RESOLVED.source;
export const SINGLE_STORE_MODE = (globalThis as any).__SMARTTECH_DESKTOP__ ? true : false;

/**
 * Indica se o Store ID é válido (UUID)
 */
export const STORE_ID_VALID = isValidUuid(STORE_ID);

/**
 * Supabase Configuration
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Indica se Supabase está configurado
 */
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Client ID (Tenant Identifier)
 */
export const CLIENT_ID = import.meta.env.VITE_CLIENT_ID ?? 'local';

// Logs DEV para diagnóstico
if (import.meta.env.DEV) {
  console.log('[Config] Store ID válido:', STORE_ID_VALID ? '✅ Sim' : '❌ Não');
  if (STORE_ID) {
    console.log('[Config] Store ID:', STORE_ID, `(source: ${STORE_RESOLVED.source})`);
  }
  console.log('[Config] Single-store por PC:', SINGLE_STORE_MODE ? '✅ Sim' : 'ℹ️ Web/PWA');
  console.log('[Config] Supabase configurado:', SUPABASE_CONFIGURED ? '✅ Sim' : '❌ Não');
}
