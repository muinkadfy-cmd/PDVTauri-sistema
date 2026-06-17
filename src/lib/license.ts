import { getDevBypassLicenseStatus, isLicenseDevBypassEnabled } from '@/lib/license/license-dev-bypass';
/**
 * LicenÃƒÂ§a OFFLINE (assinada) - Modo Local
 *
 * Objetivo:
 * - Funcionar 100% offline
 * - VocÃƒÂª gera a licenÃƒÂ§a no seu PC (com a chave privada) e o cliente cola o token no sistema
 * - O app valida com a chave pÃƒÂºblica embutida
 *
 * Token (formato):
 *   base64url(JSON payload) + "." + base64url(assinatura RSA-PSS/SHA-256 do 1Ã‚Âº bloco)
 */

type SupabaseClient = any;
import { LICENSE_PUBLIC_JWK } from './license-public-key';
import { isDesktopApp } from './platform';
import { kvGet, kvSet, kvRemove } from './desktop-kv';
import { getDeviceId } from './device';
import { isLicenseEnabled, isLicenseMandatory } from './mode';
import { isLicenseRemoteConfigured } from '@/lib/capabilities/license-remote-adapter';
import { validateLicenseFromServer } from '@/lib/license-service';
import { isHybridLicenseCommerciallyActiveSync, shouldHybridLicenseBlockCommercialActionsSync } from '@/lib/license/hybrid-license';

export type LicensePayload = {
  v: 1;
  app: 'smart-tech-pdv';
  licenseId: string;
  issuedAt: string;   // ISO
  validUntil: string; // ISO
  deviceId: string;
  storeId?: string;
  plan?: string;
  features?: string[];
  note?: string;
};

export type LicenseStatus = {
  status: 'active' | 'trial' | 'expired' | 'not_found' | 'blocked' | 'offline' | 'invalid';
  validUntil?: string;
  daysRemaining?: number;
  message: string;
  lastValidatedAt?: string;
  source?: 'local' | 'supabase' | 'cache' | 'dev-bypass';
  payload?: LicensePayload;
};

const LICENSE_TOKEN_KEY = 'smart-tech-license-token';
const LICENSE_CACHE_KEY = 'smart-tech-license-cache'; // cache do ÃƒÂºltimo status validado
const REMOTE_LICENSE_STATUS_KEY = 'smart-tech:license-status';

// Trial (DEMO) - Desktop/PROD: permite uso por 15 dias sem licenÃƒÂ§a.
const TRIAL_DAYS = 15;
const TRIAL_START_LS = 'smart-tech:trial-start-ms';
const TRIAL_LAST_SEEN_LS = 'smart-tech:trial-last-seen-ms';

let _desktopTrialHydrateStarted = false;
function hydrateTrialFromDesktopKv(): void {
  if (_desktopTrialHydrateStarted) return;
  if (!isDesktopApp()) return;
  _desktopTrialHydrateStarted = true;
  try {
    void Promise.all([kvGet('trial_start_ms'), kvGet('trial_last_seen_ms')])
      .then(([s, l]) => {
        if (s) {
          try { localStorage.setItem(TRIAL_START_LS, String(s)); } catch {}
        }
        if (l) {
          try { localStorage.setItem(TRIAL_LAST_SEEN_LS, String(l)); } catch {}
        }
      })
      .catch(() => undefined);
  } catch {
    // ignore
  }
}

