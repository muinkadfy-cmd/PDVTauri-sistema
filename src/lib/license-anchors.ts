/**
 * License/Trial Anchors (Desktop hardening)
 *
 * Objetivo (P1):
 * - Dificultar "reset"/tamper que depende apenas do LocalStorage ou só do SQLite.
 * - Criar uma âncora redundante em arquivo no AppData/secure, usando o mesmo
 *   mecanismo de criptografia/tamper-detect do DesktopCrypto (AES-GCM em PROD).
 *
 * Observação importante:
 * - Offline nunca é 100% "impossível" de burlar se o usuário puder apagar TODO AppData.
 *   Aqui a meta é: resistir a limpezas parciais (WebView cache/storage) e a falhas/remoções
 *   do DB KV isoladamente.
 */

import { isDesktopApp } from '@/lib/platform';
import { kvGet, kvSet } from '@/lib/desktop-kv';
import { decryptIfNeeded, encryptIfEnabled } from '@/lib/desktop-crypto';
import { logger } from '@/utils/logger';
import { readSecureAnchorFile, writeSecureAnchorFile } from '@/lib/capabilities/secure-anchor-file-adapter';

type AnchorV1 = {
  v: 1;
  startMs?: number;
  lastSeenMs?: number;
};

const TRIAL_ANCHOR_KV_KEY = 'trial_anchor_v1';
const LICENSE_ANCHOR_KV_KEY = 'license_anchor_v1';

const TRIAL_ANCHOR_FILE = 'trial.anchor';
const LICENSE_ANCHOR_FILE = 'license.anchor';

function safeNumber(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAnchor(raw: any): AnchorV1 | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.v !== 1) return null;
    const startMs = safeNumber(raw.startMs);
    const lastSeenMs = safeNumber(raw.lastSeenMs);
    return {
      v: 1,
      ...(startMs > 0 ? { startMs } : {}),
      ...(lastSeenMs > 0 ? { lastSeenMs } : {}),
    };
  } catch {
    return null;
  }
}

async function readAnchorFromKv(key: string): Promise<AnchorV1 | null> {
  if (!isDesktopApp()) return null;
  try {
    const raw = await kvGet(key);
    if (!raw) return null;
    const decoded = await decryptIfNeeded(raw);
    const parsed = JSON.parse(decoded);
    return normalizeAnchor(parsed);
  } catch {
    return null;
  }
}

async function writeAnchorToKv(key: string, value: AnchorV1): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const json = JSON.stringify(value);
    const enc = await encryptIfEnabled(json);
    await kvSet(key, enc);
  } catch {
    // ignore
  }
}

async function readAnchorFromFile(filename: string): Promise<AnchorV1 | null> {
  if (!isDesktopApp()) return null;
  try {
    const text = await readSecureAnchorFile(filename);
    if (!text) return null;
    const decoded = await decryptIfNeeded(text);
    return normalizeAnchor(JSON.parse(decoded));
  } catch {
    return null;
  }
}

async function writeAnchorToFile(filename: string, value: AnchorV1): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const json = JSON.stringify(value);
    const enc = await encryptIfEnabled(json);
    await writeSecureAnchorFile(filename, enc);
  } catch (e) {
    logger.debug?.('[Anchors] Falha ao escrever arquivo de âncora:', e);
  }
}

export async function readTrialAnchor(): Promise<{ startMs: number; lastSeenMs: number }> {
  if (!isDesktopApp()) return { startMs: 0, lastSeenMs: 0 };
  const kv = await readAnchorFromKv(TRIAL_ANCHOR_KV_KEY);
  const file = await readAnchorFromFile(TRIAL_ANCHOR_FILE);

  const starts = [kv?.startMs, file?.startMs].filter((n): n is number => typeof n === 'number' && n > 0);
  const startMs = starts.length ? Math.min(...starts) : 0;

  const lastSeenMs = Math.max(kv?.lastSeenMs || 0, file?.lastSeenMs || 0, 0);

  return { startMs: safeNumber(startMs), lastSeenMs: safeNumber(lastSeenMs) };
}

export async function writeTrialAnchor(input: { startMs: number; lastSeenMs: number }): Promise<void> {
  if (!isDesktopApp()) return;
  const value: AnchorV1 = {
    v: 1,
    ...(input.startMs > 0 ? { startMs: input.startMs } : {}),
    ...(input.lastSeenMs > 0 ? { lastSeenMs: input.lastSeenMs } : {}),
  };
  await Promise.all([
    writeAnchorToKv(TRIAL_ANCHOR_KV_KEY, value),
    writeAnchorToFile(TRIAL_ANCHOR_FILE, value),
  ]).catch(() => undefined);
}

export async function readLicenseAnchor(): Promise<{ lastSeenMs: number }> {
  if (!isDesktopApp()) return { lastSeenMs: 0 };
  const kv = await readAnchorFromKv(LICENSE_ANCHOR_KV_KEY);
  const file = await readAnchorFromFile(LICENSE_ANCHOR_FILE);
  const lastSeenMs = Math.max(kv?.lastSeenMs || 0, file?.lastSeenMs || 0, 0);
  return { lastSeenMs: safeNumber(lastSeenMs) };
}

export async function writeLicenseAnchor(input: { lastSeenMs: number }): Promise<void> {
  if (!isDesktopApp()) return;
  const value: AnchorV1 = {
    v: 1,
    ...(input.lastSeenMs > 0 ? { lastSeenMs: input.lastSeenMs } : {}),
  };
  await Promise.all([
    writeAnchorToKv(LICENSE_ANCHOR_KV_KEY, value),
    writeAnchorToFile(LICENSE_ANCHOR_FILE, value),
  ]).catch(() => undefined);
}
