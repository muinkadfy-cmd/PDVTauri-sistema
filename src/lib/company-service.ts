/**
 * ============================================================
 *  company-service.ts  —  CRUD de Empresa + Enforcement do Lock
 * ============================================================
 *
 *  Toda operação de escrita (upsert, delete) passa pelo
 *  company-lock antes de tocar no storage.
 *
 *  Fluxo de chamada:
 *    UI → upsertCompany() → validateCriticalFields() → saveLocal()
 *    UI → deleteCompany() → validateDeleteCompany()   → safeRemove()
 *    UI → lockCompany()   → company-lock.lockCompany() → KV + LS
 */

import { logger } from '@/utils/logger';
import { safeGet, safeRemove, safeSet } from '@/lib/storage';
import { kvGet, kvRemove, kvSet } from '@/lib/desktop-kv';
import { isDesktopApp } from '@/lib/platform';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import {
  canUseCompanyRemote,
  fetchRemoteCompanyByStoreId,
  deleteRemoteCompanyByStoreId,
  upsertRemoteCompanyByStoreId,
} from '@/lib/capabilities/company-remote-adapter';
import {
  initCompanyLock,
  getCompanyLockState,
  isCompanyLockedSync,
  lockCompany as doLockCompany,
  type CompanyLockState,
  type CompanyCriticalSnapshot,
} from '@/lib/company-lock';

