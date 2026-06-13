/**
 * License Service - Validação de Licença pelo Supabase
 * Fonte de verdade: Supabase (servidor)
 * Cache local: apenas para modo offline (tolerância de 3 dias)
 */

import { safeGet, safeSet } from './storage';
import { logger } from '@/utils/logger';
import {
  fetchLatestRemoteLicenseByStore,
  isLicenseRemoteConfigured,
  insertRemoteLicense,
  resolveLicenseStoreId,
  updateRemoteLicenseByStore
} from '@/lib/capabilities/license-remote-adapter';
import {
  isBrowserOnlineSafe,
} from '@/lib/capabilities/runtime-remote-adapter';

/**
 * Cache em memória para evitar chamadas repetidas ao Supabase ao navegar entre rotas.
 * Mantém compatibilidade e reduz carga (especialmente em AuthGuard).
 */
const LICENSE_MEMO_TTL_MS = 20_000; // 20s (seguro e responsivo)
let _licenseMemo: { storeId: string; at: number; value: LicenseStatus } | null = null;


export interface LicenseData {
  id: string;
  store_id: string;
  plan: string;
  status: 'active' | 'expired' | 'blocked';
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicenseStatus {
  valid: boolean;
  status: 'active' | 'expired' | 'blocked' | 'not_found' | 'offline';
  expires_at?: string;
  daysRemaining?: number;
  message: string;
  lastValidatedAt?: string;
  source: 'supabase' | 'cache';
}

const LICENSE_CACHE_KEY = 'smart-tech-license-cache';
// Cache usado pelo AuthGuard (compatibilidade)
// AuthGuard lê apenas do localStorage, então mantemos este espelho.
const AUTH_GUARD_LICENSE_KEY = 'smart-tech:license-status';
const OFFLINE_TOLERANCE_DAYS = 3; // 3 dias de tolerância offline

interface LicenseCache {
  license: LicenseData | null;
  lastValidatedAt: string;
  validated: boolean;
}

/**
 * Busca licença do Supabase para o store_id atual
 */
export async function fetchLicenseFromSupabase(): Promise<LicenseData | null> {
  const storeId = resolveLicenseStoreId();
  if (!storeId) {
    if (import.meta.env.DEV) {
      logger.warn('[LicenseService] ❌ Store ID inválido/ausente, não é possível buscar licença');
    }
    return null;
  }

  if (!isLicenseRemoteConfigured()) {
    if (import.meta.env.DEV) {
      logger.log('[LicenseService] ⚠️ Supabase não configurado, usando cache local');
    }
    return null;
  }

  try {
    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] 🔍 Buscando licença do Supabase para store_id: ${storeId}`);
    }

    const { data, error } = await fetchLatestRemoteLicenseByStore(storeId);

    if (error) {
      // PGRST116 = nenhum resultado encontrado (não é erro crítico)
      if (error.code === 'PGRST116') {
        if (import.meta.env.DEV) {
          logger.log('[LicenseService] ℹ️ Nenhuma licença ativa encontrada no Supabase para este store_id');
        }
        return null;
      }
      
      if (import.meta.env.DEV) {
        logger.error('[LicenseService] ❌ Erro ao buscar licença do Supabase:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      } else {
        logger.error('[LicenseService] Erro ao buscar licença:', error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    // Plano lifetime: não expira
    if ((data.plan || '').toLowerCase() === 'lifetime' || data.expires_at == null) {
      return data as LicenseData;
    }

    // Validar se licença ainda está válida (não expirada)
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (expiresAt < now) {
      if (import.meta.env.DEV) {
        logger.warn(`[LicenseService] ⚠️ Licença encontrada mas expirada: ${data.id}`);
        logger.warn(`[LicenseService] Data de expiração: ${expiresAt.toLocaleDateString('pt-BR')}`);
      }
      return null;
    }

    if (import.meta.env.DEV) {
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      logger.log(`[LicenseService] ✅ Licença encontrada: ${data.id}`);
      logger.log(`[LicenseService] 📅 Válida até: ${expiresAt.toLocaleDateString('pt-BR')} (${daysRemaining} dias restantes)`);
      logger.log(`[LicenseService] 📦 Plano: ${data.plan}, Status: ${data.status}`);
    }

    return data as LicenseData;
  } catch (error) {
    logger.error('[LicenseService] Exceção ao buscar licença:', error);
    return null;
  }
}

/**
 * Salva licença no cache local
 */
function saveLicenseCache(license: LicenseData | null): void {
  const cache: LicenseCache = {
    license,
    lastValidatedAt: new Date().toISOString(),
    validated: license !== null
  };
  safeSet(LICENSE_CACHE_KEY, cache);
}

/**
 * Espelha o status da licença no formato esperado pelo AuthGuard.
 * Mantém o app consistente mesmo quando outras telas usam o cache do license-service.
 */
function saveAuthGuardLicenseStatus(payload: {
  status: 'active' | 'permanent' | 'expired' | 'blocked' | 'not_found' | 'offline';
  expiresAt?: string | null;
  daysRemaining?: number;
  lastValidatedAt?: string;
  source?: 'supabase' | 'cache';
}) {
  try {
    localStorage.setItem(
      AUTH_GUARD_LICENSE_KEY,
      JSON.stringify({
        status: payload.status,
        expiresAt: payload.expiresAt ?? null,
        daysRemaining: payload.daysRemaining,
        lastValidatedAt: payload.lastValidatedAt ?? new Date().toISOString(),
        source: payload.source ?? 'cache'
      })
    );
  } catch {
    // ignore
  }
}

/**
 * Obtém licença do cache local
 */
export function getLicenseCache(): LicenseCache | null {
  const result = safeGet<LicenseCache>(LICENSE_CACHE_KEY, null);
  return result.success && result.data ? result.data : null;
}

/**
 * Verifica se cache ainda é válido para modo offline
 */
function isCacheValidForOffline(cache: LicenseCache | null): boolean {
  if (!cache || !cache.license) {
    return false;
  }

  const lastValidatedAt = new Date(cache.lastValidatedAt);
  const now = new Date();
  const daysSinceValidation = (now.getTime() - lastValidatedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Cache válido se:
  // 1. Foi validado há menos de 3 dias
  // 2. Licença ainda não expirou
  const isWithinTolerance = daysSinceValidation < OFFLINE_TOLERANCE_DAYS;

  // Lifetime (ou sem expires_at): não expira
  const isLifetime =
    (cache.license.plan || '').toLowerCase() === 'lifetime' || cache.license.expires_at == null;

  const isNotExpired = isLifetime
    ? true
    : new Date(cache.license.expires_at as string).getTime() > now.getTime();

  return isWithinTolerance && isNotExpired && cache.validated;
}

/**
 * Valida licença (busca do Supabase ou usa cache se offline)
 */
export async function validateLicenseFromServer(): Promise<LicenseStatus> {
  const storeId = resolveLicenseStoreId();
  if (!storeId) {
    const out: LicenseStatus = {
      valid: false,
      status: 'not_found',
      message: 'Seu periodo de teste nao esta ativo nesta loja. Fale no WhatsApp (43) 99669-4751 para liberar o sistema.',
      source: 'cache'
    };
    saveAuthGuardLicenseStatus({ status: 'not_found', source: 'cache' });
    _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
    return out;
  }


  // Cache em memória (TTL curto) para evitar chamadas repetidas ao servidor durante navegação
  const nowMs = Date.now();
  if (_licenseMemo && _licenseMemo.storeId === String(storeId) && (nowMs - _licenseMemo.at) < LICENSE_MEMO_TTL_MS) {
    return _licenseMemo.value;
  }

  // Tentar buscar do Supabase (se online)
  const isOnline = isBrowserOnlineSafe() && isLicenseRemoteConfigured();
  
  if (isOnline) {
    const license = await fetchLicenseFromSupabase();
    
    if (license) {
      // Salvar no cache
      saveLicenseCache(license);

      // Bloqueada pelo administrador
      if ((license.status || '').toLowerCase() === 'blocked') {
        const out: LicenseStatus = {
          valid: false,
          status: 'blocked',
          message: 'Loja bloqueada para operacao. Fale no WhatsApp (43) 99669-4751 para reativar o acesso.',
          lastValidatedAt: new Date().toISOString(),
          source: 'supabase'
        };
        saveAuthGuardLicenseStatus({ status: 'blocked', source: 'supabase', lastValidatedAt: out.lastValidatedAt });
    _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
        return out;
      }

      // Lifetime: sem expiração (somente se ativa)
      if ((license.plan || '').toLowerCase() === 'lifetime' || license.expires_at == null) {
        const out: LicenseStatus = {
          valid: true,
          status: 'active',
          message: 'Licença permanente (lifetime)',
          lastValidatedAt: new Date().toISOString(),
          source: 'supabase'
        };
        saveAuthGuardLicenseStatus({ status: 'permanent', source: 'supabase', lastValidatedAt: out.lastValidatedAt });
    _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
        return out;
      }

      const expiresAt = new Date(license.expires_at);
      const now = new Date();

      // Expirada
      if (expiresAt < now) {
        const out: LicenseStatus = {
          valid: false,
          status: 'expired',
          expires_at: license.expires_at,
          daysRemaining: 0,
          message: `O teste da loja terminou em ${expiresAt.toLocaleDateString('pt-BR')}. Fale no WhatsApp (43) 99669-4751 para ativar.`,
          lastValidatedAt: new Date().toISOString(),
          source: 'supabase'
        };
        saveAuthGuardLicenseStatus({ status: 'expired', source: 'supabase', expiresAt: license.expires_at, daysRemaining: 0, lastValidatedAt: out.lastValidatedAt });
    _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
        return out;
      }

      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const out: LicenseStatus = {
        valid: true,
        status: 'active',
        expires_at: license.expires_at,
        daysRemaining,
        message:
          daysRemaining > 30
            ? `Licença válida até ${expiresAt.toLocaleDateString('pt-BR')}`
            : daysRemaining > 0
              ? `Licença expira em ${daysRemaining} dia(s)`
              : 'Licença válida',
        lastValidatedAt: new Date().toISOString(),
        source: 'supabase'
      };
      saveAuthGuardLicenseStatus({ status: 'active', source: 'supabase', expiresAt: license.expires_at, daysRemaining, lastValidatedAt: out.lastValidatedAt });
      _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
      return out;
    } else {
      // Nenhuma licença encontrada - limpar cache
      saveLicenseCache(null);
      
      const out: LicenseStatus = {
        valid: false,
        status: 'not_found',
        message: 'Nenhuma licenca ativa encontrada para esta loja. Fale no WhatsApp (43) 99669-4751 para liberar o sistema.',
        source: 'supabase'
      };
      saveAuthGuardLicenseStatus({ status: 'not_found', source: 'supabase' });
      _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
      return out;
    }
  }

  // Offline: usar cache se válido
  const cache = getLicenseCache();
  
  if (isCacheValidForOffline(cache)) {
    const license = cache!.license!;
    const now = new Date();
    const daysSinceValidation = (now.getTime() - new Date(cache!.lastValidatedAt).getTime()) / (1000 * 60 * 60 * 24);

    // Lifetime (ou sem expires_at): não expira
    if ((license.plan || '').toLowerCase() === 'lifetime' || license.expires_at == null) {
      const out: LicenseStatus = {
        valid: true,
        status: 'active',
        message: `Licença permanente (modo offline, validada há ${Math.floor(daysSinceValidation)} dia(s))`,
        lastValidatedAt: cache!.lastValidatedAt,
        source: 'cache'
      };
      saveAuthGuardLicenseStatus({ status: 'permanent', source: 'cache', lastValidatedAt: out.lastValidatedAt });
    _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
      return out;
    }

    const expiresAt = new Date(license.expires_at as string);
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const out: LicenseStatus = {
      valid: true,
      status: 'active',
      expires_at: license.expires_at ?? undefined,
      daysRemaining,
      message: `Licença válida (modo offline, validada há ${Math.floor(daysSinceValidation)} dia(s))`,
      lastValidatedAt: cache!.lastValidatedAt,
      source: 'cache'
    };
    saveAuthGuardLicenseStatus({ status: 'active', source: 'cache', expiresAt: license.expires_at, daysRemaining, lastValidatedAt: out.lastValidatedAt });
      _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
    return out;
  }

  // Cache inválido ou expirado
  const out: LicenseStatus = {
    valid: false,
    status: 'offline',
    message: `Modo offline: cache expirado ou inválido. Conecte-se à internet para validar licença.`,
    source: 'cache'
  };
  saveAuthGuardLicenseStatus({ status: 'offline', source: 'cache' });
      _licenseMemo = { storeId: String(storeId), at: Date.now(), value: out };
  return out;
}

/**
 * Força validação da licença (ignora cache)
 */
export async function forceValidateLicense(): Promise<LicenseStatus> {
  // Limpar memo e caches para forçar busca do servidor
  _licenseMemo = null;
  try {
    localStorage.removeItem(LICENSE_CACHE_KEY);
    localStorage.removeItem(AUTH_GUARD_LICENSE_KEY);
  } catch {
    // ignore
  }
  const wasOffline = !isBrowserOnlineSafe();
  
  // Se estava offline, tentar novamente
  if (wasOffline && isBrowserOnlineSafe()) {
    if (import.meta.env.DEV) {
      logger.log('[LicenseService] Forçando validação da licença (online agora)');
    }
  }
  
  return await validateLicenseFromServer();
}

/**
 * Verifica se licença está ativa (para uso em guards)
 */
export async function isLicenseActiveFromServer(): Promise<boolean> {
  const status = await validateLicenseFromServer();
  return status.valid && status.status === 'active';
}

/**
 * Ativa ou atualiza licença no Supabase
 * Se já existir registro para o store_id, atualiza para active e adiciona +30 dias
 * Se não existir, cria novo registro
 * 
 * @param code - Código da licença (opcional, para referência)
 * @param validUntil - Data de validade (ISO string). Se não fornecida, usa +30 dias a partir de agora
 * @returns Promise com resultado da operação
 */
/**
 * Ativa licença de teste (15 dias) diretamente no Supabase
 */
export async function activateTrialLicense(): Promise<{ success: boolean; error?: string; license?: LicenseData }> {
  const storeId = resolveLicenseStoreId();
  if (!storeId) {
    return {
      success: false,
      error: 'Entre em contato pelo WhatsApp (43) 99669-4751 para ativar sua licença.'
    };
  }

  if (!isLicenseRemoteConfigured()) {
    return {
      success: false,
      error: 'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    };
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15);
    expiresAt.setHours(23, 59, 59, 999);

    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] 🔄 Ativando licença de teste (15 dias) no Supabase para store_id: ${storeId}`);
    }

    // Verificar se já existe licença
    const { data: existing } = await fetchLatestRemoteLicenseByStore(storeId);

    let data, error;
    
    if (existing) {
      // Atualizar licença existente
      const { data: updateData, error: updateError } = await updateRemoteLicenseByStore(storeId, {
          plan: 'trial',
          status: 'active',
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        });
      data = updateData;
      error = updateError;
    } else {
      // Criar nova licença
      const { data: insertData, error: insertError } = await insertRemoteLicense({
          store_id: storeId,
          plan: 'trial',
          status: 'active',
          expires_at: expiresAt.toISOString()
        });
      data = insertData;
      error = insertError;
    }

    if (error) {
      if (import.meta.env.DEV) {
        logger.error('[LicenseService] ❌ Erro ao ativar licença de teste:', error);
      }
      return {
        success: false,
        error: `Erro ao ativar licença: ${error.message}${error.hint ? ` (${error.hint})` : ''}${error.code ? ` [${error.code}]` : ''}`
      };
    }

    saveLicenseCache(data as LicenseData);

    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] ✅ Licença de teste ativada com sucesso!`);
      logger.log(`[LicenseService] 📅 Válida até: ${expiresAt.toLocaleDateString('pt-BR')}`);
    }

    return {
      success: true,
      license: data as LicenseData
    };
  } catch (error: any) {
    if (import.meta.env.DEV) {
      logger.error('[LicenseService] ❌ Exceção ao ativar licença de teste:', error);
    }
    return {
      success: false,
      error: `Erro inesperado: ${error?.message || 'Erro desconhecido'}`
    };
  }
}

/**
 * Ativa licença permanente (vitalícia) diretamente no Supabase
 */
export async function activateLifetimeLicense(): Promise<{ success: boolean; error?: string; license?: LicenseData }> {
  const storeId = resolveLicenseStoreId();
  if (!storeId) {
    return {
      success: false,
      error: 'Entre em contato pelo WhatsApp (43) 99669-4751 para ativar sua licença.'
    };
  }

  if (!isLicenseRemoteConfigured()) {
    return {
      success: false,
      error: 'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    };
  }

  try {
    // Licença vitalícia: data muito distante (31/12/2099)
    const expiresAt = new Date('2099-12-31T23:59:59.999Z');

    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] 🔄 Ativando licença vitalícia no Supabase para store_id: ${storeId}`);
    }

    // Verificar se já existe licença
    const { data: existing } = await fetchLatestRemoteLicenseByStore(storeId);

    let data, error;
    
    if (existing) {
      // Atualizar licença existente
      const { data: updateData, error: updateError } = await updateRemoteLicenseByStore(storeId, {
          plan: 'lifetime',
          status: 'active',
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        });
      data = updateData;
      error = updateError;
    } else {
      // Criar nova licença
      const { data: insertData, error: insertError } = await insertRemoteLicense({
          store_id: storeId,
          plan: 'lifetime',
          status: 'active',
          expires_at: expiresAt.toISOString()
        });
      data = insertData;
      error = insertError;
    }

    if (error) {
      if (import.meta.env.DEV) {
        logger.error('[LicenseService] ❌ Erro ao ativar licença vitalícia:', error);
      }
      return {
        success: false,
        error: `Erro ao ativar licença: ${error.message}${error.hint ? ` (${error.hint})` : ''}${error.code ? ` [${error.code}]` : ''}`
      };
    }

    saveLicenseCache(data as LicenseData);

    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] ✅ Licença vitalícia ativada com sucesso!`);
    }

    return {
      success: true,
      license: data as LicenseData
    };
  } catch (error: any) {
    if (import.meta.env.DEV) {
      logger.error('[LicenseService] ❌ Exceção ao ativar licença vitalícia:', error);
    }
    return {
      success: false,
      error: `Erro inesperado: ${error?.message || 'Erro desconhecido'}`
    };
  }
}

/**
 * Desativa/remove a licença: marca como expirada no Supabase e limpa o cache local.
 * Após isso, a validação passa a retornar "not_found".
 */
export async function deactivateLicense(): Promise<{ success: boolean; error?: string }> {
  const storeId = resolveLicenseStoreId();
  if (!storeId) {
    return {
      success: false,
      error: 'Store ID não configurado. Não é possível remover a licença.'
    };
  }

  if (!isLicenseRemoteConfigured()) {
    return {
      success: false,
      error: 'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para remover a licença.'
    };
  }

  try {
    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] 🗑️ Desativando licença no Supabase para store_id: ${storeId}`);
    }

    const { error } = await updateRemoteLicenseByStore(storeId, {
        status: 'expired',
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (import.meta.env.DEV) {
        logger.error('[LicenseService] ❌ Erro ao desativar licença:', error);
      }
      return {
        success: false,
        error: `Erro ao remover licença: ${error.message}${error.hint ? ` (${error.hint})` : ''}${error.code ? ` [${error.code}]` : ''}`
      };
    }

    saveLicenseCache(null);

    if (import.meta.env.DEV) {
      logger.log('[LicenseService] ✅ Licença desativada (status=expired) e cache limpo.');
    }

    return { success: true };
  } catch (error: any) {
    if (import.meta.env.DEV) {
      logger.error('[LicenseService] ❌ Exceção ao desativar licença:', error);
    }
    return {
      success: false,
      error: `Erro inesperado: ${error?.message || 'Erro desconhecido'}`
    };
  }
}

