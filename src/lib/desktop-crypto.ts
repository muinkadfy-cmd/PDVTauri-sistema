/**
 * Desktop Crypto (Tauri)
 *
 * Objetivo:
 * - Criptografar dados sensíveis no Desktop (SQLite + KV) para dificultar cópia/tamper.
 * - NÃO depende de internet.
 *
 * Estratégia:
 * - Cria um segredo aleatório (32 bytes) em AppData/secure/crypto.key
 * - Usa AES-GCM (256) via WebCrypto
 * - Formato do payload:
 *   enc:v1:<iv_b64>:<cipher_b64>
 */

import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';
import { ensureDesktopDir, readDesktopFileBytes, writeDesktopFileBytes } from '@/lib/capabilities/desktop-fs-adapter';
import { getDesktopPaths, joinDesktopPath } from '@/lib/capabilities/desktop-path-adapter';

const PREFIX = 'enc:v1:';

type ReadKeyResult =
  | { kind: 'ok'; bytes: Uint8Array }
  | { kind: 'missing' }
  | { kind: 'denied'; error: unknown }
  | { kind: 'error'; error: unknown };

function classifyFsError(e: unknown): 'missing' | 'denied' | 'other' {
  const msg = String((e as any)?.message ?? e ?? '').toLowerCase();
  if (msg.includes('not found') || msg.includes('no such file') || msg.includes('enoent')) return 'missing';
  if (
    msg.includes('permission') ||
    msg.includes('access is denied') ||
    msg.includes('denied') ||
    msg.includes('acl') ||
    msg.includes('not allowed')
  ) return 'denied';
  return 'other';
}

let _cryptoDisabledReason: string | null = null;

function disableCryptoForSession(reason: string, err?: unknown): void {
  if (_cryptoDisabledReason) return;
  _cryptoDisabledReason = reason;
  try {
    (window as any).__smarttechCryptoDisabled = true;
    (window as any).__smarttechCryptoDisabledReason = reason;
  } catch {
    // ignore
  }
  logger.error(`[DesktopCrypto] DESABILITADO nesta sessão: ${reason}`, err);
}

// Em DEV não criptografa para facilitar debug.
export function isDesktopCryptoEnabled(): boolean {
  if (!isDesktopApp()) return false;
  if (import.meta.env.DEV) return false;
  if (_cryptoDisabledReason) return false;
  return true;
}

function b64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(input: string): Uint8Array {
  const bin = atob(input);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let _keyPromise: Promise<CryptoKey> | null = null;

async function getOrCreateSecretBytes(): Promise<Uint8Array> {
  // Guard: se por algum motivo não existir crypto no runtime, não quebra.
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('WebCrypto indisponível');
  }

  const paths = await getDesktopPaths();
  const appData = paths.appDataDir || '';
  const appLocal = paths.appLocalDataDir || '';

  const dir = appData ? await joinDesktopPath(appData, 'secure') : '';
  const filePath = dir ? await joinDesktopPath(dir, 'crypto.key') : '';
  const backupPath = dir ? await joinDesktopPath(dir, 'crypto.key.bak') : '';

  // ✅ P0: em algumas atualizações/configurações, o diretório pode “migrar” entre AppData e AppLocalData.
  // Se isso acontecer, perder o crypto.key faz o app “parecer que zerou” (dados criptografados ficam ilegíveis).
  const localDir = appLocal ? await joinDesktopPath(appLocal, 'secure') : '';
  const localFilePath = localDir ? await joinDesktopPath(localDir, 'crypto.key') : '';
  const localBackupPath = localDir ? await joinDesktopPath(localDir, 'crypto.key.bak') : '';

  async function readKey(p: string): Promise<ReadKeyResult> {
    try {
      const u = await readDesktopFileBytes(p);
      if (u.byteLength < 16) return { kind: 'missing' };
      return { kind: 'ok', bytes: u.slice(0, 32) };
    } catch (e) {
      const t = classifyFsError(e);
      if (t === 'missing') return { kind: 'missing' };
      if (t === 'denied') return { kind: 'denied', error: e };
      return { kind: 'error', error: e };
    }
  }

  async function writeKey(parentDir: string, p: string, bytes: Uint8Array): Promise<void> {
    try {
      await ensureDesktopDir(parentDir).catch(() => undefined);
      await writeDesktopFileBytes(p, bytes.slice(0, 32)).catch(() => undefined);
    } catch {
      // ignore
    }
  }

  // 1) AppData principal (canônico)
  const primary = await readKey(filePath);
  if (primary.kind === 'ok') {
    // manter backup sincronizado
    await writeKey(dir, backupPath, primary.bytes);
    // ⚠️ Não manter cópia contínua em AppLocalData (evita divergência Local vs Roaming)
    return primary.bytes;
  }

  // 2) AppData backup
  const primaryBak = await readKey(backupPath);
  if (primaryBak.kind === 'ok') {
    logger.warn('[DesktopCrypto] Recuperado de crypto.key.bak — restaurando principal...');
    await writeKey(dir, filePath, primaryBak.bytes);
    return primaryBak.bytes;
  }

  // 3) AppLocalData principal (fallback de migração)
  if (localFilePath) {
    const local = await readKey(localFilePath);
    if (local.kind === 'ok') {
      logger.warn('[DesktopCrypto] Recuperado crypto.key de AppLocalData — migrando para AppData...');
      await writeKey(dir, filePath, local.bytes);
      await writeKey(dir, backupPath, local.bytes);
      return local.bytes;
    }
  }

  // 4) AppLocalData backup (fallback)
  if (localBackupPath) {
    const localBak = await readKey(localBackupPath);
    if (localBak.kind === 'ok') {
      logger.warn('[DesktopCrypto] Recuperado crypto.key.bak de AppLocalData — migrando para AppData...');
      await writeKey(dir, filePath, localBak.bytes);
      await writeKey(dir, backupPath, localBak.bytes);
      return localBak.bytes;
    }
  }

  // ✅ P0: se houver qualquer sinal de ACL/permissão, NÃO gere uma key nova.
  // Isso é a principal causa de "zerou após reiniciar": uma key nova torna o DB antigo ilegível.
  if (primary.kind === 'denied' || primaryBak.kind === 'denied') {
    disableCryptoForSession('Sem permissão para ler crypto.key em AppData (ACL).', { primary, primaryBak });
    throw new Error('DesktopCryptoDisabled: ACL(AppData)');
  }

  // Nenhum key disponível — gera novo (dados existentes ficam inacessíveis se DB já existia)
  logger.error('[DesktopCrypto] crypto.key não encontrado nem recuperável — gerando novo. Dados anteriores podem ser inacessíveis.');

  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);

  await writeKey(dir, filePath, secret);
  await writeKey(dir, backupPath, secret);
  // ⚠️ Não criar/atualizar cópia em AppLocalData automaticamente.
  // Manter uma segunda key em Local é justamente o que causa divergência e “zerar” ao reabrir.

  return secret;
}


