/**
 * Compat shim:
 * - Mantém imports antigos (`@/lib/supabase`)
 * - Implementação real fica em `@/lib/supabaseClient` (único createClient)
 */

export * from './supabaseClient';
