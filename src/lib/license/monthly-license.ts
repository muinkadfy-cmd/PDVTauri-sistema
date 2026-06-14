import { getDeviceId } from '@/lib/device';
import { isDesktopApp } from '@/lib/platform';
import { kvGet, kvSet, kvRemove } from '@/lib/desktop-kv';
import { LICENSE_PUBLIC_JWK } from '@/lib/license-public-key';

export type MonthlyLicenseStatusType = 'active' | 'warning' | 'expired' | 'not_found' | 'blocked';

export type MonthlyLicenseCodePayload = {
  v: 1;
  app: 'smart-tech-pdv-monthly';
  device: string;
  customer?: string;
  days: number;
  issuedAt: string;
  validUntil: string;
  nonce: string;
};

export type MonthlyLicenseState = {
  v: 1;
  device: string;
  customer?: string;
  activatedAt: string;
  validUntil: string;
  lastSeenAt: string;
  codeHash: string;
  history: Array<{
    activatedAt: string;
    validUntil: string;
    customer?: string;
    codeHash: string;
  }>;
};

export type MonthlyLicenseStatus = {
  status: MonthlyLicenseStatusType;
  active: boolean;
  canUseCore: boolean;
  message: string;
  deviceId: string;
  deviceCode: string;
  validUntil?: string;
  daysRemaining?: number;
  customer?: string;
  lastSeenAt?: string;
  reason?: string;
};

const LICENSE_STATE_KEY = 'smart-tech:monthly-license-state';
const DESKTOP_KV_KEY = 'monthly_license_state_v1';
const LICENSE_CODE_PREFIX = 'STML2';
const WARNING_DAYS = 7;
const CLOCK_ROLLBACK_TOLERANCE_MS = 6 * 60 * 60 * 1000;
const LAST_SEEN_WRITE_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Licença mensal offline assinada por chave privada fora do app.
// O cliente final recebe somente a chave pública (LICENSE_PUBLIC_JWK).
// Prefixo antigo STML1/HMAC é rejeitado para não manter segredo no bundle.
const LEGACY_HMAC_LICENSE_CODE_PREFIX = 'STML1';

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readState(): MonthlyLicenseState | null {
  if (!hasWindow()) return null;
  try {
    return safeParse<MonthlyLicenseState>(localStorage.getItem(LICENSE_STATE_KEY));
  } catch {
    return null;
  }
}