async function getKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise;
  _keyPromise = (async () => {
    const secret = await getOrCreateSecretBytes();
    // TS (lib.dom) tipa Uint8Array como ArrayBufferLike; WebCrypto pede ArrayBuffer.
    const secretCopy = new Uint8Array(secret);
    const keyData = secretCopy.buffer as ArrayBuffer;
    return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  })();
  return _keyPromise;
}

export function isEncryptedString(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export async function encryptString(plain: string): Promise<string> {
  const key = await getKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const enc = new TextEncoder().encode(String(plain ?? ''));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  const cipher = new Uint8Array(cipherBuf);
  return `${PREFIX}${b64(iv)}:${b64(cipher)}`;
}

export async function decryptString(value: string): Promise<string> {
  if (!isEncryptedString(value)) return value;
  const rest = value.slice(PREFIX.length);
  const [ivB64, cipherB64] = rest.split(':');
  if (!ivB64 || !cipherB64) throw new Error('Formato inválido');
  const iv = fromB64(ivB64);
  const cipher = fromB64(cipherB64);
  const key = await getKey();
  // TS (lib.dom) pode inferir Uint8Array<SharedArrayBuffer>; WebCrypto exige BufferSource baseado em ArrayBuffer.
  // Copiamos para garantir ArrayBuffer por baixo.
  const ivCopy = new Uint8Array(iv);
  const cipherCopy = new Uint8Array(cipher);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivCopy }, key, cipherCopy);
  return new TextDecoder().decode(new Uint8Array(plainBuf));
}

export async function encryptIfEnabled(plain: string): Promise<string> {
  if (!isDesktopCryptoEnabled()) return plain;
  try {
    return await encryptString(plain);
  } catch (e) {
    // Melhor degradar para texto puro do que gerar key nova ou quebrar persistência.
    disableCryptoForSession('Falha ao criptografar (provável ACL/crypto.key indisponível).', e);
    return plain;
  }
}

export async function decryptIfNeeded(value: string): Promise<string> {
  if (!isDesktopCryptoEnabled()) return value;
  if (!isEncryptedString(value)) return value;
  try {
    return await decryptString(value);
  } catch (e) {
    // Não transformar em "vazio" silencioso: o chamador decide como lidar.
    disableCryptoForSession('Falha ao descriptografar (key divergente/ACL).', e);
    throw e;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deriva uma senha estável (hex) para SQLCipher a partir do mesmo segredo do crypto.key.
 * - Em DEV (ou se crypto estiver desabilitado), retorna '' e o DB fica sem criptografia.
 * - Em PROD desktop, retorna uma senha forte e estável.
 */
export async function getSqlcipherPassphrase(): Promise<string> {
  if (!isDesktopCryptoEnabled()) return '';
  let secret: Uint8Array;
  try {
    secret = await getOrCreateSecretBytes();
  } catch (e) {
    disableCryptoForSession('Falha ao obter segredo para SQLCipher (ACL).', e);
    return '';
  }
  const purpose = new TextEncoder().encode('sqlcipher-v1');
  const data = new Uint8Array(secret.length + purpose.length);
  data.set(secret, 0);
  data.set(purpose, secret.length);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}
