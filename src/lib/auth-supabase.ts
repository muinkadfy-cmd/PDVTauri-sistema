/**
 * Auth do app (Supabase-first com contingência local)
 *
 * - Em web/PWA com Supabase configurado, autenticação e sessão são remotas
 * - Em cenários offline/contingência, alguns dados locais ainda podem ser usados
 * - Sem usuário padrão legado; apenas conta principal e contas de loja
 */

import type { UserRole, Usuario } from '@/types';
import {
  acceptRemoteUserInvite,
  canUseRemoteUserAuth,
  createRemoteUserInvite,
  fetchCurrentRemoteSessionProfile,
  getRemoteInviteByToken,
  listRemoteUserProfiles,
  registerRemoteStoreOwner,
  sendRemotePasswordRecoveryEmail,
  signInRemoteUser,
  signOutRemoteUser,
  type RemoteUserProfile,
  updateRemoteUserProfileActive,
  updateRemoteUserProfileRole,
} from '@/lib/capabilities/remote-user-auth-adapter';
import { ENV } from '@/lib/env';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { getStoreId, isValidUUID, setStoreId } from '@/lib/store-id';
import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';

// Chaves locais
const USERS_KEY = 'smart-tech:local-users';
const SESSION_KEY = 'smart-tech:local-session';

// ─── Throttle / Lockout de Login (anti brute-force offline) ──────────────────
// Persistimos no localStorage para sobreviver a reloads (mas resetamos em sucesso).
// Estratégia:
//  - até 3 falhas: sem lock
//  - a partir de 4 falhas: backoff exponencial (5s * 2^(n-4)), cap 5 min
//  - após 10 falhas: lock fixo de 15 min
type LoginThrottleState = {
  fails: number;
  lastFailAt: number;
  lockedUntil: number;
};

const LOGIN_THROTTLE_KEY = 'smart-tech:login-throttle-v1';

function readThrottle(): Record<string, LoginThrottleState> {
  return safeRead<Record<string, LoginThrottleState>>(LOGIN_THROTTLE_KEY, {});
}

function writeThrottle(v: Record<string, LoginThrottleState>): void {
  safeWrite(LOGIN_THROTTLE_KEY, v);
}

function throttleKey(username: string, storeId: string): string {
  return `${storeId || 'nostore'}:${(username || '').toLowerCase().trim()}`;
}

function computeLockMs(fails: number): number {
  if (fails <= 3) return 0;
  if (fails >= 10) return 15 * 60 * 1000; // 15 min
  const exp = fails - 4; // 0..5
  const ms = 5000 * (2 ** exp); // 5s, 10s, 20s, 40s, 80s, 160s
  return Math.min(ms, 5 * 60 * 1000); // cap 5 min
}

function checkLoginThrottle(username: string, storeId: string): { ok: true } | { ok: false; waitMs: number } {
  const map = readThrottle();
  const key = throttleKey(username, storeId);
  const st = map[key];
  const now = Date.now();
  if (!st) return { ok: true };
  if (st.lockedUntil > now) return { ok: false, waitMs: st.lockedUntil - now };
  return { ok: true };
}

function recordLoginFailure(username: string, storeId: string): void {
  const map = readThrottle();
  const key = throttleKey(username, storeId);
  const now = Date.now();
  const prev = map[key] || { fails: 0, lastFailAt: 0, lockedUntil: 0 };
  const fails = Math.min(99, (prev.fails || 0) + 1);
  const lockMs = computeLockMs(fails);
  map[key] = {
    fails,
    lastFailAt: now,
    lockedUntil: lockMs ? (now + lockMs) : 0,
  };
  writeThrottle(map);
}

function clearLoginThrottle(username: string, storeId: string): void {
  const map = readThrottle();
  const key = throttleKey(username, storeId);
  if (map[key]) {
    delete map[key];
    writeThrottle(map);
  }
}

function formatWaitMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m}min`;
}


// Mantido para compatibilidade (não é usado em outros lugares)
const IS_LOGGED_KEY = 'smart-tech:isLogged';
const IS_SUPERADMIN_KEY = 'smart-tech:isSuperAdmin';

export interface AppUser {
  id: string;
  username: string;
  email?: string;
  storeId?: string;
  storeName?: string;
  isSuperAdmin?: boolean;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type LocalUserRecord = AppUser & {
  passwordHash: string;
};

export interface UserSession {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  storeId: string;
  storeName?: string;
  isSuperAdmin?: boolean;
  authSource?: 'local' | 'remote';
  loginTime: string;
  expiresAt: string;
}

export interface UserStoreAccess {
  store_id: string;
  store_name: string;
  role: UserRole;
}

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeRead<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hasSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function safeReadSession<T>(key: string, fallback: T): T {
  if (!hasSessionStorage()) return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteSession(key: string, value: any): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function safeRemoveSession(key: string): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeWrite(key: string, value: any): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function genId(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeUserEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

// ─── Hash de senha local ────────────────────────────────────────────────────
// Formato novo: pbkdf2:sha256:<iterations>:<saltHex>:<hashHex>
// Mantém compatibilidade com hashes antigos SHA-256 puro e plain:* para não
// travar clientes que já tinham usuário local criado. Ao logar com hash antigo,
// migramos automaticamente para PBKDF2.
const PASSWORD_HASH_VERSION = 'pbkdf2:sha256';
const PASSWORD_HASH_ITERATIONS = 150_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_DERIVED_BITS = 256;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = String(hex || '').trim();
  if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(PASSWORD_SALT_BYTES);
  const c: Crypto | undefined = (globalThis as any).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    // Fallback extremo para WebViews muito antigos. No Tauri/Edge WebView moderno
    // crypto.getRandomValues existe; este caminho só evita crash.
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(bytes);
}

async function sha256Hex(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(String(password || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aa = String(a || '');
  const bb = String(b || '');
  let diff = aa.length ^ bb.length;
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (aa.charCodeAt(i) || 0) ^ (bb.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function parsePbkdf2Hash(hash: string): { iterations: number; saltHex: string; hashHex: string } | null {
  const parts = String(hash || '').split(':');
  if (parts.length !== 5) return null;
  if (`${parts[0]}:${parts[1]}` !== PASSWORD_HASH_VERSION) return null;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations < 10_000) return null;
  return { iterations, saltHex: parts[3], hashHex: parts[4] };
}

async function derivePbkdf2Hex(password: string, saltHex: string, iterations = PASSWORD_HASH_ITERATIONS): Promise<string> {
  const subtle = crypto?.subtle;
  if (!subtle?.importKey || !subtle?.deriveBits) {
    // Fallback de compatibilidade: nunca deve ser usado no Desktop moderno.
    return sha256Hex(`${saltHex}:${password}`);
  }

  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(String(password || '')),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex).buffer.slice(0) as ArrayBuffer, iterations, hash: 'SHA-256' },
    keyMaterial,
    PASSWORD_DERIVED_BITS
  );
  return bytesToHex(new Uint8Array(bits));
}

export function needsPasswordHashUpgrade(hash: string): boolean {
  const parsed = parsePbkdf2Hash(hash);
  if (!parsed) return true;
  return parsed.iterations < PASSWORD_HASH_ITERATIONS;
}

async function upgradePasswordHashIfNeeded(users: LocalUserRecord[], record: LocalUserRecord, password: string): Promise<void> {
  if (!needsPasswordHashUpgrade(record.passwordHash)) return;
  record.passwordHash = await createPasswordHash(password);
  record.updatedAt = nowIso();
  saveUsers(users);
}

function findStoreUser(users: LocalUserRecord[], emailOrUsername: string, storeId: string): LocalUserRecord | undefined {
  const lookup = normalizeUserEmail(emailOrUsername);
  return users.find((user) => {
    const userStoreId = String(user.storeId || '').trim();
    const userEmail = normalizeUserEmail(user.email || user.username);
    return !!userStoreId && userStoreId === storeId && userEmail === lookup;
  });
}

function findSuperAdminUser(users: LocalUserRecord[], emailOrUsername?: string): LocalUserRecord | undefined {
  const lookup = normalizeUserEmail(emailOrUsername || ENV.superAdminEmail);
  return users.find((user) => {
    if (user.isSuperAdmin !== true) return false;
    const userEmail = normalizeUserEmail(user.email || user.username);
    return userEmail === lookup;
  });
}

function findAnySuperAdminUser(users: LocalUserRecord[]): LocalUserRecord | undefined {
  return users.find((user) => user.isSuperAdmin === true);
}

function loadUsers(): LocalUserRecord[] {
  const users = safeRead<LocalUserRecord[]>(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users: LocalUserRecord[]): void {
  safeWrite(USERS_KEY, users);
}

function cleanupLegacyAdminUsers(): void {
  const users = loadUsers();
  const filtered = users.filter((user) => {
    const normalized = normalizeUserEmail(user.email || user.username);
    const isLegacyAdmin = normalized === 'admin' && user.isSuperAdmin !== true && !user.storeId;
    return !isLegacyAdmin;
  });

  if (filtered.length !== users.length) {
    saveUsers(filtered);
    logger.log('[AUTH][LOCAL] Usuarios legados "admin" removidos do storage local.');
  }
}

async function ensurePrimarySuperAdmin(): Promise<LocalUserRecord | null> {
  if (!ENV.superAdminEnabled) return null;
  if (!isDesktopApp() && await canUseRemoteUserAuth()) {
    return null;
  }

  const users = loadUsers();
  const createdAt = nowIso();
  const existing = findAnySuperAdminUser(users);
  const superAdminEmail = normalizeUserEmail(ENV.superAdminEmail);

  if (existing) {
    let changed = false;
    if (!existing.isSuperAdmin) {
      existing.isSuperAdmin = true;
      changed = true;
    }
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      changed = true;
    }
    if (!existing.active) {
      existing.active = true;
      changed = true;
    }
    if (normalizeUserEmail(existing.email || existing.username) !== superAdminEmail) {
      existing.email = superAdminEmail;
      existing.username = superAdminEmail;
      changed = true;
    }

    const passwordOk = existing.passwordHash
      ? await verifyPasswordHash(ENV.superAdminPassword, existing.passwordHash)
      : false;
    if (!passwordOk || needsPasswordHashUpgrade(existing.passwordHash)) {
      existing.passwordHash = await createPasswordHash(ENV.superAdminPassword);
      changed = true;
    }

    if (changed) {
      existing.updatedAt = createdAt;
      saveUsers(users);
    }
    return existing;
  }

  const record: LocalUserRecord = {
    id: genId(),
    username: superAdminEmail,
    email: superAdminEmail,
    role: 'admin',
    isSuperAdmin: true,
    active: true,
    createdAt,
    updatedAt: createdAt,
    passwordHash: await createPasswordHash(ENV.superAdminPassword),
  };

  users.push(record);
  saveUsers(users);
  logger.log('[AUTH][LOCAL] Conta principal SuperAdmin criada.');
  return record;
}

function canManageUserRecord(actor: UserSession | null, record: LocalUserRecord): boolean {
  if (!actor) return false;
  if (actor.isSuperAdmin) return true;
  if (record.isSuperAdmin) return false;
  if (actor.role !== 'admin') return false;
  return !!actor.storeId && record.storeId === actor.storeId;
}

function getStoreIdOrFallback(): string {
  return getRuntimeStoreId() || 'local-store';
}

function getLockedDesktopStoreId(): string | null {
  if (!isDesktopApp()) return null;
  const current = getStoreId().storeId;
  return current && isValidUUID(current) ? current : null;
}

function isDifferentDesktopStore(requestedStoreId: string): boolean {
  const locked = getLockedDesktopStoreId();
  return !!locked && !!requestedStoreId && locked !== requestedStoreId;
}

function createSessionFromRemoteProfile(profile: RemoteUserProfile, requestedStoreId: string): UserSession {
  return {
    userId: profile.id,
    username: profile.email,
    email: profile.email,
    role: profile.role,
    isSuperAdmin: profile.is_super_admin,
    storeId: profile.is_super_admin ? requestedStoreId : (profile.store_id || requestedStoreId),
    storeName: profile.store_name || undefined,
    authSource: 'remote',
    loginTime: nowIso(),
    expiresAt: computeExpiryDays(7),
  };
}

function computeExpiryDays(days: number): string {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export async function login(username: string, password: string, storeIdOverride?: string) {
  cleanupLegacyAdminUsers();
  await ensurePrimarySuperAdmin();

  const user = (username || '').trim();
  const pass = String(password || '');
  const requestedStoreId = String(storeIdOverride || '').trim();

  if (!user || !pass) {
    return { success: false, error: 'Informe e-mail e senha.' };
  }

  if (!requestedStoreId || !isValidUUID(requestedStoreId)) {
    return { success: false, error: 'Informe um store_id valido para entrar na loja correta.' };
  }

  if (isDifferentDesktopStore(requestedStoreId)) {
    const locked = getLockedDesktopStoreId();
    return {
      success: false,
      error: `Este Desktop está bloqueado para a loja ${locked}. Para trocar de loja, use o modo suporte/admin e faça backup antes.`,
    };
  }

  const storeIdForThrottle = requestedStoreId;
  const users = loadUsers();
  const remoteAvailable = !isDesktopApp() && await canUseRemoteUserAuth();
  const superAdminRecord = findSuperAdminUser(users, user);
  const isLocalSuperAdminCandidate = Boolean(
    superAdminRecord &&
    normalizeUserEmail(superAdminRecord.email || superAdminRecord.username) === normalizeUserEmail(user)
  );
  const throttle = checkLoginThrottle(user, storeIdForThrottle);
  if (!throttle.ok) {
    return { success: false, error: `Muitas tentativas. Aguarde ${formatWaitMs(throttle.waitMs)} e tente novamente.` };
  }

  if (!isDesktopApp() && user.includes('@') && remoteAvailable) {
    setStoreId(requestedStoreId, { force: true, reason: 'prelogin-remote-user-auth' });
    const remoteLogin = await signInRemoteUser({
      email: user,
      password: pass,
      storeId: requestedStoreId,
    });

    if (remoteLogin.attempted && remoteLogin.success && remoteLogin.profile) {
      const session = createSessionFromRemoteProfile(remoteLogin.profile, requestedStoreId);
      setCurrentSession(session);
      setStoreId(session.storeId, { force: true, reason: 'login-remote-store-user' });
      clearLoginThrottle(user, storeIdForThrottle);
      safeWrite(IS_LOGGED_KEY, '1');
      if (session.isSuperAdmin) {
        safeWrite(IS_SUPERADMIN_KEY, 'true');
      } else {
        safeRemove(IS_SUPERADMIN_KEY);
      }
      return { success: true, session };
    }

    if (remoteLogin.attempted && remoteLogin.error) {
      if (!isLocalSuperAdminCandidate) {
        recordLoginFailure(user, storeIdForThrottle);
        return { success: false, error: remoteLogin.error };
      }
    }

    if (!remoteLogin.success && !isLocalSuperAdminCandidate) {
      recordLoginFailure(user, storeIdForThrottle);
      return { success: false, error: 'Conta de e-mail precisa estar cadastrada no Supabase Auth para entrar.' };
    }
  }

  if (!isDesktopApp() && ENV.hasSupabase && user.includes('@') && !remoteAvailable) {
    recordLoginFailure(user, storeIdForThrottle);
    return {
      success: false,
      error: 'Nao foi possivel acessar o login remoto do Supabase neste dispositivo. Se estiver no celular ou PWA, atualize o app, limpe o cache do site e tente novamente.',
    };
  }

  if (!ENV.hasSupabase && superAdminRecord && normalizeUserEmail(superAdminRecord.email || superAdminRecord.username) === normalizeUserEmail(user)) {
    if (!superAdminRecord.active) {
      recordLoginFailure(user, storeIdForThrottle);
      return { success: false, error: 'Conta principal desativada.' };
    }

    const ok = await verifyPasswordHash(pass, superAdminRecord.passwordHash);
    if (!ok) {
      recordLoginFailure(user, storeIdForThrottle);
      return { success: false, error: 'Senha incorreta.' };
    }
    await upgradePasswordHashIfNeeded(users, superAdminRecord, pass);

    const session: UserSession = {
      userId: superAdminRecord.id,
      username: superAdminRecord.username,
      email: superAdminRecord.email || superAdminRecord.username,
      role: 'admin',
      isSuperAdmin: true,
      storeId: requestedStoreId,
      storeName: superAdminRecord.storeName,
      authSource: 'local',
      loginTime: nowIso(),
      expiresAt: computeExpiryDays(7),
    };

    setCurrentSession(session);
    setStoreId(requestedStoreId, { force: true, reason: 'login-superadmin' });
    clearLoginThrottle(user, storeIdForThrottle);
    safeWrite(IS_LOGGED_KEY, '1');
    safeWrite(IS_SUPERADMIN_KEY, 'true');
    return { success: true, session };
  }

  if (!isDesktopApp() && ENV.hasSupabase && isLocalSuperAdminCandidate) {
    recordLoginFailure(user, storeIdForThrottle);
    return { success: false, error: 'A conta principal precisa existir e entrar pelo Supabase Auth neste ambiente.' };
  }

  const record = findStoreUser(users, user, requestedStoreId);

  if (!record) {
    recordLoginFailure(user, storeIdForThrottle);
    return {
      success: false,
      error: ENV.hasSupabase
        ? 'Nao encontramos este acesso neste dispositivo. Se a conta funciona no PC, o celular pode estar com cache antigo. Atualize o app, limpe o cache do site e tente novamente.'
        : 'Cadastro nao encontrado para este e-mail e store_id.',
    };
  }

  if (!record.active) {
    recordLoginFailure(user, storeIdForThrottle);
    return { success: false, error: 'Usuário desativado.' };
  }

  const ok = await verifyPasswordHash(pass, record.passwordHash);
  if (!ok) {
    recordLoginFailure(user, storeIdForThrottle);
    return { success: false, error: 'Senha incorreta.' };
  }
  await upgradePasswordHashIfNeeded(users, record, pass);

  const storeId = record.storeId || requestedStoreId;
  const session: UserSession = {
    userId: record.id,
    username: record.username,
    email: record.email || record.username,
    role: record.role,
    storeId,
    storeName: record.storeName,
    authSource: 'local',
    loginTime: nowIso(),
    expiresAt: computeExpiryDays(7)
  };

  setCurrentSession(session);
  setStoreId(storeId, { force: true, reason: 'login-store-user' });
  clearLoginThrottle(user, storeIdForThrottle);
  safeWrite(IS_LOGGED_KEY, '1');
  safeRemove(IS_SUPERADMIN_KEY);

  return { success: true, session };
}

export function logout() {
  const session = safeRead<UserSession | null>(SESSION_KEY, null);
  if (session?.authSource === 'remote') {
    void signOutRemoteUser();
  }
  safeRemoveSession(SESSION_KEY);
  safeRemove(SESSION_KEY);
  safeRemove(IS_LOGGED_KEY);
  safeRemove(IS_SUPERADMIN_KEY);
}

export function getCurrentSession(): UserSession | null {
  const sessionFromSession = safeReadSession<UserSession | null>(SESSION_KEY, null);
  if (sessionFromSession) {
    safeWrite(SESSION_KEY, sessionFromSession);
    safeRemoveSession(SESSION_KEY);
  }

  const session = sessionFromSession || safeRead<UserSession | null>(SESSION_KEY, null);

  // expiração simples
  if (session?.expiresAt) {
    const exp = Date.parse(session.expiresAt);
    if (!Number.isNaN(exp) && Date.now() > exp) {
      logout();
      return null;
    }
  }

  if (session?.authSource === 'local' && ENV.hasSupabase) {
    logout();
    return null;
  }

  if (session) {
    return session;
  }
  return null;
}

export function setCurrentSession(session: UserSession | null) {
  if (!session) {
    logout();
    return;
  }
  safeWrite(SESSION_KEY, session);
  // compatibilidade temporária com builds antigos que ainda leem sessionStorage
  safeWriteSession(SESSION_KEY, session);
  safeWrite(IS_LOGGED_KEY, '1');
}

export async function syncCurrentSessionWithRemote(): Promise<UserSession | null> {
  const session = getCurrentSession();
  if (!session || session.authSource !== 'remote') {
    return session;
  }

  const remote = await fetchCurrentRemoteSessionProfile();
  if (!remote.success) {
    return session;
  }

  if (!remote.profile) {
    logout();
    return null;
  }

  if (!remote.profile.active) {
    logout();
    return null;
  }

  const synced = createSessionFromRemoteProfile(remote.profile, session.storeId);
  setCurrentSession(synced);
  setStoreId(synced.storeId, { force: true, reason: 'sync-current-session-remote' });
  return synced;
}

export function isAuthenticated() {
  return !!getCurrentSession();
}

export function isAdmin() {
  const s = getCurrentSession();
  return s?.role === 'admin';
}

export function isSuperAdmin() {
  const session = getCurrentSession();
  return Boolean(session?.isSuperAdmin);
}

export function getCurrentUser(): Usuario | null {
  const s = getCurrentSession();
  if (!s) return null;
  return {
    id: s.userId,
    nome: s.username,
    email: s.email || s.username,
    role: s.role,
    isSuperAdmin: s.isSuperAdmin,
    active: true,
    lastLogin: s.loginTime
  };
}

export async function createPasswordHash(password: string): Promise<string> {
  const saltHex = randomSaltHex();
  const hashHex = await derivePbkdf2Hex(password, saltHex, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_VERSION}:${PASSWORD_HASH_ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function getUserStores(_authUserId: string): Promise<{ success: boolean; stores: UserStoreAccess[]; error?: string }> {
  cleanupLegacyAdminUsers();
  const session = getCurrentSession();
  if (session?.authSource === 'remote') {
    return {
      success: true,
      stores: [{
        store_id: session.storeId,
        store_name: session.storeName || `Loja ${session.storeId}`,
        role: session.role,
      }],
    };
  }

  // Modo local: sempre 1 loja ativa
  const storeId = getStoreIdOrFallback();
  const role: UserRole = session?.role || 'admin';

  return {
    success: true,
    stores: [{ store_id: storeId, store_name: 'Smart Tech PDV (Local)', role }]
  };
}

export async function listUsers(): Promise<{ success: boolean; users?: AppUser[]; error?: string }> {
  cleanupLegacyAdminUsers();
  await ensurePrimarySuperAdmin();
  const session = getCurrentSession();
  if (!session) return { success: false, error: 'Sessao invalida.' };

   if ((session.authSource === 'remote' || session.isSuperAdmin) && await canUseRemoteUserAuth()) {
    const remote = await listRemoteUserProfiles({
      storeId: session.storeId,
      isSuperAdmin: session.isSuperAdmin,
    });
    if (!remote.success || !remote.users) {
      return { success: false, error: remote.error || 'Nao foi possivel carregar os perfis remotos.' };
    }

    return {
      success: true,
      users: remote.users.map((user) => ({
        id: user.id,
        username: user.email,
        email: user.email,
        storeId: user.store_id || undefined,
        storeName: user.store_name || undefined,
        isSuperAdmin: user.is_super_admin,
        role: user.role,
        active: user.active,
        createdAt: user.created_at || nowIso(),
        updatedAt: user.updated_at || nowIso(),
      })),
    };
  }

  const users = loadUsers()
    .filter((user) => session.isSuperAdmin ? true : !user.isSuperAdmin && user.storeId === session.storeId)
    .map(({ passwordHash: _ph, ...rest }) => rest);
  return { success: true, users };
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  options?: {
    email?: string;
    storeId?: string;
    storeName?: string;
    isSuperAdmin?: boolean;
  }
): Promise<{ success: boolean; error?: string; inviteToken?: string; inviteEmail?: string }> {
  cleanupLegacyAdminUsers();
  await ensurePrimarySuperAdmin();

  const session = getCurrentSession();
  if (!session) return { success: false, error: 'Sessao invalida.' };
  if (session.role !== 'admin' && !session.isSuperAdmin) {
    return { success: false, error: 'Apenas administradores podem criar usuarios.' };
  }

  if ((session.authSource === 'remote' || session.isSuperAdmin) && await canUseRemoteUserAuth()) {
    const email = normalizeUserEmail(options?.email || username);
    const requestedStoreId = String(options?.storeId || session.storeId || '').trim();
    if (!email || !email.includes('@')) return { success: false, error: 'Informe um e-mail valido.' };
    if (!requestedStoreId || !isValidUUID(requestedStoreId)) {
      return { success: false, error: 'Informe um store_id valido para o convite.' };
    }
    if (!session.isSuperAdmin && requestedStoreId !== session.storeId) {
      return { success: false, error: 'Admin da loja so pode convidar usuarios da propria loja.' };
    }

    const invite = await createRemoteUserInvite({
      email,
      storeId: requestedStoreId,
      storeName: options?.storeName || session.storeName,
      role,
    });

    if (!invite.success || !invite.invite) {
      return { success: false, error: invite.error || 'Nao foi possivel criar o convite remoto.' };
    }

    return {
      success: true,
      inviteToken: invite.invite.token,
      inviteEmail: invite.invite.email,
    };
  }

  const email = normalizeUserEmail(options?.email || username);
  const requestedStoreId = String(options?.storeId || session.storeId || '').trim();
  const requestedSuperAdmin = options?.isSuperAdmin === true;

  if (!email || !email.includes('@')) return { success: false, error: 'Informe um e-mail valido.' };
  if (!password || password.length < 6) return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };

  if (requestedSuperAdmin) {
    if (!session.isSuperAdmin) return { success: false, error: 'Apenas a conta principal pode criar SuperAdmin.' };
    const existingSuperAdmin = findAnySuperAdminUser(loadUsers());
    if (existingSuperAdmin) return { success: false, error: 'Ja existe uma conta principal SuperAdmin.' };
  } else {
    if (!requestedStoreId || !isValidUUID(requestedStoreId)) {
      return { success: false, error: 'Informe um store_id valido para o usuario.' };
    }
    if (!session.isSuperAdmin && requestedStoreId !== session.storeId) {
      return { success: false, error: 'Admin da loja so pode criar usuarios da propria loja.' };
    }
  }

  const users = loadUsers();
  if (!requestedSuperAdmin && findSuperAdminUser(users, email)) {
    return { success: false, error: 'Este e-mail esta reservado para a conta principal do sistema.' };
  }
  const duplicate = requestedSuperAdmin
    ? findSuperAdminUser(users, email)
    : findStoreUser(users, email, requestedStoreId);
  if (duplicate) return { success: false, error: 'Ja existe usuario com este e-mail nesse escopo.' };

  const createdAt = nowIso();
  users.push({
    id: genId(),
    username: email,
    email,
    role,
    isSuperAdmin: requestedSuperAdmin,
    storeId: requestedSuperAdmin ? undefined : requestedStoreId,
    storeName: requestedSuperAdmin ? 'SuperAdmin' : options?.storeName,
    active: true,
    createdAt,
    updatedAt: createdAt,
    passwordHash: await createPasswordHash(password),
  });
  saveUsers(users);
  return { success: true };
}

export async function getInviteInfo(token: string): Promise<{
  success: boolean;
  error?: string;
  invite?: {
    email: string;
    role: UserRole;
    storeId: string;
    storeName?: string | null;
  };
}> {
  if (!token) return { success: false, error: 'Convite ausente.' };
  const result = await getRemoteInviteByToken(token);
  if (!result.success) return { success: false, error: result.error };
  if (!result.invite) return { success: false, error: 'Convite nao encontrado ou expirado.' };
  return {
    success: true,
    invite: {
      email: result.invite.email,
      role: result.invite.role,
      storeId: result.invite.store_id,
      storeName: result.invite.store_name,
    },
  };
}

export async function completeInvitedUserRegistration(params: {
  token: string;
  password: string;
}): Promise<{
  success: boolean;
  error?: string;
  credentials?: {
    storeId: string;
    storeName: string;
    email: string;
    password: string;
    createdAt: string;
  };
}> {
  const result = await acceptRemoteUserInvite(params);
  if (!result.success || !result.profile || !result.invite) {
    return { success: false, error: result.error || 'Nao foi possivel concluir o convite.' };
  }

  return {
    success: true,
    credentials: {
      storeId: result.invite.store_id,
      storeName: result.invite.store_name || `Loja ${result.invite.store_id}`,
      email: result.invite.email,
      password: params.password,
      createdAt: nowIso(),
    },
  };
}

export async function registerStoreOwner(params: {
  storeName: string;
  email: string;
  password: string;
  storeId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  credentials?: {
    storeId: string;
    storeName: string;
    email: string;
    password: string;
    createdAt: string;
  };
}> {
  cleanupLegacyAdminUsers();

  const storeName = String(params.storeName || '').trim();
  const email = normalizeUserEmail(params.email);
  const password = String(params.password || '');
  const lockedDesktopStoreId = getLockedDesktopStoreId();
  const requestedStoreId = String(params.storeId || lockedDesktopStoreId || genId()).trim();
  if (lockedDesktopStoreId && requestedStoreId !== lockedDesktopStoreId) {
    return { success: false, error: `Este Desktop já está vinculado à loja ${lockedDesktopStoreId}. Troca de Store ID somente em modo suporte.` };
  }
  const storeId = requestedStoreId;

  if (!storeName) return { success: false, error: 'Informe o nome da loja.' };
  if (!email || !email.includes('@')) return { success: false, error: 'Informe um e-mail valido.' };
  if (password.length < 6) return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  if (!isValidUUID(storeId)) return { success: false, error: 'Nao foi possivel gerar um store_id valido.' };
  const createdAt = nowIso();

  setStoreId(storeId, { force: true, reason: 'register-store-owner-preflight' });

  if (!isDesktopApp() && await canUseRemoteUserAuth()) {
    const remote = await registerRemoteStoreOwner({
      storeId,
      storeName,
      email,
      password,
    });

    if (!remote.success) {
      return { success: false, error: remote.error || 'Nao foi possivel criar o cadastro remoto da loja.' };
    }

    return {
      success: true,
      credentials: {
        storeId,
        storeName,
        email,
        password,
        createdAt,
      },
    };
  }

  if (ENV.hasSupabase) {
    return { success: false, error: 'Cadastro da loja exige Supabase configurado e disponível.' };
  }

  const users = loadUsers();
  if (findSuperAdminUser(users, email)) {
    return { success: false, error: 'Este e-mail esta reservado para a conta principal do sistema.' };
  }
  const existing = findStoreUser(users, email, storeId);
  if (existing) {
    return { success: false, error: 'Ja existe cadastro para este e-mail nesta loja.' };
  }

  const record: LocalUserRecord = {
    id: genId(),
    username: email,
    email,
    storeId,
    storeName,
    role: 'admin',
    active: true,
    createdAt,
    updatedAt: createdAt,
    passwordHash: await createPasswordHash(password),
  };

  users.push(record);
  saveUsers(users);
  setStoreId(storeId, { force: true, reason: 'register-store-owner' });

  return {
    success: true,
    credentials: {
      storeId,
      storeName,
      email,
      password,
      createdAt,
    },
  };
}

export async function updateUserRole(userId: string, role: UserRole): Promise<{ success: boolean; error?: string }> {
  cleanupLegacyAdminUsers();
  await ensurePrimarySuperAdmin();
  const session = getCurrentSession();
  if ((session?.authSource === 'remote' || session?.isSuperAdmin) && await canUseRemoteUserAuth()) {
    return await updateRemoteUserProfileRole(userId, role);
  }
  const users = loadUsers();
  const u = users.find(x => x.id === userId);
  if (!u) {
    return { success: false, error: 'Usuário não encontrado.' };
  }
  if (!canManageUserRecord(session, u)) {
    return { success: false, error: 'Sem permissao para alterar este usuario.' };
  }
  if (u.isSuperAdmin) {
    return { success: false, error: 'Nao altere a role da conta principal.' };
  }
  u.role = role;
  u.updatedAt = nowIso();
  saveUsers(users);
  return { success: true };
}

export async function toggleUserActive(userId: string, active: boolean): Promise<{ success: boolean; error?: string }> {
  cleanupLegacyAdminUsers();
  await ensurePrimarySuperAdmin();
  const session = getCurrentSession();
  if ((session?.authSource === 'remote' || session?.isSuperAdmin) && await canUseRemoteUserAuth()) {
    if (session.userId === userId && active === false) {
      return { success: false, error: 'Nao desative a propria conta ativa.' };
    }
    return await updateRemoteUserProfileActive(userId, active);
  }
  const users = loadUsers();
  const u = users.find(x => x.id === userId);
  if (!u) {
    return { success: false, error: 'Usuário não encontrado.' };
  }
  if (!canManageUserRecord(session, u)) {
    return { success: false, error: 'Sem permissao para alterar este usuario.' };
  }
  if (u.isSuperAdmin && active === false) {
    return { success: false, error: 'A conta principal SuperAdmin nao pode ser desativada.' };
  }
  u.active = !!active;
  u.updatedAt = nowIso();
  saveUsers(users);
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  cleanupLegacyAdminUsers();
  await ensurePrimarySuperAdmin();
  const session = getCurrentSession();
  if ((session?.authSource === 'remote' || session?.isSuperAdmin) && await canUseRemoteUserAuth()) {
    const remoteUsers = await listRemoteUserProfiles({
      storeId: session.storeId,
      isSuperAdmin: session.isSuperAdmin,
    });
    if (!remoteUsers.success) {
      return { success: false, error: remoteUsers.error || 'Não foi possível consultar os usuários remotos.' };
    }
    const target = (remoteUsers.users || []).find((user) => user.id === userId);
    if (!target?.email) {
      return { success: false, error: 'Usuário remoto não encontrado.' };
    }
    return await sendRemotePasswordRecoveryEmail({
      email: target.email,
      redirectTo: `${window.location.origin}/reset-senha`,
    });
  }
  if (!newPassword) return { success: false, error: 'Senha inválida.' };
  const users = loadUsers();
  const u = users.find(x => x.id === userId);
  if (!u) {
    return { success: false, error: 'Usuário não encontrado.' };
  }
  if (!canManageUserRecord(session, u)) {
    return { success: false, error: 'Sem permissao para alterar este usuario.' };
  }
  u.passwordHash = await createPasswordHash(newPassword);
  u.updatedAt = nowIso();
  saveUsers(users);
  return { success: true };
}

export async function verifyPasswordHash(password: string, expectedHash: string): Promise<boolean> {
  const stored = String(expectedHash || '');
  const parsed = parsePbkdf2Hash(stored);
  if (parsed) {
    const candidate = await derivePbkdf2Hex(password, parsed.saltHex, parsed.iterations);
    return timingSafeStringEqual(candidate, parsed.hashHex);
  }

  // Compatibilidade com versões antigas: SHA-256 puro.
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    return timingSafeStringEqual(await sha256Hex(password), stored);
  }

  // Compatibilidade extrema com fallback legado antigo. Não cria novos plain:* hashes.
  if (stored.startsWith('plain:')) {
    return timingSafeStringEqual(stored, `plain:${password}`);
  }

  return false;
}