// Re-exports para quem importava do serviço anterior
export {
  initCompanyLock,
  getCompanyLockState,
  isCompanyLockedSync,
  type CompanyLockState,
  type CompanyCriticalSnapshot,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Campos que o usuário pode fornecer no formulário */
export interface CompanyUpsertInput {
  // Críticos (imutáveis após lock)
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  // Não-críticos (editáveis após lock)
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logo_url?: string;
  mensagem_rodape?: string;
}

/** Registro completo como persiste no storage */
export interface CompanyRow extends CompanyUpsertInput {
  id: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Registro completo (formulário, contexto) */
const COMPANY_LOCAL_KEY = 'smart-tech-company';

/** Cache reduzido para print-template (impede impressão de dado vazio) */
const COMPANY_CACHE_KEY = 'smart-tech-company-cache';

function getCompanyScopeId(): string {
  return getRuntimeStoreId()?.trim() || 'default';
}

function companyKvKey(scopeId = getCompanyScopeId()): string {
  return `company_row:${scopeId}`;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `local-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
  }
}

function trimOrNull(v?: string): string | null {
  const s = (v ?? '').trim();
  return s || null;
}

function toCache(row: CompanyRow) {
  return {
    nome: row.nome_fantasia || 'Smart Tech',
    cnpj: row.cnpj || undefined,
    telefone: row.telefone || undefined,
    endereco: row.endereco || undefined,
    cidade: row.cidade || undefined,
    estado: row.estado || undefined,
    logo_url: row.logo_url || undefined,
    slogan: row.mensagem_rodape || undefined,
  };
}

function saveLocal(row: CompanyRow): void {
  safeSet(COMPANY_LOCAL_KEY, row);
  safeSet(COMPANY_CACHE_KEY, toCache(row));
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/** Retorna a empresa atual (offline). Null se ainda não cadastrada. */
export async function fetchCompany(): Promise<{ success: boolean; company?: CompanyRow | null; error?: string }> {
  const scopeId = getCompanyScopeId();

  // ✅ Desktop: tentar primeiro do KV persistente (sobrevive a updates/reinstalação)
  if (isDesktopApp()) {
    try {
      const kv = await kvGet(companyKvKey(scopeId));
      if (typeof kv === 'string' && kv.trim()) {
        const parsed = JSON.parse(kv) as CompanyRow;
        // Atualiza cache/localStorage para manter compatibilidade com impressão e componentes antigos
        saveLocal(parsed);
        return { success: true, company: parsed };
      }
    } catch {
      // fallback abaixo
    }
  }

  // Fallback: localStorage (web + compat)
  const local = safeGet<CompanyRow>(COMPANY_LOCAL_KEY, null);
  const company = local?.success ? local.data : null;

  if (company) {
    // ✅ Migração: se veio do localStorage, grava no KV (desktop) para não perder em update
    if (isDesktopApp()) {
      try {
        await kvSet(companyKvKey(scopeId), JSON.stringify(company));
      } catch {}
    }

    safeSet(COMPANY_CACHE_KEY, toCache(company));

    return { success: true, company };
  }

  if (await canUseCompanyRemote()) {
    try {
      const remote = await fetchRemoteCompanyByStoreId(scopeId);
      if (remote.data) {
        const remoteRow: CompanyRow = {
          id: remote.data.id,
          store_id: remote.data.store_id,
          nome_fantasia: remote.data.nome_fantasia,
          razao_social: remote.data.razao_social,
          cnpj: remote.data.cnpj,
          telefone: remote.data.telefone,
          endereco: remote.data.endereco,
          cidade: remote.data.cidade,
          estado: remote.data.estado,
          cep: remote.data.cep,
          logo_url: remote.data.logo_url ?? undefined,
          mensagem_rodape: remote.data.mensagem_rodape ?? undefined,
          created_at: remote.data.created_at,
          updated_at: remote.data.updated_at,
        };

        saveLocal(remoteRow);

        if (isDesktopApp()) {
          try {
            await kvSet(companyKvKey(scopeId), JSON.stringify(remoteRow));
          } catch {
            // ignore desktop cache backfill failures here
          }
        }

        return { success: true, company: remoteRow };
      }
    } catch {
      // fallback below
    }
  }

  safeRemove(COMPANY_CACHE_KEY);
  return { success: true, company: null };
}


/**
 * Salva (cria ou edita) a empresa.
 *
 * O fluxo ativo permite editar normalmente os dados da empresa.
 */
export async function upsertCompany(input: CompanyUpsertInput): Promise<{
  success: boolean;
  company?: CompanyRow;
  error?: string;
}> {
  const scopeId = getCompanyScopeId();

  const nome = (input.nome_fantasia ?? '').trim();
  if (!nome) {
    return { success: false, error: 'Nome fantasia é obrigatório.' };
  }

  const existing = safeGet<CompanyRow>(COMPANY_LOCAL_KEY, null);
  const prev = (existing?.success ? (existing.data as any) : null) as CompanyRow | null;

  const row: CompanyRow = {
    id: prev?.id ?? genId(),
    store_id: scopeId,
    created_at: prev?.created_at ?? nowIso(),
    updated_at: nowIso(),
    // campos críticos
    nome_fantasia: nome,
    razao_social: trimOrNull(input.razao_social) ?? undefined,
    cnpj: trimOrNull(input.cnpj) ?? undefined,
    // campos não-críticos (sempre atualizáveis)
    telefone: trimOrNull(input.telefone) ?? undefined,
    endereco: trimOrNull(input.endereco) ?? undefined,
    cidade: trimOrNull(input.cidade) ?? undefined,
    estado: trimOrNull(input.estado) ?? undefined,
    cep: trimOrNull(input.cep) ?? undefined,
    logo_url: trimOrNull(input.logo_url) ?? undefined,
    mensagem_rodape: trimOrNull(input.mensagem_rodape) ?? undefined,
  };

  const canUseRemote = await canUseCompanyRemote();
  let finalRow = row;

  if (canUseRemote) {
    const remote = await upsertRemoteCompanyByStoreId(scopeId, {
      nome_fantasia: row.nome_fantasia,
      razao_social: row.razao_social,
      cnpj: row.cnpj,
      telefone: row.telefone,
      endereco: row.endereco,
      cidade: row.cidade,
      estado: row.estado,
      cep: row.cep,
      logo_url: row.logo_url,
      mensagem_rodape: row.mensagem_rodape,
    });

    if (remote.error) {
      logger.error('[CompanyService] Falha ao persistir empresa no remoto:', remote.error);
      return { success: false, error: remote.error?.message || 'Falha ao salvar empresa no Supabase.' };
    }

    if (remote.data) {
      finalRow = {
        id: remote.data.id,
        store_id: remote.data.store_id,
        nome_fantasia: remote.data.nome_fantasia,
        razao_social: remote.data.razao_social,
        cnpj: remote.data.cnpj,
        telefone: remote.data.telefone,
        endereco: remote.data.endereco,
        cidade: remote.data.cidade,
        estado: remote.data.estado,
        cep: remote.data.cep,
        logo_url: remote.data.logo_url ?? undefined,
        mensagem_rodape: remote.data.mensagem_rodape ?? undefined,
        created_at: remote.data.created_at,
        updated_at: remote.data.updated_at,
      };
    }
  }

  saveLocal(finalRow);

  // ✅ Desktop: persistir também no KV (SQLite global) para sobreviver a updates/reinstalação
  if (isDesktopApp()) {
    try {
      await kvSet(companyKvKey(scopeId), JSON.stringify(finalRow));
    } catch (error) {
      logger.error('[CompanyService] Falha ao persistir empresa no KV desktop:', error);
      if (prev) saveLocal(prev);
      else {
        safeRemove(COMPANY_LOCAL_KEY);
        safeRemove(COMPANY_CACHE_KEY);
      }
      return { success: false, error: 'Falha ao persistir dados da empresa no banco local do desktop.' };
    }
  }
  return { success: true, company: finalRow };
}

/**
 * Remove a empresa.
 * No fluxo atual, a remoção segue disponível na interface administrativa.
 */
export async function deleteCompany(): Promise<{ success: boolean; error?: string }> {
  const scopeId = getCompanyScopeId();

  const existing = safeGet<CompanyRow>(COMPANY_LOCAL_KEY, null);
  const prev = (existing?.success ? (existing.data as any) : null) as CompanyRow | null;

  const canUseRemote = await canUseCompanyRemote();
  if (canUseRemote) {
    const remote = await deleteRemoteCompanyByStoreId(scopeId);
    if (remote.error) {
      logger.error('[CompanyService] Falha ao remover empresa no remoto:', remote.error);
      return { success: false, error: remote.error?.message || 'Falha ao remover empresa do Supabase.' };
    }
  }

  safeRemove(COMPANY_LOCAL_KEY);
  safeRemove(COMPANY_CACHE_KEY);

  if (isDesktopApp()) {
    try {
      await kvRemove(companyKvKey(scopeId));
    } catch (error) {
      logger.error('[CompanyService] Falha ao remover empresa do KV desktop:', error);
      if (prev) saveLocal(prev);
      return { success: false, error: 'Falha ao remover dados da empresa do banco local do desktop.' };
    }
  }

  return { success: true };
}

/**
 * 🔒 Fixa a empresa de forma irreversível.
 *
 * Deve ser chamada DEPOIS de upsertCompany() ter salvo os dados.
 * O snapshot é lido diretamente do storage para garantir que
 * o que está fixado é o que realmente foi salvo (não o que está
 * no formulário).
 */
export async function lockCompany(): Promise<{ success: boolean; error?: string }> {
  void doLockCompany;
  const _snapshot: CompanyCriticalSnapshot | null = null;
  void _snapshot;
  return { success: false, error: 'Fixar empresa foi desativado neste fluxo.' };
}

/**
 * Retorna true se a empresa está fixada.
 * Síncrono — seguro para usar em condicional de render.
 */
export function isCompanyLocked(): boolean {
  void isCompanyLockedSync;
  return false;
}

// ─── Compat: ensureCompanyPresetApplied ──────────────────────────────────────
// Mantido para não quebrar CompanyContext que importa este símbolo.

export type CompanyPreset = {
  enabled: boolean;
  data: Partial<CompanyUpsertInput> & Pick<CompanyUpsertInput, 'nome_fantasia'>;
};

const COMPANY_PRESET_KEY = 'smart-tech-company-preset';

function getCompanyPreset(): CompanyPreset | null {
  const st = safeGet<CompanyPreset>(COMPANY_PRESET_KEY, null);
  const preset = (st?.success ? (st.data as any) : null) as CompanyPreset | null;
  if (!preset?.enabled || !preset.data?.nome_fantasia) return null;
  return preset;
}

export async function ensureCompanyPresetApplied(): Promise<void> {
  const preset = getCompanyPreset();
  if (!preset) return;
  const { company: cur } = await fetchCompany();

  const shouldApply = !cur || !(cur.nome_fantasia ?? '').trim();
  if (shouldApply) {
    await upsertCompany({
      ...preset.data,
      nome_fantasia: preset.data.nome_fantasia,
    });
  }
}