function readNumberLS(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeNumberLS(key: string, value: number): void {
  try { localStorage.setItem(key, String(value)); } catch {}
}

function computeDaysRemainingCeil(endMs: number, nowMs: number): number {
  const diff = endMs - nowMs;
  if (diff <= 0) return 0;
  const day = 24 * 60 * 60 * 1000;
  return Math.ceil(diff / day);
}

function trialStatusSync(): LicenseStatus | null {
  if (!isLicenseMandatory()) return null;
  const startMs = readNumberLS(TRIAL_START_LS);
  if (!startMs) return null;

  const nowMs = Date.now();
  const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const endIso = new Date(endMs).toISOString();
  const daysRemaining = computeDaysRemainingCeil(endMs, nowMs);

  if (nowMs > endMs) {
    return { status: 'expired', message: 'PerÃƒÂ­odo de teste encerrado - ativaÃƒÂ§ÃƒÂ£o necessÃƒÂ¡ria', source: 'local', validUntil: endIso, daysRemaining: 0 };
  }

  return {
    status: 'trial',
    message: `Trial de 15 dias: ${daysRemaining} dia(s) restante(s)`,
    source: 'local',
    validUntil: endIso,
    daysRemaining,
  };
}

async function trialStatusAsync(): Promise<LicenseStatus> {
  if (!isLicenseMandatory()) {
    return { status: 'not_found', message: 'Sem licenÃƒÂ§a', source: 'local' };
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const TOL = 6 * 60 * 60 * 1000; // 6h

  let startMs = readNumberLS(TRIAL_START_LS);
  let lastSeenMs = readNumberLS(TRIAL_LAST_SEEN_LS);

  if (isDesktopApp()) {
    try {
      const s = await kvGet('trial_start_ms');
      const l = await kvGet('trial_last_seen_ms');
      const sn = s ? Number(s) : 0;
      const ln = l ? Number(l) : 0;
      if (!startMs && Number.isFinite(sn) && sn > 0) startMs = sn;
      if (!lastSeenMs && Number.isFinite(ln) && ln > 0) lastSeenMs = ln;
    } catch {
      // ignore
    }
  }

  if (!startMs) {
    startMs = nowMs;
    writeNumberLS(TRIAL_START_LS, startMs);
    lastSeenMs = nowMs;
    writeNumberLS(TRIAL_LAST_SEEN_LS, lastSeenMs);
    if (isDesktopApp()) {
      try {
        await kvSet('trial_start_ms', String(startMs));
        await kvSet('trial_last_seen_ms', String(lastSeenMs));
      } catch {
        // ignore
      }
    }
  }

  // Anti rollback: impede burlar o DEMO voltando o relÃƒÂ³gio.
  if (lastSeenMs > 0 && (nowMs + TOL) < lastSeenMs) {
    return {
      status: 'blocked',
      message: 'RelÃƒÂ³gio do sistema alterado',
      source: 'local',
      lastValidatedAt: nowIso,
    };
  }

  const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const endIso = new Date(endMs).toISOString();
  const daysRemaining = computeDaysRemainingCeil(endMs, nowMs);

  // Atualiza lastSeen
  writeNumberLS(TRIAL_LAST_SEEN_LS, nowMs);
  if (isDesktopApp()) {
    try { await kvSet('trial_last_seen_ms', String(nowMs)); } catch {}
  }

  if (nowMs > endMs) {
    return {
      status: 'expired',
      message: 'PerÃƒÂ­odo de teste encerrado - ativaÃƒÂ§ÃƒÂ£o necessÃƒÂ¡ria',
      source: 'local',
      validUntil: endIso,
      daysRemaining: 0,
      lastValidatedAt: nowIso,
    };
  }

  return {
    status: 'trial',
    message: `Trial de 15 dias: ${daysRemaining} dia(s) restante(s)`,
    source: 'local',
    validUntil: endIso,
    daysRemaining,
    lastValidatedAt: nowIso,
  };
}


// Desktop: carrega token salvo no SQLite (kv) em background (sem await, para manter getLicenseStatus() sÃƒÂ­ncrono).
let _desktopTokenHydrateStarted = false;
function hydrateTokenFromDesktopKv(): void {
  if (_desktopTokenHydrateStarted) return;
  if (!isDesktopApp()) return;
  _desktopTokenHydrateStarted = true;
  try {
    void kvGet('license_token')
      .then((t) => {
        if (t) writeToken(t);
      })
      .catch(() => undefined);
  } catch {
    // ignore
  }
}

// Mantemos assinatura da API antiga (nÃƒÂ£o usada no local-only)
export async function tryLoadOrCreateLicense(_client: SupabaseClient, _storeId: string): Promise<any | null> {
  return null;
}

function base64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Em algumas versÃƒÂµes do TypeScript/lib.dom, o WebCrypto tipa BufferSource
 * de forma mais restrita (ArrayBuffer), causando erro quando passamos
 * Uint8Array<ArrayBufferLike>.
 *
 * Garantimos ArrayBuffer criando uma cÃƒÂ³pia.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}


function fnv1a32Hex(input: string): string {
  // Fast, deterministic hash for IDs (NOT for security).
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function deriveLicenseIdFromToken(tokenCleaned: string): string {
  return `lic_${fnv1a32Hex(tokenCleaned)}`;
}

function normalizeTokenInput(input: string): string {
  return input
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^"+|"+$/g, '')
    .replace(/\s+/g, '');
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

function normalizeEpochMs(v: number): number {
  // If a unix timestamp in seconds was provided, convert to ms.
  return v < 10_000_000_000 ? v * 1000 : v;
}

function parseDateToMs(v: unknown): number | null {
  if (v == null) return null;

  // number (seconds or ms)
  if (typeof v === 'number' && Number.isFinite(v)) return normalizeEpochMs(v);

  // string: numeric OR ISO/date
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;

    // numeric string (seconds/ms)
    if (/^[0-9]+(\.[0-9]+)?$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? normalizeEpochMs(n) : null;
    }

    // ISO / RFC3339 / date string
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) return ms;

    // fallback for YYYY-MM-DD (UTC)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const ms2 = Date.parse(s + 'T00:00:00.000Z');
      if (Number.isFinite(ms2)) return ms2;
    }
  }

  return null;
}