function writeState(state: MonthlyLicenseState): void {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(LICENSE_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  if (isDesktopApp()) {
    try { void kvSet(DESKTOP_KV_KEY, JSON.stringify(state)); } catch {}
  }
}

export async function hydrateMonthlyLicenseFromDesktopKv(): Promise<void> {
  if (!isDesktopApp()) return;
  if (readState()) return;
  try {
    const raw = await kvGet(DESKTOP_KV_KEY);
    const state = safeParse<MonthlyLicenseState>(raw);
    if (state?.v === 1) {
      localStorage.setItem(LICENSE_STATE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

export async function removeMonthlyLicense(): Promise<void> {
  if (hasWindow()) {
    try { localStorage.removeItem(LICENSE_STATE_KEY); } catch {}
  }
  if (isDesktopApp()) {
    try { await kvRemove(DESKTOP_KV_KEY); } catch {}
  }
  dispatchMonthlyLicenseChanged();
}

function normalizeDeviceId(value: string): string {
  return String(value || '').trim() || 'device-pendente';
}

function fnv1a32Hex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0');
}

export function getMonthlyLicenseDeviceCode(deviceId = getDeviceId()): string {
  const h = fnv1a32Hex(normalizeDeviceId(deviceId));
  return `ST-${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlToString(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(b64);
  let out = '';
  for (let i = 0; i < bin.length; i += 1) out += String.fromCharCode(bin.charCodeAt(i));
  try {
    return decodeURIComponent(escape(out));
  } catch {
    return out;
  }
}

function stringToArrayBuffer(input: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(input);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function base64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyMonthlyLicenseSignature(payloadB64: string, signatureB64: string): Promise<boolean> {
  try {
    const sigBytes = base64urlToBytes(signatureB64);
    const sigBuffer = sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer;
    const key = await crypto.subtle.importKey(
      'jwk',
      LICENSE_PUBLIC_JWK as any,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      key,
      sigBuffer,
      stringToArrayBuffer(payloadB64)
    );
  } catch {
    return false;
  }
}

async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', stringToArrayBuffer(value));
  return bytesToBase64url(new Uint8Array(digest)).slice(0, 16);
}

function normalizeCodeInput(input: string): string {
  return String(input || '')
    .trim()
    .replace(/^Código:\s*/i, '')
    .replace(/\s+/g, '');
}

function parseCodeParts(code: string): { prefix: string; payloadB64: string; signature: string } | null {
  const clean = normalizeCodeInput(code);
  const parts = clean.split('.');
  if (parts.length === 3 && (parts[0] === LICENSE_CODE_PREFIX || parts[0] === LEGACY_HMAC_LICENSE_CODE_PREFIX)) {
    return { prefix: parts[0], payloadB64: parts[1], signature: parts[2] };
  }
  return null;
}

function parsePayload(payloadB64: string): MonthlyLicenseCodePayload | null {
  try {
    const raw = base64urlToString(payloadB64);
    const payload = JSON.parse(raw) as MonthlyLicenseCodePayload;
    if (payload?.v !== 1) return null;
    if (payload?.app !== 'smart-tech-pdv-monthly') return null;
    if (!payload.device || !payload.validUntil || !payload.issuedAt) return null;
    return payload;
  } catch {
    return null;
  }
}

function computeDaysRemaining(validUntil: string, nowMs = Date.now()): number {
  const endMs = Date.parse(validUntil);
  if (!Number.isFinite(endMs)) return 0;
  const diff = endMs - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

function dispatchMonthlyLicenseChanged(): void {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new CustomEvent('smarttech:monthly-license-changed'));
  } catch {
    // ignore
  }
}

function updateLastSeen(state: MonthlyLicenseState, nowIso: string, lastSeenMs?: number): void {
  const nowMs = Date.parse(nowIso);
  const previousMs = lastSeenMs ?? Number.NaN;
  if (Number.isFinite(previousMs) && Number.isFinite(nowMs) && nowMs - previousMs < LAST_SEEN_WRITE_INTERVAL_MS) {
    return;
  }
  const next = { ...state, lastSeenAt: nowIso };
  writeState(next);
}

export function getMonthlyLicenseStatusSync(): MonthlyLicenseStatus {
  const deviceId = getDeviceId();
  const deviceCode = getMonthlyLicenseDeviceCode(deviceId);
  const state = readState();

  if (!state) {
    return {
      status: 'not_found',
      active: false,
      canUseCore: false,
      message: 'Licença mensal não ativada',
      deviceId,
      deviceCode,
      reason: 'missing',
    };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const lastSeenMs = Date.parse(state.lastSeenAt || state.activatedAt || nowIso);

  if (state.device !== deviceCode) {
    return {
      status: 'blocked',
      active: false,
      canUseCore: false,
      message: 'Licença pertence a outro computador',
      deviceId,
      deviceCode,
      validUntil: state.validUntil,
      customer: state.customer,
      reason: 'device_mismatch',
    };
  }

  if (Number.isFinite(lastSeenMs) && nowMs + CLOCK_ROLLBACK_TOLERANCE_MS < lastSeenMs) {
    return {
      status: 'blocked',
      active: false,
      canUseCore: false,
      message: 'Data/hora do Windows foi alterada. Renove ou confirme a licença.',
      deviceId,
      deviceCode,
      validUntil: state.validUntil,
      customer: state.customer,
      lastSeenAt: state.lastSeenAt,
      reason: 'clock_rollback',
    };
  }

  const validUntilMs = Date.parse(state.validUntil);
  if (!Number.isFinite(validUntilMs) || nowMs > validUntilMs) {
    updateLastSeen(state, nowIso, lastSeenMs);
    return {
      status: 'expired',
      active: false,
      canUseCore: false,
      message: 'Licença mensal vencida',
      deviceId,
      deviceCode,
      validUntil: state.validUntil,
      daysRemaining: 0,
      customer: state.customer,
      lastSeenAt: nowIso,
      reason: 'expired',
    };
  }

  const daysRemaining = computeDaysRemaining(state.validUntil, nowMs);
  updateLastSeen(state, nowIso, lastSeenMs);

  if (daysRemaining <= WARNING_DAYS) {
    return {
      status: 'warning',
      active: true,
      canUseCore: true,
      message: `Licença vence em ${daysRemaining} dia(s)`,
      deviceId,
      deviceCode,
      validUntil: state.validUntil,
      daysRemaining,
      customer: state.customer,
      lastSeenAt: nowIso,
    };
  }

  return {
    status: 'active',
    active: true,
    canUseCore: true,
    message: `Licença ativa por ${daysRemaining} dia(s)`,
    deviceId,
    deviceCode,
    validUntil: state.validUntil,
    daysRemaining,
    customer: state.customer,
    lastSeenAt: nowIso,
  };
}

export async function activateMonthlyLicenseCode(code: string): Promise<{ ok: boolean; error?: string; status?: MonthlyLicenseStatus }> {
  const parts = parseCodeParts(code);
  if (!parts) {
    return { ok: false, error: 'Código inválido. Use o código completo enviado pelo suporte.' };
  }

  if (parts.prefix === LEGACY_HMAC_LICENSE_CODE_PREFIX) {
    return { ok: false, error: 'Código antigo STML1 bloqueado por segurança. Gere um novo código STML2 assinado no PC admin.' };
  }

  const signatureOk = await verifyMonthlyLicenseSignature(parts.payloadB64, parts.signature);
  if (!signatureOk) {
    return { ok: false, error: 'Assinatura do código inválida.' };
  }

  const payload = parsePayload(parts.payloadB64);
  if (!payload) {
    return { ok: false, error: 'Código corrompido ou incompatível.' };
  }

  const deviceCode = getMonthlyLicenseDeviceCode();
  if (payload.device !== deviceCode) {
    return {
      ok: false,
      error: `Código pertence ao computador ${payload.device}. Este computador é ${deviceCode}.`,
    };
  }

  const validUntilMs = Date.parse(payload.validUntil);
  if (!Number.isFinite(validUntilMs)) {
    return { ok: false, error: 'Data de vencimento inválida no código.' };
  }

  if (Date.now() > validUntilMs) {
    return { ok: false, error: 'Este código já está vencido.' };
  }

  const oldState = readState();
  const activatedAt = new Date().toISOString();
  const codeHash = await shortHash(normalizeCodeInput(code));
  const history = [
    ...(oldState?.history || []),
    {
      activatedAt,
      validUntil: payload.validUntil,
      customer: payload.customer,
      codeHash,
    },
  ].slice(-12);

  const state: MonthlyLicenseState = {
    v: 1,
    device: deviceCode,
    customer: payload.customer,
    activatedAt,
    validUntil: payload.validUntil,
    lastSeenAt: activatedAt,
    codeHash,
    history,
  };

  writeState(state);
  dispatchMonthlyLicenseChanged();

  return { ok: true, status: getMonthlyLicenseStatusSync() };
}

export function isMonthlyLicenseExemptPath(pathname: string): boolean {
  const p = String(pathname || '/').toLowerCase();
  const allowed = [
    '/licenca',
    '/backup',
    '/atualizacoes',
    '/ajuda',
    '/login',
    '/setup',
    '/configurar-loja',
  ];
  return allowed.some((x) => p === x || p.startsWith(`${x}/`));
}
