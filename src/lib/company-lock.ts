/**
 * ============================================================
 *  Company Lock — Proteção Anti-Revenda (Offline / Tauri)
 * ============================================================
 *
 *  MODELO DE AMEAÇA
 *  ─────────────────
 *  1. Usuário tenta apagar dados e cadastrar outra empresa
 *     → deleteCompany() rejeita se lock ativo
 *
 *  2. Usuário abre DevTools e chama setCompanyLocked(false)
 *     → Flag mora no SQLite KV (AppData), não em
 *       localStorage. DevTools não consegue resetar.
 *
 *  3. Usuário tenta alterar CNPJ/Razão Social via DevTools
 *     → upsertCompany() verifica campos críticos vs snapshot
 *       fixado e rejeita qualquer divergência.
 *
 *  4. Usuário deleta o banco SQLite manualmente
 *     → initCompanyLock() detecta ausência do KV e reaplica
 *       o snapshot de emergência guardado em localStorage
 *       (segunda camada de defesa).
 *
 *  PERSISTÊNCIA (3 camadas)
 *  ─────────────────────────
 *  Camada 1 (primária):   SQLite KV global  (AppData — sobrevive limpeza de WebView)
 *  Camada 2 (fallback):   localStorage      (sobrevive restart normal)
 *  Camada 3 (em memória): módulo singleton   (performance — evita I/O em cada read)
 *
 *  CAMPOS CRÍTICOS (imutáveis após lock)
 *  ──────────────────────────────────────
 *  - cnpj
 *  - razao_social
 *  - nome_fantasia
 *
 *  CAMPOS EDITÁVEIS APÓS LOCK
 *  ────────────────────────────
 *  - telefone, endereco, cidade, estado, cep
 *  - logo_url, mensagem_rodape
 */

import { logger } from '@/utils/logger';
import { safeGet, safeSet } from '@/lib/storage';
import { isDesktopApp } from '@/lib/platform';
import { kvGet, kvSet } from '@/lib/desktop-kv';
import { reportError } from '@/lib/crash-report';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Chave no KV global (SQLite) — sobrevive a limpeza de WebView */
const KV_LOCK_KEY = 'company_locked';

/** Chave no KV global — snapshot dos campos críticos no momento do lock */
const KV_SNAPSHOT_KEY = 'company_lock_snapshot';

/** Chave no localStorage — fallback / segunda camada */
const LS_LOCK_KEY = 'smart-tech-company-locked';
const LS_SNAPSHOT_KEY = 'smart-tech-company-lock-snapshot';

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Campos que NÃO podem mudar após o lock */
// Alias para compatibilidade com company-service.ts
export type CompanyCriticalSnapshot = CompanyCriticalFields;

export interface CompanyCriticalFields {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
}

/** Estado completo do lock */
export interface CompanyLockState {
  locked: boolean;
  lockedAt?: string;   // ISO timestamp
  snapshot?: CompanyCriticalFields;
}

/** Campos que PODEM ser editados mesmo após lock */
export interface CompanyEditableFields {
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logo_url?: string;
  mensagem_rodape?: string;
}

// ─── Singleton em memória ─────────────────────────────────────────────────────

