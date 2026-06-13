/**
 * Atualização Offline por Pacote (Desktop/Tauri)
 *
 * Formato do pacote (.zip):
 * - update.token           (string)  => token assinado (RSA-PSS/SHA-256) com metadados
 * - payload/<fileName>     (binário) => instalador/zip da atualização
 *
 * O token segue o mesmo padrão da licença:
 *   base64url(JSON payload) + "." + base64url(assinatura)
 */

import JSZip from 'jszip';
import { BUILD_VERSION } from '@/config/buildInfo';
import { compareVersions } from '@/lib/updates';
import { LICENSE_PUBLIC_JWK } from '@/lib/license-public-key';
import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';
import { openFileWithDialog, readFileBytesByPlatform, statFileByPlatform } from '@/lib/capabilities/file-open-adapter';
import { saveBlobWithDialogResult } from '@/lib/capabilities/file-save-adapter';

export type UpdatePayload = {
  v: 1;
  app: 'smart-tech-pdv';
  kind: 'update';
  version: string;
  createdAt: string; // ISO
  fileName: string;
  fileSize: number;
  sha256: string; // base64url(sha256(payloadFileBytes))
  minVersion?: string;
  note?: string;
};

const MAX_UPDATE_ZIP_BYTES = 350 * 1024 * 1024; // 350MB (hard limit)

export type VerifiedUpdatePackage = {
  token: string;
  payload: UpdatePayload;
  fileBytes: Uint8Array;
};

function base64urlToBytes(input: string): Uint8Array {
  const b64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    + '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function sha256Base64url(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return bytesToBase64url(new Uint8Array(digest));
}

function decodeUpdatePayload(token: string): UpdatePayload | null {
  try {
    const [p] = token.split('.');
    if (!p) return null;
    const json = new TextDecoder().decode(base64urlToBytes(p));
    const payload = safeJsonParse<UpdatePayload>(json);
    if (!payload) return null;
    if (payload.v !== 1) return null;
    if (payload.app !== 'smart-tech-pdv') return null;
    if (payload.kind !== 'update') return null;
    if (!payload.version || !payload.fileName || !payload.sha256) return null;
    return payload;
  } catch {
    return null;
  }
}

async function verifyTokenSignature(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const payloadB64 = parts[0];
    const sigBytes = base64urlToBytes(parts[1]);

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
      toArrayBuffer(sigBytes),
      toArrayBuffer(new TextEncoder().encode(payloadB64))
    );
  } catch {
    return false;
  }
}

async function pickUpdatePackagePath(): Promise<string | null> {
  const selected = await openFileWithDialog({
    multiple: false,
    filters: [{ name: 'Pacote de Atualização', extensions: ['zip'] }],
    allowedExtensions: ['zip']
  });

  if (!selected) {
    logger.warn('[UpdatePackage] Falha ao abrir dialog ou operação cancelada.');
    return null;
  }

  return Array.isArray(selected) ? String(selected[0] || '') || null : String(selected);
}

async function readFileBytes(filePath: string): Promise<Uint8Array | null> {
  try {
    try {
      const meta = await statFileByPlatform(filePath);
      const size = Number((meta as any)?.size ?? 0);
      if (size && size > MAX_UPDATE_ZIP_BYTES) {
        logger.warn('[UpdatePackage] Pacote grande demais:', size);
        return null;
      }
    } catch { /* ignore */ }
    return await readFileBytesByPlatform(filePath);
  } catch (e) {
    logger.warn('[UpdatePackage] Falha ao ler arquivo:', e);
    return null;
  }
}

function findPayloadEntry(zip: JSZip, fileName: string): JSZip.JSZipObject | null {
  const direct = zip.file(`payload/${fileName}`);
  if (direct) return direct;

  // fallback: pega o 1º arquivo dentro de payload/
  const keys = Object.keys(zip.files || {});
  const first = keys.find((k) => k.startsWith('payload/') && !zip.files[k]?.dir);
  return first ? zip.file(first) : null;
}

export async function pickAndVerifyUpdatePackage(): Promise<{
  pkg?: VerifiedUpdatePackage;
  canceled?: boolean;
  error?: string;
}> {
  if (!isDesktopApp()) return { error: 'Disponível apenas no Desktop (Tauri).' };

  const path = await pickUpdatePackagePath();
  if (!path) return { canceled: true };

  const zipBytes = await readFileBytes(path);
  if (!zipBytes) return { error: 'Não foi possível ler o arquivo do pacote.' };

  try {
    const zip = await JSZip.loadAsync(zipBytes);

    const tokenEntry = zip.file('update.token');
    if (!tokenEntry) return { error: 'Pacote inválido: update.token não encontrado.' };
    const token = (await tokenEntry.async('string')).trim();
    if (!token || !token.includes('.')) return { error: 'Pacote inválido: token vazio.' };

    const payload = decodeUpdatePayload(token);
    if (!payload) return { error: 'Pacote inválido: token não reconhecido.' };

    const signatureOk = await verifyTokenSignature(token);
    if (!signatureOk) return { error: 'Assinatura do pacote inválida (não confie neste arquivo).' };

    const payloadEntry = findPayloadEntry(zip, payload.fileName);
    if (!payloadEntry) return { error: 'Pacote inválido: payload não encontrado.' };

    const fileBytes = await payloadEntry.async('uint8array');
    const fileHash = await sha256Base64url(fileBytes);
    if (fileHash !== payload.sha256) {
      return { error: 'Pacote corrompido: SHA256 do instalador não confere.' };
    }

    // Proteções: evita downgrade e garante versão mínima (se definida)
    if (payload.minVersion && compareVersions(BUILD_VERSION, payload.minVersion) < 0) {
      return { error: `Este pacote exige versão mínima ${payload.minVersion}. Sua versão atual é ${BUILD_VERSION}.` };
    }
    if (compareVersions(payload.version, BUILD_VERSION) <= 0) {
      return { error: `Este pacote é da versão ${payload.version}, mas seu app já está na versão ${BUILD_VERSION}. (Downgrade/mesma versão não permitido)` };
    }

    return {
      pkg: {
        token,
        payload,
        fileBytes,
      },
    };
  } catch (e: any) {
    logger.warn('[UpdatePackage] Falha ao validar zip:', e);
    return { error: e?.message || 'Falha ao validar pacote.' };
  }
}

export async function saveUpdatePayloadFile(pkg: VerifiedUpdatePackage): Promise<{
  savedPath?: string;
  canceled?: boolean;
  error?: string;
}> {
  if (!isDesktopApp()) return { error: 'Disponível apenas no Desktop (Tauri).' };
  try {
    const p = pkg?.payload;
    const defaultName = p?.fileName || 'smart-tech-update.bin';
    const extension = defaultName.split('.').pop() || 'bin';
    const safeBytes = new Uint8Array(pkg.fileBytes);
    const result = await saveBlobWithDialogResult(new Blob([safeBytes]), {
      filename: defaultName,
      filters: [{ name: 'Atualização Smart Tech', extensions: [extension] }],
      allowedExtensions: [extension]
    });

    if (!result.ok) return { canceled: true };
    return { savedPath: result.path || defaultName };
  } catch (e: any) {
    logger.warn('[UpdatePackage] Falha ao salvar payload:', e);
    return { error: e?.message || 'Falha ao salvar o instalador.' };
  }
}

export function formatBytes(bytes: number): string {
  const n = Number(bytes || 0);
  if (!n || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let u = 0;
  let v = n;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}