function normalizeStringList(v: unknown): string[] | undefined | null {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const arr = v
      .filter((x) => typeof x === 'string')
      .map((x) => (x as string).trim())
      .filter(Boolean);
    return arr.length ? arr : [];
  }
  if (typeof v === 'string') {
    const arr = v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    return arr.length ? arr : [];
  }
  return null;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(LICENSE_TOKEN_KEY);
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;

    // Ã¢Å“â€¦ Compat: versÃƒÂµes antigas salvavam o token como string "crua" (JWT),
    // enquanto o resto do app lÃƒÂª via safeGet (JSON). Aqui aceitamos ambos.
    const first = trimmed[0];
    if (first === '"' || first === '{' || first === '[') {
      try {
        const parsed: any = JSON.parse(trimmed);
        if (typeof parsed === 'string') return parsed.trim() || null;
        if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string') {
          return String(parsed.token).trim() || null;
        }
        // Se nÃƒÂ£o reconheceu, cai no legado "cru"
      } catch {
        // ignore
      }
    }

    // Legado: JWT/linha ÃƒÂºnica
    return trimmed;
  } catch {
    return null;
  }
}

function writeToken(token: string): void {
  try {
    // Ã¢Å“â€¦ P0: gravar em JSON para ficar compatÃƒÂ­vel com safeGet (storage.ts) e evitar limpar o token.
    localStorage.setItem(LICENSE_TOKEN_KEY, JSON.stringify(token));
  } catch {
    // ignore
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(LICENSE_TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function persistDesktopToken(token: string | null): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    if (!token) {
      await kvRemove('license_token');
    } else {
      await kvSet('license_token', token);
    }
  } catch {
    // ignore
  }
}

function readCachedStatus(): LicenseStatus | null {
  try {
    return safeJsonParse<LicenseStatus>(localStorage.getItem(LICENSE_CACHE_KEY));
  } catch {
    return null;
  }
}

function writeCachedStatus(status: LicenseStatus): void {
  try {
    localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }
}

function shouldUseRemoteLicenseAuthority(): boolean {
  return isLicenseRemoteConfigured();
}

function readRemoteGuardStatus(): LicenseStatus | null {
  try {
    const raw = localStorage.getItem(REMOTE_LICENSE_STATUS_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse<{
      status?: 'active' | 'permanent' | 'expired' | 'blocked' | 'not_found' | 'offline';
      expiresAt?: string | null;
      daysRemaining?: number;
      lastValidatedAt?: string;
      source?: 'supabase' | 'cache';
    }>(raw);
    if (!parsed?.status) return null;

    return {
      status: parsed.status === 'permanent' ? 'active' : parsed.status,
      validUntil: parsed.expiresAt ?? undefined,
      daysRemaining: parsed.daysRemaining,
      lastValidatedAt: parsed.lastValidatedAt,
      source: parsed.source ?? 'cache',
      message:
        parsed.status === 'permanent'
          ? 'LicenÃƒÂ§a permanente'
          : parsed.status === 'active'
            ? 'LicenÃƒÂ§a vÃƒÂ¡lida'
            : parsed.status === 'blocked'
              ? 'Loja bloqueada'
              : parsed.status === 'expired'
                ? 'LicenÃƒÂ§a expirada'
                : parsed.status === 'not_found'
                  ? 'Nenhuma licenÃƒÂ§a encontrada'
                  : 'Validando licenÃƒÂ§aÃ¢â‚¬Â¦',
    };
  } catch {
    return null;
  }
}

function mapRemoteLicenseStatusToLocalLike(status: Awaited<ReturnType<typeof validateLicenseFromServer>>): LicenseStatus {
  return {
    status: status.status,
    validUntil: status.expires_at,
    daysRemaining: status.daysRemaining,
    message: status.message,
    lastValidatedAt: status.lastValidatedAt,
    source: status.source,
  };
}

function computeDaysRemaining(validUntilIso: string): number {
  const now = new Date();
  const end = new Date(validUntilIso);
  const diffMs = end.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function initializeDefaultLicense(): void {
  // no-op: a licenÃƒÂ§a sÃƒÂ³ existe quando o usuÃƒÂ¡rio cola um token
}

// P10T/P10I: licença híbrida por loja + PC é a autoridade comercial oficial.
export function isReadOnlyMode(): boolean {
  if (isLicenseDevBypassEnabled()) {
    console.warn('[License] DEV bypass ativo: readOnly=false somente em localhost.');
    return false;
  }
  // Em DEV a gente nÃƒÂ£o bloqueia, para nÃƒÂ£o atrapalhar desenvolvimento.
  if (import.meta.env.DEV) return false;

  // P10I: licenÃƒÂ§a hÃƒÂ­brida por loja + PC ÃƒÂ© a autoridade comercial oficial.
  // Sem cache hÃƒÂ­brido vÃƒÂ¡lido, vendas/OS/financeiro/impressÃƒÂ£o comercial entram em modo somente leitura.
  if (isHybridLicenseCommerciallyActiveSync()) return false;
  if (shouldHybridLicenseBlockCommercialActionsSync()) return true;

  // Compatibilidade com a licenÃƒÂ§a antiga, caso algum build Web/PWA reative a flag.
  if (!isLicenseEnabled()) return false;

  const st = getLicenseStatus();
  return st.status !== 'active' && st.status !== 'trial';
}

/**
 * getLicenseStatus() ÃƒÂ© sÃƒÂ­ncrono (UI/guards).
 * - Retorna cache se existir.
 * - Se nÃƒÂ£o existir cache, retorna um status "offline" (precisa validar async).
 */
export function getLicenseStatus(): LicenseStatus {
  if (isLicenseDevBypassEnabled()) {
    console.warn('[License] DEV bypass ativo: getLicenseStatus liberado somente em localhost.');
    return getDevBypassLicenseStatus() as LicenseStatus;
  }
  // Se licenÃƒÂ§a nem estÃƒÂ¡ habilitada, nÃƒÂ£o bloqueia e informa.
  if (!isLicenseEnabled()) {
    return {
      status: 'active',
      message: 'LicenÃƒÂ§a desativada (modo local)',
      source: 'local',
      lastValidatedAt: new Date().toISOString(),
    };
  }

  if (shouldUseRemoteLicenseAuthority()) {
    const remoteCached = readRemoteGuardStatus();
    if (remoteCached) {
      writeCachedStatus(remoteCached);
      return remoteCached;
    }

    return {
      status: 'offline',
      message: 'Validando licenÃƒÂ§a remotaÃ¢â‚¬Â¦',
      source: 'cache',
      lastValidatedAt: new Date().toISOString(),
    };
  }

  const cached = readCachedStatus();
  if (cached) return cached;

  let token = readToken();
  hydrateTokenFromDesktopKv();
  hydrateTrialFromDesktopKv();

  // (o token do Desktop KV serÃƒÂ¡ hidratado async no background, e aparecerÃƒÂ¡ na prÃƒÂ³xima leitura)
  if (!token) {
    // Desktop/PROD (build de venda): permite DEMO automÃƒÂ¡tico por alguns dias.
    if (isLicenseMandatory()) {
      const tr = trialStatusSync();
      if (tr) return tr;
      // sem info local ainda -> forÃƒÂ§a fluxo async (que cria/valida o trial)
      return { status: 'offline', message: 'Iniciando trial de 15 diasÃ¢â‚¬Â¦', source: 'local' };
    }
    return { status: 'not_found', message: 'Sem licenÃƒÂ§a (cole o token)', source: 'local' };
  }

  // Sem validaÃƒÂ§ÃƒÂ£o criptogrÃƒÂ¡fica aqui: marca como "offline" atÃƒÂ© validar.
  const payload = decodePayload(token);
  if (!payload) {
    return { status: 'invalid', message: 'Token invÃƒÂ¡lido (formato)', source: 'local' };
  }

  const daysRemaining = computeDaysRemaining(payload.validUntil);
  if (daysRemaining < 0) {
    return {
      status: 'expired',
      message: 'LicenÃƒÂ§a expirada',
      source: 'local',
      validUntil: payload.validUntil,
      daysRemaining,
      payload,
    };
  }

  return {
    status: 'offline',
    message: 'Validando licenÃƒÂ§aÃ¢â‚¬Â¦',
    source: 'local',
    validUntil: payload.validUntil,
    daysRemaining,
    payload,
  };
}

/** ValidaÃƒÂ§ÃƒÂ£o real (assinatura + device match + data). */
export async function getLicenseStatusAsync(): Promise<LicenseStatus> {
  if (isLicenseDevBypassEnabled()) {
    console.warn('[License] DEV bypass ativo: getLicenseStatusAsync liberado somente em localhost.');
    return getDevBypassLicenseStatus() as LicenseStatus;
  }
  if (!isLicenseEnabled()) {
    const ok: LicenseStatus = {
      status: 'active',
      message: 'LicenÃƒÂ§a desativada (modo local)',
      source: 'local',
      lastValidatedAt: new Date().toISOString(),
    };
    writeCachedStatus(ok);
    return ok;
  }

  if (shouldUseRemoteLicenseAuthority()) {
    const remoteStatus = mapRemoteLicenseStatusToLocalLike(await validateLicenseFromServer());
    writeCachedStatus(remoteStatus);
    return remoteStatus;
  }

  let token = readToken();
  if (!token && isDesktopApp()) {
    try {
      const fromDb = await kvGet('license_token');
      if (fromDb) {
        writeToken(fromDb);
        token = fromDb;
      }
    } catch {
      // ignore
    }
  } else {
    // garante que futuras leituras sÃƒÂ­ncronas vejam o token (desktop)
    hydrateTokenFromDesktopKv();
  hydrateTrialFromDesktopKv();
  }

  if (!token) {
    // Desktop/PROD (build de venda): trial automÃƒÂ¡tico por 15 dias.
    if (isLicenseMandatory()) {
      const tr = await trialStatusAsync();
      writeCachedStatus(tr);
      return tr;
    }
    const st: LicenseStatus = { status: 'not_found', message: 'Sem licenÃƒÂ§a (cole o token)', source: 'local' };
    writeCachedStatus(st);
    return st;
  }

  const verified = await verifyToken(token);
  writeCachedStatus(verified);
  return verified;
}

export function activateLicense(token: string): { success: boolean; error?: string } {
  // grava e valida async depois (para manter UX rÃƒÂ¡pida)
  try {
    const t = normalizeTokenInput(token || '');
    if (!t || !t.includes('.')) return { success: false, error: 'Token invÃƒÂ¡lido' };
    writeToken(t);
    void persistDesktopToken(t);
    // limpa cache
    try { localStorage.removeItem(LICENSE_CACHE_KEY); } catch {}
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao salvar token' };
  }
}

export function removeLicense(): boolean {
  clearToken();
  void persistDesktopToken(null);
  try { localStorage.removeItem(LICENSE_CACHE_KEY); } catch {}
  return true;
}

export function decodePayload(token: string): LicensePayload | null {
  try {
    // Accept tokens pasted with line breaks/spaces (common when copying from textareas).
    const cleaned = normalizeTokenInput(token);

    if (!cleaned) return null;
    // Token format: <payloadB64>.<signatureB64>
    const parts = cleaned.split('.');
    if (parts.length < 1) return null;

    const payloadB64 = parts[0];
    const json = new TextDecoder().decode(base64urlToBytes(payloadB64));
    const raw = JSON.parse(json) as any;

    // Version/app can come in different key names depending on the generator.
    const rawV = raw?.v ?? raw?.version;
    if (rawV != null && toNum(rawV) !== 1) return null;

    const rawApp = raw?.app ?? raw?.application ?? raw?.a;
    if (rawApp != null && toStr(rawApp) !== 'smart-tech-pdv') return null;

    const deviceId =
      toStr(raw?.deviceId) ??
      toStr(raw?.device_id) ??
      toStr(raw?.device) ??
      toStr(raw?.machineId) ??
      toStr(raw?.machine_id);

    if (!deviceId || deviceId.length < 6) return null;

    const issuedAt = parseDateToMs(raw?.issuedAt ?? raw?.issued_at ?? raw?.iat) ?? Date.now();

    let validUntilRaw = parseDateToMs(raw?.validUntil ?? raw?.valid_until ?? raw?.exp);

    // Some generators send "validade (dias)" instead of a timestamp.
    if (validUntilRaw == null) {
      const days = toNum(
        raw?.validDays ??
          raw?.validityDays ??
          raw?.validadeDias ??
          raw?.validade_dias ??
          raw?.validade ??
          raw?.days
      );
      if (days != null && days > 0) validUntilRaw = issuedAt + days * 86_400_000;
    }

    if (validUntilRaw == null || !Number.isFinite(validUntilRaw)) return null;

    // Basic sanity (ms timestamps).
    if (issuedAt < 1_600_000_000_000) return null;
    if (validUntilRaw < 1_600_000_000_000) return null;

    const storeId = toStr(raw?.storeId ?? raw?.store_id) ?? undefined;
    const plan = toStr(raw?.plan ?? raw?.plano) ?? undefined;
    const licenseIdRaw = toStr(raw?.licenseId ?? raw?.license_id ?? raw?.id ?? raw?.licencaId) ?? undefined;
    const licenseId = (licenseIdRaw && licenseIdRaw.trim()) ? licenseIdRaw.trim() : deriveLicenseIdFromToken(cleaned);
    const note =
      toStr(raw?.note) ??
      toStr(raw?.observacao) ??
      toStr(raw?.observation) ??
      toStr(raw?.obs) ??
      undefined;

    const features = normalizeStringList(raw?.features ?? raw?.feature ?? raw?.recursos ?? raw?.resources);
    if (features === null) return null;

    const issuedAtIso = new Date(issuedAt).toISOString();
    const validUntilIso = new Date(validUntilRaw).toISOString();

    return {
      v: 1,
      app: 'smart-tech-pdv',
      licenseId,
      deviceId,
      issuedAt: issuedAtIso,
      validUntil: validUntilIso,
      ...(storeId ? { storeId } : {}),
      ...(plan ? { plan } : {}),
      ...(features && features.length ? { features } : {}),
      ...(note ? { note } : {}),
    };
  } catch {
    return null;
  }
}


async function verifyToken(token: string): Promise<LicenseStatus> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const cleaned = normalizeTokenInput(token);
  if (!cleaned) {
    return { status: 'invalid', message: 'Token vazio', source: 'local', lastValidatedAt: nowIso };
  }
  const parts = cleaned.split('.');
  if (parts.length !== 2) {
    return { status: 'invalid', message: 'Token invÃƒÂ¡lido (formato)', source: 'local', lastValidatedAt: nowIso };
  }

  const payload = decodePayload(token);
  if (!payload) {
    return { status: 'invalid', message: 'Token invÃƒÂ¡lido (payload)', source: 'local', lastValidatedAt: nowIso };
  }

  // Validade
  const daysRemaining = computeDaysRemaining(payload.validUntil);
  if (daysRemaining < 0) {
    return {
      status: 'expired',
      message: 'LicenÃƒÂ§a expirada',
      source: 'local',
      validUntil: payload.validUntil,
      daysRemaining,
      lastValidatedAt: nowIso,
      payload,
    };
  }

  // Anti-tamper: impede burlar expiraÃƒÂ§ÃƒÂ£o voltando o relÃƒÂ³gio do sistema.
  if (isDesktopApp()) {
    try {
      const prevRaw = await kvGet('last_seen_ms');
      const prev = prevRaw ? Number(prevRaw) : 0;
      const TOL = 6 * 60 * 60 * 1000; // 6h
      if (prev > 0 && (nowMs + TOL) < prev) {
        return {
          status: 'blocked',
          message: 'RelÃƒÂ³gio do sistema alterado',
          source: 'local',
          validUntil: payload.validUntil,
          daysRemaining,
          lastValidatedAt: nowIso,
          payload,
        };
      }
    } catch {
      // ignore
    }
  }

  // Device bind
  const deviceId = getDeviceId();
  if (payload.deviceId !== deviceId) {
    return {
      status: 'blocked',
      message: 'LicenÃƒÂ§a nÃƒÂ£o ÃƒÂ© deste dispositivo',
      source: 'local',
      validUntil: payload.validUntil,
      daysRemaining,
      lastValidatedAt: nowIso,
      payload,
    };
  }

  // Assinatura
  try {
    const payloadB64 = parts[0];
    const sigBytes = base64urlToBytes(parts[1]);
    const sigBuf = toArrayBuffer(sigBytes);
    const dataBuf = toArrayBuffer(new TextEncoder().encode(payloadB64));

    const key = await crypto.subtle.importKey(
      'jwk',
      LICENSE_PUBLIC_JWK as any,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const ok = await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      key,
      sigBuf,
      dataBuf
    );

    if (!ok) {
      return { status: 'invalid', message: 'Assinatura invÃƒÂ¡lida', source: 'local', lastValidatedAt: nowIso, payload };
    }
  } catch {
    return { status: 'invalid', message: 'Falha ao validar assinatura', source: 'local', lastValidatedAt: nowIso, payload };
  }

  // Marca ÃƒÂºltimo horÃƒÂ¡rio visto (desktop) para detectar rollback de relÃƒÂ³gio.
  if (isDesktopApp()) {
    try { await kvSet('last_seen_ms', String(nowMs)); } catch { /* ignore */ }
  }

  return {
    status: 'active',
    message: 'LicenÃƒÂ§a ativa',
    source: 'local',
    validUntil: payload.validUntil,
    daysRemaining,
    lastValidatedAt: nowIso,
    payload,
  };
}

/** Compatibilidade (gerador antigo). Mantido. */
export function generateLicenseCode(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  const time = Date.now().toString(36).slice(-6).toUpperCase();
  return `ST-${rand}-${time}`;
}
export function generateMultipleLicenseCodes(count: number): string[] {
  const n = Math.max(1, Math.min(500, Number(count) || 1));
  return Array.from({ length: n }, () => generateLicenseCode());
}

export function isAdmin(): boolean {
  try {
    const raw = localStorage.getItem('smart-tech:session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.role === 'admin' || s?.isSuperAdmin === true || localStorage.getItem('smart-tech:isSuperAdmin') === 'true';
  } catch {
    return false;
  }
}

export function canManageLicense(): boolean {
  // GestÃƒÂ£o de licenÃƒÂ§a: admin/superadmin
  return isAdmin();
}


// ---- Added for Trial+Gate UI (non-breaking wrappers) ----
export type LicenseGateState = 'TRIAL' | 'ACTIVE' | 'EXPIRED';

export function getTrialInfo(): { startedAt?: string; expiresAt?: string; lastSeenAt?: string } {
  const startMs = readNumberLS(TRIAL_START_LS);
  const lastSeenMs = readNumberLS(TRIAL_LAST_SEEN_LS);
  if (!startMs) return { lastSeenAt: lastSeenMs ? new Date(lastSeenMs).toISOString() : undefined };
  const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return {
    startedAt: new Date(startMs).toISOString(),
    expiresAt: new Date(endMs).toISOString(),
    lastSeenAt: lastSeenMs ? new Date(lastSeenMs).toISOString() : undefined,
  };
}

/** Garante que o trial de 15 dias exista (cria na 1Ã‚Âª execuÃƒÂ§ÃƒÂ£o). */
export async function ensureTrial(): Promise<void> {
  if (!isLicenseMandatory()) return;
  const startMs = readNumberLS(TRIAL_START_LS);
  if (startMs && startMs > 0) return;
  try {
    await trialStatusAsync(); // cria e persiste trial_start_ms / trial_last_seen_ms
    try { localStorage.removeItem(LICENSE_CACHE_KEY); } catch {}
  } catch {
    // ignore
  }
}

/** Status simplificado para UI (rodapÃƒÂ©/gate). */
export function getLicenseGateStatus(): { state: LicenseGateState; daysLeft?: number; expiresAt?: string; startedAt?: string } {
  const st = getLicenseStatus();
  const trial = getTrialInfo();
  const daysLeft = typeof st.daysRemaining === 'number' ? Math.max(0, st.daysRemaining) : undefined;

  if (st.status === 'active') {
    return { state: 'ACTIVE', daysLeft, expiresAt: st.validUntil, startedAt: trial.startedAt };
  }
  if (st.status === 'trial') {
    return { state: 'TRIAL', daysLeft, expiresAt: st.validUntil, startedAt: trial.startedAt };
  }
  // expired, blocked, invalid, not_found -> exigir ativaÃƒÂ§ÃƒÂ£o
  return { state: 'EXPIRED', daysLeft, expiresAt: st.validUntil || trial.expiresAt, startedAt: trial.startedAt };
}

/** Ativa por token (salva local + valida). */
export async function activateFromToken(token: string): Promise<{ ok: boolean; error?: string; status?: LicenseStatus }> {
  const r = activateLicense(token);
  if (!r.success) return { ok: false, error: r.error || 'Token invÃƒÂ¡lido' };
  try {
    const verified = await getLicenseStatusAsync();
    return { ok: verified.status === 'active', status: verified, error: verified.status === 'active' ? undefined : verified.message };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao validar token' };
  }
}