let _lockState: CompanyLockState = { locked: false };
let _hydrated = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeField(v?: string | null): string {
  return (v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// ─── Persistência ────────────────────────────────────────────────────────────

async function persistLockState(state: CompanyLockState): Promise<void> {
  // Camada 1: SQLite KV global (primária — Desktop)
  if (isDesktopApp()) {
    await kvSet(KV_LOCK_KEY, state.locked ? '1' : '0');
    if (state.snapshot) {
      await kvSet(KV_SNAPSHOT_KEY, JSON.stringify(state.snapshot));
    }
  }

  // Camada 2: localStorage (fallback + web)
  safeSet(LS_LOCK_KEY, state.locked);
  if (state.snapshot) {
    safeSet(LS_SNAPSHOT_KEY, state.snapshot);
  }

  if (import.meta.env.DEV) {
    logger.log('[CompanyLock] Estado persistido:', JSON.stringify(state));
  }
}

async function readLockStateFromKV(): Promise<CompanyLockState | null> {
  if (!isDesktopApp()) return null;

  try {
    const lockedRaw = await kvGet(KV_LOCK_KEY);
    const locked = lockedRaw === '1';
    if (!locked) return { locked: false };

    const snapshotRaw = await kvGet(KV_SNAPSHOT_KEY);
    const snapshot = snapshotRaw
      ? (JSON.parse(snapshotRaw) as CompanyCriticalFields)
      : undefined;

    return { locked: true, snapshot };
  } catch (e) {
    logger.warn('[CompanyLock] Falha ao ler KV (não crítico):', e);
    return null;
  }
}

function readLockStateFromLS(): CompanyLockState {
  const lockedResult = safeGet<boolean>(LS_LOCK_KEY, false);
  const locked = lockedResult.success ? Boolean(lockedResult.data) : false;

  const snapshotResult = safeGet<CompanyCriticalFields>(LS_SNAPSHOT_KEY, null);
  const snapshot = snapshotResult.success
    ? (snapshotResult.data as CompanyCriticalFields | null) ?? undefined
    : undefined;

  return { locked, snapshot };
}

// ─── API Pública ─────────────────────────────────────────────────────────────

/**
 * Hidrata o estado do lock na memória.
 * DEVE ser chamado uma vez no boot do app (Layout.tsx useEffect).
 * Prioridade: KV global > localStorage.
 * O lock é definitivo: se QUALQUER camada diz "locked=true", prevalece.
 */
export async function initCompanyLock(): Promise<CompanyLockState> {
  if (_hydrated) return _lockState;

  const fromKV = await readLockStateFromKV();
  const fromLS = readLockStateFromLS();

  // OR lógico: qualquer camada dizendo locked=true → produto está bloqueado
  const locked = (fromKV?.locked ?? false) || fromLS.locked;
  const snapshot = fromKV?.snapshot ?? fromLS.snapshot;

  _lockState = { locked, snapshot };
  _hydrated = true;

  // Recuperação: LS dizia locked mas KV não → KV foi deletado/corrompido → regravar
  if (!fromKV?.locked && fromLS.locked && snapshot) {
    logger.warn('[CompanyLock] Recuperando lock: LS=locked, KV=unlocked — regravando KV');
    await persistLockState(_lockState);
  }

  if (import.meta.env.DEV) {
    logger.log('[CompanyLock] Inicializado:', _lockState);
  }

  return _lockState;
}

/**
 * Leitura síncrona do estado (após initCompanyLock ter sido chamado).
 * Segura para usar em render/guards sem await.
 */
export function getCompanyLockState(): CompanyLockState {
  return _lockState;
}

/**
 * Retorna true/false de forma síncrona.
 * Usar apenas após initCompanyLock() ter sido chamado no boot.
 */
export function isCompanyLockedSync(): boolean {
  return _lockState.locked;
}

/**
 * 🔒 BLOQUEIA A EMPRESA — OPERAÇÃO IRREVERSÍVEL.
 *
 * Persiste o lock nas 3 camadas e salva snapshot dos campos críticos.
 * Após esta chamada:
 *  - deleteCompany() sempre rejeitará
 *  - upsertCompany() rejeitará qualquer alteração de cnpj/razao_social/nome_fantasia
 *  - alterações de campos editáveis (telefone, endereço, etc.) continuam permitidas
 */
export async function lockCompany(
  snapshot: CompanyCriticalFields
): Promise<{ success: boolean; error?: string }> {
  if (_lockState.locked) {
    return { success: false, error: 'Empresa já está fixada.' };
  }

  if (!snapshot.nome_fantasia.trim()) {
    return { success: false, error: 'Nome fantasia é obrigatório para fixar a empresa.' };
  }

  const newState: CompanyLockState = {
    locked: true,
    lockedAt: new Date().toISOString(),
    snapshot: {
      cnpj: normalizeField(snapshot.cnpj),
      razao_social: normalizeField(snapshot.razao_social),
      nome_fantasia: normalizeField(snapshot.nome_fantasia),
    },
  };

  try {
    await persistLockState(newState);
    _lockState = newState;

    logger.warn(
      '[CompanyLock] 🔒 EMPRESA FIXADA em',
      newState.lockedAt,
      '— snapshot:',
      newState.snapshot
    );

    return { success: true };
  } catch (e: any) {
    const msg = e?.message || 'Erro ao fixar empresa';
    await reportError(e, { context: 'lockCompany', snapshot });
    return { success: false, error: msg };
  }
}

/**
 * Valida se os campos críticos fornecidos são compatíveis com o snapshot fixado.
 *
 * Retorna:
 *  { allowed: true }              — operação pode prosseguir
 *  { allowed: false, field, msg } — bloqueado; indica o campo violado
 *
 * Campos editáveis (telefone, logo_url, etc.) nunca são bloqueados aqui.
 */
export function validateCriticalFields(
  input: Partial<CompanyCriticalFields>
): { allowed: boolean; field?: string; msg?: string } {
  if (!_lockState.locked) return { allowed: true };

  const snap = _lockState.snapshot;
  if (!snap) return { allowed: true }; // lock sem snapshot (migration) = permissivo

  if (
    input.cnpj !== undefined &&
    normalizeField(input.cnpj) !== snap.cnpj
  ) {
    void reportError(
      new Error(`[CompanyLock] Tentativa de alteração de CNPJ bloqueada`),
      { field: 'cnpj', attempted: normalizeField(input.cnpj), locked: snap.cnpj }
    );
    return {
      allowed: false,
      field: 'cnpj',
      msg: 'CNPJ não pode ser alterado após fixar a empresa.',
    };
  }

  if (
    input.razao_social !== undefined &&
    normalizeField(input.razao_social) !== snap.razao_social
  ) {
    void reportError(
      new Error(`[CompanyLock] Tentativa de alteração de Razão Social bloqueada`),
      { field: 'razao_social' }
    );
    return {
      allowed: false,
      field: 'razao_social',
      msg: 'Razão Social não pode ser alterada após fixar a empresa.',
    };
  }

  if (
    input.nome_fantasia !== undefined &&
    normalizeField(input.nome_fantasia) !== snap.nome_fantasia
  ) {
    void reportError(
      new Error(`[CompanyLock] Tentativa de alteração de Nome Fantasia bloqueada`),
      { field: 'nome_fantasia' }
    );
    return {
      allowed: false,
      field: 'nome_fantasia',
      msg: 'Nome Fantasia não pode ser alterado após fixar a empresa.',
    };
  }

  return { allowed: true };
}

/**
 * Valida se a deleção da empresa é permitida.
 * Empresa fixada nunca pode ser deletada pela UI.
 */
export function validateDeleteCompany(): { allowed: boolean; msg?: string } {
  if (_lockState.locked) {
    void reportError(
      new Error('[CompanyLock] Tentativa de deleção de empresa bloqueada'),
      { context: 'validateDeleteCompany', lockedAt: _lockState.lockedAt }
    );
    return {
      allowed: false,
      msg: '🔒 A empresa está fixada e não pode ser removida. Entre em contato com o suporte técnico.',
    };
  }
  return { allowed: true };
}