export async function activateLicenseInSupabase(
  code?: string,
  validUntil?: string
): Promise<{ success: boolean; error?: string; license?: LicenseData }> {
  const storeId = resolveLicenseStoreId();
  if (!storeId) {
    return {
      success: false,
      error: 'Entre em contato pelo WhatsApp (43) 99669-4751 para ativar sua licença.'
    };
  }

  if (!isLicenseRemoteConfigured()) {
    return {
      success: false,
      error: 'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    };
  }

  try {
    // Licença vitalícia: usar data fornecida ou data muito distante (31/12/2099)
    const expiresAt = validUntil 
      ? new Date(validUntil)
      : new Date('2099-12-31T23:59:59.999Z');

    if (isNaN(expiresAt.getTime())) {
      return {
        success: false,
        error: 'Data de validade inválida.'
      };
    }

    if (import.meta.env.DEV) {
      logger.log(`[LicenseService] 🔄 Ativando licença vitalícia no Supabase para store_id: ${storeId}`);
      logger.log(`[LicenseService] ♾️ Data de validade: ${expiresAt.toISOString()} (vitalícia)`);
    }

    // Verificar se já existe licença para este store_id
    const { data: existingLicense, error: fetchError } = await fetchLatestRemoteLicenseByStore(storeId);

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = nenhum resultado (não é erro)
      if (import.meta.env.DEV) {
        logger.error('[LicenseService] ❌ Erro ao verificar licença existente:', fetchError);
      }
      return {
        success: false,
        error: `Erro ao verificar licença: ${fetchError.message}`
      };
    }

    let result;
    
    if (existingLicense) {
      // Atualizar licença existente
      if (import.meta.env.DEV) {
        logger.log(`[LicenseService] 📝 Atualizando licença existente: ${existingLicense.id}`);
      }

      // Se já está ativa, adiciona +30 dias a partir da data atual de expiração
      // Se está expirada/bloqueada, renova a partir de agora
      const currentExpiresAt = new Date(existingLicense.expires_at);
      const newExpiresAt = existingLicense.status === 'active' && currentExpiresAt > new Date()
        ? (() => {
            const newDate = new Date(currentExpiresAt);
            newDate.setDate(newDate.getDate() + (import.meta.env.DEV ? 30 : 365));
            return newDate;
          })()
        : expiresAt;

      const { data, error } = await updateRemoteLicenseByStore(storeId, {
          status: 'active',
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        if (import.meta.env.DEV) {
          logger.error('[LicenseService] ❌ Erro ao atualizar licença:', error);
        }
        return {
          success: false,
          error: `Erro ao atualizar licença: ${error.message}`
        };
      }

      result = data;
    } else {
      // Criar nova licença
      if (import.meta.env.DEV) {
        logger.log(`[LicenseService] ➕ Criando nova licença para store_id: ${storeId}`);
      }

      const { data, error } = await insertRemoteLicense({
          store_id: storeId,
          plan: 'standard',
          status: 'active',
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        if (import.meta.env.DEV) {
          logger.error('[LicenseService] ❌ Erro ao criar licença:', error);
        }
        return {
          success: false,
          error: `Erro ao criar licença: ${error.message}`
        };
      }

      result = data;
    }

    // Atualizar cache local
    saveLicenseCache(result as LicenseData);

    if (import.meta.env.DEV) {
      const daysRemaining = Math.ceil((new Date(result.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      logger.log(`[LicenseService] ✅ Licença ${existingLicense ? 'atualizada' : 'criada'} com sucesso!`);
      logger.log(`[LicenseService] 📅 Válida até: ${new Date(result.expires_at).toLocaleDateString('pt-BR')} (${daysRemaining} dias)`);
    }

    return {
      success: true,
      license: result as LicenseData
    };
  } catch (error: any) {
    if (import.meta.env.DEV) {
      logger.error('[LicenseService] ❌ Exceção ao ativar licença:', error);
    }
    return {
      success: false,
      error: `Erro inesperado: ${error?.message || 'Erro desconhecido'}`
    };
  }
}

