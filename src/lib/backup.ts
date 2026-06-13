/**
 * Sistema de Backup e Restore
 * Exporta e importa todos os dados do tenant atual
 */

import { logger } from '@/utils/logger';
import { addToOutbox } from './repository/outbox';
import { isLocalOnly } from './mode';
import { getClientId, getStoragePrefix } from './tenant';
import { safeGet, safeRemove, safeSet } from './storage';
import { 
  clientesRepo, 
  produtosRepo, 
  vendasRepo, 
  ordensRepo, 
  financeiroRepo, 
  cobrancasRepo, 
  devolucoesRepo, 
  encomendasRepo, 
  recibosRepo, 
  codigosRepo,
  settingsRepo,
  pessoasRepo,
  usadosRepo,
  usadosVendasRepo,
  usadosArquivosRepo,
  fornecedoresRepo,
  taxasPagamentoRepo
} from './repositories';
import { getOutboxItems } from './repository/outbox';
import { getDeviceId } from './device';
import { getUsuario } from './usuario';
import { getPinnedBackupDirectory, writeFileToDirectory, rotateBackupsInDirectory } from './backup-folder';
import { putUsadoFile, clearUsadoFilesByClientId, getUsadoFileBlob } from './usados-files-store';
import { LOCAL_USADOS_BUCKET, promoteLocalUsadoArquivoToRemote } from './usados-uploads';
import { getValidStoreIdOrNull, isValidUUID, setStoreId } from './store-id';
import { scheduleSqliteCheckpoint, forceSqliteCheckpoint } from './sqlite-maintenance';
import { isDesktopApp } from './platform';
import { kvGetMany, kvSetMany } from './desktop-kv';
import { getPersistenceInfo } from './persistence-info';
import { getSqliteDbForStore } from './repository/sqlite-db';
import { encryptIfEnabled } from './desktop-crypto';
import { saveBlobToDesktopAppData, saveBlobWithDialog } from '@/lib/capabilities/file-save-adapter';
import { getCurrentSession } from './auth-supabase';
import { fetchCompany, upsertCompany } from './company-service';
import { forceValidateLicense } from './license-service';
import { reconcileFinancialMirrors } from './finance/reconciliation';
import { soldDevicesRepo } from './sold-devices';

// Hardening: rawStorage do backup é dado não confiável (pode vir de arquivo externo).
// Permitimos apenas chaves do tenant no formato smarttech:<STORE_ID>:*
const RAW_STORAGE_KEY_RE = /^smarttech:([0-9a-fA-F-]{36}):/;
const MAX_RAW_STORAGE_KEYS = 20000;


export interface BackupUsadoFile {
  id: string;
  usadoId: string;
  kind: 'photo' | 'document';
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  created_at: string;
  storeId?: string;
  /**
   * DataURL (base64) para restore offline.
   * Ex: data:application/pdf;base64,...
   */
  dataUrl: string;
}

export interface BackupPlatformState {
  runtime: 'desktop' | 'web';
  globalLocalStorage?: Record<string, string>;
  desktopKv?: Record<string, string>;
  appDataDir?: string;
  appLocalDataDir?: string;
  storeIdKv?: string | null;
}

export interface BackupData {
  version: string;
  clientId: string;
  deviceId: string;
  exportedAt: string;
  /** STORE_ID no momento do backup (quando disponível) */
  storeId?: string;
  /** Metadados de integridade (opcional / retrocompatível) */
  integrity?: BackupIntegrity;
  /** Snapshot de estado fora das tabelas (DesktopKV / LocalStorage global). */
  platformState?: BackupPlatformState;
  data: {
    clientes: any[];
    produtos: any[];
    vendas: any[];
    ordens: any[];
    financeiro: any[];
    cobrancas: any[];
    devolucoes: any[];
    encomendas: any[];
    recibos: any[];
    codigos: any[];
    settings: any[];
    pessoas: any[];
    usados: any[];
    usadosVendas: any[];
    usadosArquivos: any[];
    soldDevices?: any[];
    fornecedores?: any[];
    taxasPagamento?: any[];
    company?: any | null;
    /**
     * Anexos offline (IndexedDB) exportados em base64.
     * Opcional para retrocompatibilidade.
     */
    usadosFiles?: BackupUsadoFile[];
    outbox: any[];
    usuario?: any;
    /**
     * Dump completo do LocalStorage do tenant atual (chaves prefixadas)
     * Guarda o valor cru (string) para preservar strings/booleans/etc.
     */
    rawStorage?: Record<string, string>;
  };
}

const BACKUP_VERSION = '1.2.0';

const GLOBAL_LOCALSTORAGE_EXACT_KEYS = new Set<string>([
  'smart-tech-company',
  'smart-tech-company-cache',
  'smart-tech-company-locked',
  'smart-tech-company-lock-snapshot',
  'stpdv_print_profile_v1',
  'auto_backup_last_ms',
  'auto_backup_schedule_enabled',
  'auto_backup_schedule_time',
  'smarttech:usados:purchase_terms_pinned',
  'smarttech:usados:purchase_terms_value',
  'smarttech.venda_usados.warranty.pinned',
  'smarttech.venda_usados.warranty.months',
  'smarttech.venda_usados.warrantyTerms.pinned',
  'smarttech.venda_usados.warrantyTerms.text',
]);

const GLOBAL_LOCALSTORAGE_PREFIXES = [
  'smart-tech-sale-warranty-pinned:',
  'smart-tech-sale-warranty-months:',
  'smart-tech-sale-warranty-terms-pinned:',
  'smart-tech-sale-warranty-terms:',
  'smart-tech:os:fixed-tech-enabled:',
  'smart-tech:os:fixed-tech-value:',
];

const DESKTOP_KV_BACKUP_KEYS = [
  'single_store_id',
  'store_id',
  'company_locked',
  'company_lock_snapshot',
  'auto_backup_last_ms',
  'auto_backup_schedule_enabled',
  'auto_backup_schedule_time',
];

export type ExportBackupOptions = {
  /**
   * Inclui anexos offline (IndexedDB) em base64 dentro do JSON.
   * - true (default): compatível com backup .json/.json.gz
   * - false: recomendado quando você vai empacotar anexos em um .zip separado
   */
  includeOfflineFilesBase64?: boolean;
};

export interface BackupIntegrity {
  algorithm: 'SHA-256';
  /**
   * Hash do payload do backup (tudo exceto o próprio campo `integrity`).
   * Serve para detectar arquivo corrompido/modificado.
   */
  hash: string;
  counts: Record<string, number>;
  rawStorageKeys: number;
  attachments: { count: number; bytes: number };
  /** Tamanho aproximado (em bytes) do JSON do payload (sem integrity) */
  jsonBytes: number;
  /** STORE_ID no momento do backup (quando disponível) */
  storeId?: string;
}

/** Suporte nativo a gzip no navegador (Chrome/Edge modernos) */
export function isGzipSupported(): boolean {
  const CS = (globalThis as any).CompressionStream;
  const DS = (globalThis as any).DecompressionStream;
  return typeof CS !== 'undefined' && typeof DS !== 'undefined';
}

async function sha256Hex(text: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex;
  } catch {
    // Fallback fraco (apenas para não quebrar) – não garante integridade criptográfica
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return `weak-${h.toString(16)}`;
  }
}

async function gzipBlob(blob: Blob): Promise<Blob> {
  const CS = (globalThis as any).CompressionStream;
  if (!CS) return blob;
  const cs = new CS('gzip');
  const stream = blob.stream().pipeThrough(cs);
  return new Response(stream).blob();
}

async function gunzipBlob(blob: Blob): Promise<Blob> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) return blob;
  const ds = new DS('gzip');
  const stream = blob.stream().pipeThrough(ds);
  return new Response(stream).blob();
}

function guessStoreIdFromPrefix(prefix: string): string | undefined {
  // prefix esperado: smarttech:${storeId}:
  const parts = String(prefix || '').split(':');
  if (parts.length >= 2 && parts[0] === 'smarttech') return parts[1] || undefined;
  return undefined;
}

function extractStoreIdFromRawStorage(rawStorage?: Record<string, any> | null): string | undefined {
  if (!rawStorage) return undefined;
  try {
    for (const k of Object.keys(rawStorage)) {
      const m = /^smarttech:([^:]+):/.exec(k);
      if (m?.[1] && isValidUUID(m[1])) return m[1];
    }
  } catch {
    // ignore
  }
  return undefined;
}

function forceStoreParamInUrl(storeId: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('store', storeId);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore
  }
}

function shouldIncludeGlobalLocalStorageKey(key: string): boolean {
  if (!key) return false;
  if (GLOBAL_LOCALSTORAGE_EXACT_KEYS.has(key)) return true;
  return GLOBAL_LOCALSTORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function collectGlobalLocalStorageSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !shouldIncludeGlobalLocalStorageKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value != null) out[key] = value;
    }
  } catch (e) {
    logger.warn('[Backup] Erro ao coletar LocalStorage global:', e);
  }
  return out;
}

async function collectPlatformState(): Promise<BackupPlatformState> {
  const runtime: BackupPlatformState['runtime'] = isDesktopApp() ? 'desktop' : 'web';
  const state: BackupPlatformState = {
    runtime,
    globalLocalStorage: collectGlobalLocalStorageSnapshot(),
  };

  if (isDesktopApp()) {
    try {
      state.desktopKv = await kvGetMany(DESKTOP_KV_BACKUP_KEYS);
    } catch (e) {
      logger.warn('[Backup] Falha ao coletar DesktopKV:', e);
    }
    try {
      const info = await getPersistenceInfo();
      state.appDataDir = info.appDataDir;
      state.appLocalDataDir = info.appLocalDataDir;
      state.storeIdKv = info.storeIdKv ?? null;
    } catch (e) {
      logger.warn('[Backup] Falha ao coletar PersistenceInfo:', e);
    }
  }

  return state;
}

function restoreGlobalLocalStorageSnapshot(snapshot?: Record<string, string> | null): void {
  if (!snapshot || typeof snapshot !== 'object') return;
  for (const [key, value] of Object.entries(snapshot)) {
    if (!shouldIncludeGlobalLocalStorageKey(key)) continue;
    if (typeof value !== 'string') continue;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      logger.warn(`[Backup] Falha ao restaurar chave global ${key}:`, e);
    }
  }
}

async function restoreDesktopKvSnapshot(snapshot?: Record<string, string> | null, forcedStoreId?: string): Promise<void> {
  if (!isDesktopApp()) return;
  const safe: Record<string, string> = {};
  for (const key of DESKTOP_KV_BACKUP_KEYS) {
    const v = snapshot?.[key];
    if (typeof v === 'string') safe[key] = v;
  }
  if (forcedStoreId && isValidUUID(forcedStoreId)) {
    safe.store_id = forcedStoreId;
    safe.single_store_id = forcedStoreId;
  }
  try {
    await kvSetMany(safe);
  } catch (e) {
    logger.warn('[Backup] Falha ao restaurar DesktopKV:', e);
  }
}

async function saveBlobDesktopDialog(blob: Blob, filename: string): Promise<boolean> {
  const ok = await saveBlobWithDialog(blob, {
    filename,
    filters: [{ name: 'Backup Smart Tech', extensions: ['json', 'gz'] }],
    allowedExtensions: ['json', 'gz']
  });
  if (!ok) {
    logger.warn('[Backup] Falha ao salvar via dialog/fs (desktop).');
  }
  return ok;
}

async function saveBlobToDesktopAppBackups(blob: Blob, filename: string): Promise<boolean> {
  const ok = await saveBlobToDesktopAppData(blob, filename, ['backups']);
  if (!ok) {
    logger.warn('[Backup] Falha ao salvar backup silencioso em AppData/backups.');
  }
  return ok;
}

function estimateDataUrlBytes(dataUrl: string): number {
  // data:<mime>;base64,XXXX
  const idx = dataUrl.indexOf('base64,');
  const b64 = idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
  // Base64: 4 chars = 3 bytes (aprox)
  return Math.floor((b64.length * 3) / 4);
}

async function computeIntegrity(backup: BackupData): Promise<BackupIntegrity> {
  const counts: Record<string, number> = {
    clientes: backup.data.clientes?.length || 0,
    produtos: backup.data.produtos?.length || 0,
    vendas: backup.data.vendas?.length || 0,
    ordens: backup.data.ordens?.length || 0,
    financeiro: backup.data.financeiro?.length || 0,
    cobrancas: backup.data.cobrancas?.length || 0,
    devolucoes: backup.data.devolucoes?.length || 0,
    encomendas: backup.data.encomendas?.length || 0,
    recibos: backup.data.recibos?.length || 0,
    codigos: backup.data.codigos?.length || 0,
    settings: backup.data.settings?.length || 0,
    pessoas: backup.data.pessoas?.length || 0,
    usados: backup.data.usados?.length || 0,
    usadosVendas: backup.data.usadosVendas?.length || 0,
    usadosArquivos: backup.data.usadosArquivos?.length || 0,
    soldDevices: backup.data.soldDevices?.length || 0,
    fornecedores: backup.data.fornecedores?.length || 0,
    taxasPagamento: backup.data.taxasPagamento?.length || 0,
    company: backup.data.company ? 1 : 0,
    usadosFiles: backup.data.usadosFiles?.length || 0,
    outbox: backup.data.outbox?.length || 0
  };

  const rawStorageKeys = backup.data.rawStorage ? Object.keys(backup.data.rawStorage).length : 0;

  let attachmentsBytes = 0;
  const files = Array.isArray(backup.data.usadosFiles) ? backup.data.usadosFiles : [];
  for (const f of files) {
    if (typeof f?.sizeBytes === 'number' && Number.isFinite(f.sizeBytes)) attachmentsBytes += f.sizeBytes;
    else if (typeof f?.dataUrl === 'string') attachmentsBytes += estimateDataUrlBytes(f.dataUrl);
  }

  const storeId = backup.storeId || guessStoreIdFromPrefix(getStoragePrefix());

  // Hash do payload sem integrity (determinístico para o mesmo conteúdo)
  const payload: any = { ...backup };
  delete payload.integrity;
  const payloadJson = JSON.stringify(payload);
  const hash = await sha256Hex(payloadJson);

  return {
    algorithm: 'SHA-256',
    hash,
    counts,
    rawStorageKeys,
    attachments: { count: files.length, bytes: attachmentsBytes },
    jsonBytes: payloadJson.length,
    storeId
  };
}

/**
 * Verifica integridade do backup (quando houver `integrity`).
 * - Se o backup não tiver integrity: retorna ok=true + warning.
 */
export async function verifyBackupIntegrity(backup: BackupData): Promise<{ ok: boolean; warning?: string }> {
  try {
    if (!backup?.integrity?.hash) {
      return { ok: true, warning: 'Backup sem verificação de integridade (versão antiga). Ainda pode restaurar.' };
    }

    const expected = String(backup.integrity.hash);
    const recomputed = await computeIntegrity(backup);

    if (recomputed.hash !== expected) {
      return {
        ok: false,
        warning:
          'Falha na integridade: o arquivo pode estar corrompido ou foi modificado. Refaça o backup se possível.'
      };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: true, warning: e?.message ? `Não foi possível verificar integridade: ${e.message}` : 'Não foi possível verificar integridade.' };
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao converter blob para base64'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Exporta todos os dados do tenant atual para JSON
 */
export async function exportBackup(opts?: ExportBackupOptions): Promise<BackupData | null> {
  try {
    const clientId = getClientId();
    if (!clientId) {
      logger.error('[Backup] CLIENT_ID não configurado');
      return null;
    }

    logger.log('[Backup] Iniciando exportação...');

    const includeOfflineFilesBase64 = (opts?.includeOfflineFilesBase64 !== false);

    const platformState = await collectPlatformState();

    const companyResult = await fetchCompany();

    const backup: BackupData = {
      version: BACKUP_VERSION,
      clientId,
      deviceId: getDeviceId(),
      exportedAt: new Date().toISOString(),
      platformState,
      data: {
        clientes: clientesRepo.list(),
        produtos: produtosRepo.list(),
        vendas: vendasRepo.list(),
        ordens: ordensRepo.list(),
        financeiro: financeiroRepo.list(),
        cobrancas: cobrancasRepo.list(),
        devolucoes: devolucoesRepo.list(),
        encomendas: encomendasRepo.list(),
        recibos: recibosRepo.list(),
        codigos: codigosRepo.list(),
        settings: settingsRepo.list(),
        pessoas: pessoasRepo.list(),
        usados: usadosRepo.list(),
        usadosVendas: usadosVendasRepo.list(),
        usadosArquivos: usadosArquivosRepo.list(),
        soldDevices: soldDevicesRepo.list(),
        fornecedores: fornecedoresRepo.list(),
        taxasPagamento: taxasPagamentoRepo.list(),
        company: companyResult.success ? (companyResult.company ?? null) : null,
        outbox: getOutboxItems(),
        usuario: getUsuario(),
        rawStorage: {}
      }
    };

    // ✅ Persistir STORE_ID no arquivo de backup.
    // Motivo: se o cliente limpar dados do navegador, o app pode gerar um novo store_id.
    // Ao restaurar, precisamos voltar ao mesmo STORE_ID do backup para que todas as chaves
    // prefixadas (smarttech:<storeId>:*) continuem válidas.
    try {
      const sid = getValidStoreIdOrNull() || guessStoreIdFromPrefix(getStoragePrefix());
      if (sid && isValidUUID(sid)) backup.storeId = sid;
    } catch {
      // ignore
    }

    // ✅ Exportar anexos OFFLINE (IndexedDB) referenciados em usadosArquivos
    if (includeOfflineFilesBase64) {
    try {
      const localRefs = new Set(
        (backup.data.usadosArquivos || [])
          .filter((a: any) => a?.bucket === LOCAL_USADOS_BUCKET && typeof a?.path === 'string')
          .map((a: any) => String(a.path))
      );

      if (localRefs.size > 0) {
        const files: BackupUsadoFile[] = [];

        // Exporta apenas os arquivos referenciados na tabela `usados_arquivos`.
        // Isso funciona tanto no Web (IDB) quanto no Desktop (filesystem).
        const refs = (backup.data.usadosArquivos || [])
          .filter((a: any) => a?.bucket === LOCAL_USADOS_BUCKET && typeof a?.path === 'string')
          .map((a: any) => ({
            id: String(a.path),
            usadoId: String(a.usadoId || ''),
            kind: (a.kind as any) || 'document',
            originalName: a.originalName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            created_at: a.created_at,
            storeId: a.storeId,
          }));

        for (const r of refs) {
          try {
            const blob = await getUsadoFileBlob(r.id, r.mimeType);
            if (!blob) continue;
            const dataUrl = await blobToDataUrl(blob);
            files.push({
              id: r.id,
              usadoId: r.usadoId,
              kind: r.kind,
              originalName: r.originalName,
              mimeType: r.mimeType,
              sizeBytes: r.sizeBytes,
              created_at: r.created_at || new Date().toISOString(),
              storeId: r.storeId,
              dataUrl
            });
          } catch (e) {
            logger.warn('[Backup] Falha ao exportar anexo (base64):', r.id, e);
          }
        }

        if (files.length > 0) {
          backup.data.usadosFiles = files;
          logger.log(`[Backup] Anexos offline exportados: ${files.length}`);
        }
      }
    } catch (e) {
      logger.warn('[Backup] Erro ao exportar anexos offline:', e);
    }
    }


    // Dump completo das chaves do tenant atual (prefixadas)
    const prefix = getStoragePrefix();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            backup.data.rawStorage![key] = value;
          }
        }
      }
    } catch (error) {
      logger.warn('[Backup] Erro ao coletar rawStorage:', error);
    }

    const totalItems = 
      backup.data.clientes.length +
      backup.data.produtos.length +
      backup.data.vendas.length +
      backup.data.ordens.length +
      backup.data.financeiro.length +
      backup.data.cobrancas.length +
      backup.data.devolucoes.length +
      backup.data.encomendas.length +
      backup.data.recibos.length +
      backup.data.codigos.length +
      backup.data.settings.length +
      backup.data.pessoas.length +
      backup.data.usados.length +
      backup.data.usadosVendas.length +
      backup.data.usadosArquivos.length +
      (backup.data.soldDevices?.length || 0) +
      (backup.data.fornecedores?.length || 0) +
      (backup.data.taxasPagamento?.length || 0);

    backup.integrity = await computeIntegrity(backup);

    logger.log(`[Backup] Exportação concluída: ${totalItems} itens`);

    return backup;
  } catch (error) {
    logger.error('[Backup] Erro ao exportar:', error);
    return null;
  }
}

/**
 * Salva backup como arquivo JSON
 */
function downloadBackupBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    logger.error('[Backup] Erro ao salvar arquivo:', error);
    return false;
  }
}

/**
 * Mantido por compatibilidade (backup JSON não compactado).
 */
function downloadBackupData(backup: BackupData): boolean {
  if (!backup) return false;

  try {
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = buildBackupFilename(backup.clientId, 'json');
    return downloadBackupBlob(blob, filename);
  } catch (error) {
    logger.error('[Backup] Erro ao salvar arquivo:', error);
    return false;
  }
}


/**
 * Salva backup como arquivo JSON (inclui anexos offline quando existirem)
 */
export async function downloadBackup(): Promise<boolean> {
  // P9: checkpoint antes do backup (reduz WAL e locks, melhora consistência em disco lento)
  scheduleSqliteCheckpoint('before-backup');

  const backup = await exportBackup();
  if (!backup) {
    return false;
  }

  return downloadBackupData(backup);
}

function buildBackupFilename(clientId: string, ext: string = 'json'): string {
  const date = new Date().toISOString().split('T')[0];
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
  return `backup-smart-tech-${clientId}-${date}.${cleanExt}`;
}

/**
 * Tenta salvar o backup em uma pasta fixada (quando suportado).
 * Se não houver pasta fixada/suporte/permissão, faz download padrão.
 */
export async function saveBackup(preferPinnedFolder: boolean = true, opts?: { compress?: boolean; silentDesktop?: boolean }): Promise<{
  success: boolean;
  method: 'folder' | 'download';
  filename?: string;
  error?: string;
}> {
  // P9: checkpoint antes do backup (reduz WAL e locks, melhora consistência em disco lento)
  scheduleSqliteCheckpoint('before-backup');

  const backup = await exportBackup();
  if (!backup) {
    return { success: false, method: 'download', error: 'CLIENT_ID não configurado ou erro ao exportar.' };
  }

  const compress = opts?.compress ?? isGzipSupported();
  const filename = buildBackupFilename(backup.clientId, compress ? 'json.gz' : 'json');

  try {
    const json = JSON.stringify(backup, null, 2);
    let blob: Blob = new Blob([json], { type: 'application/json' });
    if (compress) {
      blob = await gzipBlob(blob);
      blob = new Blob([await blob.arrayBuffer()], { type: 'application/gzip' });
    }

    if (isDesktopApp() && opts?.silentDesktop) {
      const ok = await saveBlobToDesktopAppBackups(blob, filename);
      if (ok) {
        scheduleSqliteCheckpoint('after-backup');
        return { success: true, method: 'folder', filename };
      }
    }

    if (preferPinnedFolder) {
      const { handle, writable } = await getPinnedBackupDirectory();
      if (handle && writable) {
        const r = await writeFileToDirectory(handle, filename, blob);
        if (r.success) {
          logger.log('[Backup] Arquivo salvo na pasta fixada:', filename);
          // P9: rotação automática (evita lotar disco). Não bloqueia o fluxo.
          try { void rotateBackupsInDirectory(handle, { keepLast: 30, maxAgeDays: 90 }); } catch { /* ignore */ }
          // P9: checkpoint após escrever backup (idle)
          scheduleSqliteCheckpoint('after-backup');
          return { success: true, method: 'folder', filename };
        }
        logger.warn('[Backup] Falha ao salvar na pasta fixada, caindo para download:', r.error);
      }
    }

    // Desktop manual: abrir diálogo nativo para salvar arquivo
    if (isDesktopApp()) {
      const ok = await saveBlobDesktopDialog(blob, filename);
      if (ok) {
        scheduleSqliteCheckpoint('after-backup');
        return { success: true, method: 'download', filename };
      }
    }

    // Fallback: download tradicional
    const ok = downloadBackupBlob(blob, filename);
    if (ok) {
      scheduleSqliteCheckpoint('after-backup');
      return { success: true, method: 'download', filename };
    }
    return { success: false, method: 'download', filename, error: 'Falha ao baixar arquivo.' };
  } catch (e: any) {
    return { success: false, method: 'download', filename, error: e?.message || 'Falha ao exportar backup.' };
  }
}

/**
 * Valida estrutura do backup
 */
export function validateBackup(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Backup inválido: não é um objeto' };
  }

  if (!data.version || typeof data.version !== 'string') {
    return { valid: false, error: 'Backup inválido: versão não encontrada' };
  }

  if (!data.clientId || typeof data.clientId !== 'string') {
    return { valid: false, error: 'Backup inválido: CLIENT_ID não encontrado' };
  }

  if (!data.data || typeof data.data !== 'object') {
    return { valid: false, error: 'Backup inválido: dados não encontrados' };
  }

  const requiredTables = [
    'clientes', 'produtos', 'vendas', 'ordens', 'financeiro',
    'cobrancas', 'devolucoes', 'encomendas', 'recibos', 'codigos'
  ];

  // Tabelas opcionais (para retrocompatibilidade com backups antigos)
  const optionalTables = [
    'settings', 'pessoas', 'usados', 'usadosVendas', 'usadosArquivos', 'soldDevices', 'fornecedores', 'taxasPagamento'
  ];

  for (const table of requiredTables) {
    if (!Array.isArray(data.data[table])) {
      return { valid: false, error: `Backup inválido: ${table} não é um array` };
    }
  }

  // Validar tabelas opcionais se existirem
  for (const table of optionalTables) {
    if (data.data[table] !== undefined && !Array.isArray(data.data[table])) {
      return { valid: false, error: `Backup inválido: ${table} não é um array` };
    }
  }

  // rawStorage é opcional (compatibilidade)
  if (data.data.rawStorage !== undefined && (typeof data.data.rawStorage !== 'object' || Array.isArray(data.data.rawStorage))) {
    return { valid: false, error: 'Backup inválido: rawStorage deve ser um objeto' };
  }

  // Hardening: validar chaves/valores do rawStorage (evita injetar chaves fora do tenant)
  if (data.data.rawStorage) {
    const rs: Record<string, unknown> = data.data.rawStorage;
    const keys = Object.keys(rs);
    if (keys.length > MAX_RAW_STORAGE_KEYS) {
      return { valid: false, error: `Backup inválido: rawStorage muito grande (${keys.length} chaves)` };
    }
    const storeIds = new Set<string>();
    for (const k of keys) {
      const v = (rs as any)[k];
      if (typeof v !== 'string') {
        return { valid: false, error: `Backup inválido: rawStorage contém valor não-string (chave ${k})` };
      }
      const mm = RAW_STORAGE_KEY_RE.exec(k);
      if (!mm) {
        return { valid: false, error: `Backup inválido: rawStorage contém chave fora do tenant (${k})` };
      }
      storeIds.add(mm[1].toLowerCase());
      if (storeIds.size > 1) {
        return { valid: false, error: 'Backup inválido: rawStorage contém múltiplos STORE_IDs' };
      }
    }
  }


  // usadosFiles é opcional (anexos offline)
  if (data.data.usadosFiles !== undefined && !Array.isArray(data.data.usadosFiles)) {
    return { valid: false, error: 'Backup inválido: usadosFiles não é um array' };
  }

  if (data.data.company !== undefined && data.data.company !== null && typeof data.data.company !== 'object') {
    return { valid: false, error: 'Backup inválido: company deve ser objeto ou null' };
  }

  // integrity é opcional (versões novas)
  if (data.platformState !== undefined) {
    if (!data.platformState || typeof data.platformState !== 'object' || Array.isArray(data.platformState)) {
      return { valid: false, error: 'Backup inválido: platformState deve ser objeto' };
    }
  }

  if (data.integrity !== undefined) {
    const i = data.integrity;
    if (!i || typeof i !== 'object') return { valid: false, error: 'Backup inválido: integrity deve ser objeto' };
    if (typeof i.hash !== 'string') return { valid: false, error: 'Backup inválido: integrity.hash inválido' };
    if (i.counts !== undefined && (typeof i.counts !== 'object' || Array.isArray(i.counts))) {
      return { valid: false, error: 'Backup inválido: integrity.counts inválido' };
    }
  }

  return { valid: true };
}


// Filtra/normaliza rawStorage vindo do backup para reduzir risco de injeção.
function sanitizeRawStorageDump(rawStorage: unknown, expectedStoreId?: string): { safe: Record<string, string>; skipped: number } {
  const safe: Record<string, string> = Object.create(null);
  if (!rawStorage || typeof rawStorage !== 'object' || Array.isArray(rawStorage)) return { safe, skipped: 0 };
  const entries = Object.entries(rawStorage as Record<string, unknown>);
  let skipped = 0;
  for (const [k, v] of entries) {
    if (typeof v !== 'string') { skipped++; continue; }
    const mm = RAW_STORAGE_KEY_RE.exec(k);
    if (!mm) { skipped++; continue; }
    const sid = mm[1].toLowerCase();
    if (expectedStoreId && sid !== expectedStoreId.toLowerCase()) { skipped++; continue; }
    safe[k] = v;
  }
  return { safe, skipped };
}

type RestoreRepoLike<T = any> = {
  clear(): Promise<boolean>;
  restoreMany(items: T[]): Promise<number>;
};

type RestoreDatasetEntry = {
  statsKey: string;
  storageKey: string;
  items: any[];
};

async function clearReposForRestore(repos: RestoreRepoLike[]): Promise<void> {
  for (const repo of repos) {
    await repo.clear();
  }
}

async function restoreCollection<T>(
  repo: RestoreRepoLike<T>,
  items: T[] | undefined,
  stats: Record<string, number>,
  statsKey: string
): Promise<void> {
  if (!Array.isArray(items)) return;
  stats[statsKey] = await repo.restoreMany(items);
}

function normalizeRestoredItems(
  items: any[] | undefined,
  restoreTargetStoreId?: string,
  options?: { settings?: boolean }
): any[] {
  if (!Array.isArray(items)) return [];
  if (!restoreTargetStoreId || !isValidUUID(restoreTargetStoreId)) return [...items];

  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;

    const next = { ...item, storeId: restoreTargetStoreId } as Record<string, any>;
    if ('store_id' in next || options?.settings) next.store_id = restoreTargetStoreId;
    if (options?.settings) next.id = restoreTargetStoreId;
    return next;
  });
}

function queueRestoredCollectionForSync(
  table: string,
  items: any[] | undefined,
  transform?: (item: any) => any
): void {
  if (isLocalOnly()) return;
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id) continue;
    const payload = transform ? transform(item) : item;
    addToOutbox(table, 'upsert', payload as Record<string, any>, item.id);
  }
}

function buildRestoreDatasetEntries(backup: BackupData): RestoreDatasetEntry[] {
  return [
    { statsKey: 'clientes', storageKey: 'customers', items: backup.data.clientes || [] },
    { statsKey: 'produtos', storageKey: 'products', items: backup.data.produtos || [] },
    { statsKey: 'vendas', storageKey: 'sales', items: backup.data.vendas || [] },
    { statsKey: 'ordens', storageKey: 'orders', items: backup.data.ordens || [] },
    { statsKey: 'financeiro', storageKey: 'finance', items: backup.data.financeiro || [] },
    { statsKey: 'cobrancas', storageKey: 'cobrancas', items: backup.data.cobrancas || [] },
    { statsKey: 'devolucoes', storageKey: 'devolucoes', items: backup.data.devolucoes || [] },
    { statsKey: 'encomendas', storageKey: 'encomendas', items: backup.data.encomendas || [] },
    { statsKey: 'recibos', storageKey: 'recibos', items: backup.data.recibos || [] },
    { statsKey: 'codigos', storageKey: 'codigos', items: backup.data.codigos || [] },
    { statsKey: 'settings', storageKey: 'settings', items: backup.data.settings || [] },
    { statsKey: 'pessoas', storageKey: 'pessoas', items: backup.data.pessoas || [] },
    { statsKey: 'usados', storageKey: 'usados', items: backup.data.usados || [] },
    { statsKey: 'usadosVendas', storageKey: 'usados_vendas', items: backup.data.usadosVendas || [] },
    { statsKey: 'usadosArquivos', storageKey: 'usados_arquivos', items: backup.data.usadosArquivos || [] },
    { statsKey: 'soldDevices', storageKey: 'sold_devices', items: backup.data.soldDevices || [] },
    { statsKey: 'fornecedores', storageKey: 'fornecedores', items: backup.data.fornecedores || [] },
    { statsKey: 'taxasPagamento', storageKey: 'taxas_pagamento', items: backup.data.taxasPagamento || [] },
  ];
}

async function applyDesktopTransactionalRecords(
  backup: BackupData,
  stats: Record<string, number>,
  restoreTargetStoreId: string
): Promise<void> {
  const db = await getSqliteDbForStore(restoreTargetStoreId);
  const entries = buildRestoreDatasetEntries(backup);
  const now = Date.now();

  try {
    await db.execute('BEGIN IMMEDIATE');

    for (const entry of entries) {
      await db.execute('DELETE FROM records WHERE tableKey = ?', [entry.storageKey]);
    }

    for (const entry of entries) {
      for (const item of entry.items) {
        if (!item || typeof item.id !== 'string' || !item.id) continue;
        await db.execute(
          'INSERT INTO records (pk, tableKey, id, value, updatedAt) VALUES ($1, $2, $3, $4, $5)\n' +
            'ON CONFLICT(pk) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
          [
            `${entry.storageKey}::${item.id}`,
            entry.storageKey,
            item.id,
            await encryptIfEnabled(JSON.stringify(item)),
            now,
          ]
        );
      }
    }

    await db.execute('COMMIT');
  } catch (err) {
    try { await db.execute('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }

  for (const entry of entries) {
    stats[entry.statsKey] = entry.items.length;
    safeSet(`${entry.storageKey}:fallback-snapshot`, entry.items);
    safeSet(`${entry.storageKey}:ping`, now as any);
    safeRemove(entry.storageKey);
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: `${entry.storageKey}:ping`,
        newValue: String(now),
      }));
    } catch {
      // ignore
    }
  }
}

function resolveRestoreStoreId(backup: BackupData, currentStoreId?: string | null): string | undefined {
  const backupStoreId =
    (backup?.storeId && isValidUUID(backup.storeId) ? backup.storeId : undefined) ||
    (backup?.integrity?.storeId && isValidUUID(backup.integrity.storeId) ? backup.integrity.storeId : undefined) ||
    extractStoreIdFromRawStorage((backup as any)?.data?.rawStorage);

  const desktopLockedStoreId =
    isDesktopApp() && currentStoreId && isValidUUID(currentStoreId) ? currentStoreId : undefined;

  return desktopLockedStoreId ||
    ((backupStoreId && isValidUUID(backupStoreId)) ? backupStoreId : currentStoreId || undefined);
}

async function syncActiveRestoreStore(storeId?: string): Promise<void> {
  if (!storeId || !isValidUUID(storeId)) return;

  forceStoreParamInUrl(storeId);
  setStoreId(storeId, { force: isDesktopApp(), reason: 'backup-restore' });

  if (isDesktopApp()) {
    try {
      const { kvSet } = await import('./desktop-kv');
      await kvSet('store_id', storeId);
      await kvSet('single_store_id', storeId);
    } catch (e) {
      logger.warn('[Backup] Não foi possível sincronizar store_id no DesktopKV:', e);
    }
  }
}

async function applyBackupPayload(
  backup: BackupData,
  stats: Record<string, number>,
  restoreTargetStoreId?: string
): Promise<void> {
  const restoredClientes = normalizeRestoredItems(backup.data.clientes, restoreTargetStoreId);
  const restoredProdutos = normalizeRestoredItems(backup.data.produtos, restoreTargetStoreId);
  const restoredVendas = normalizeRestoredItems(backup.data.vendas, restoreTargetStoreId);
  const restoredOrdens = normalizeRestoredItems(backup.data.ordens, restoreTargetStoreId);
  const restoredFinanceiro = normalizeRestoredItems(backup.data.financeiro, restoreTargetStoreId);
  const restoredCobrancas = normalizeRestoredItems(backup.data.cobrancas, restoreTargetStoreId);
  const restoredDevolucoes = normalizeRestoredItems(backup.data.devolucoes, restoreTargetStoreId);
  const restoredEncomendas = normalizeRestoredItems(backup.data.encomendas, restoreTargetStoreId);
  const restoredRecibos = normalizeRestoredItems(backup.data.recibos, restoreTargetStoreId);
  const restoredCodigos = normalizeRestoredItems(backup.data.codigos, restoreTargetStoreId);
  const restoredSettings = normalizeRestoredItems(backup.data.settings, restoreTargetStoreId, { settings: true });
  const restoredPessoas = normalizeRestoredItems(backup.data.pessoas, restoreTargetStoreId);
  const restoredUsados = normalizeRestoredItems(backup.data.usados, restoreTargetStoreId);
  const restoredUsadosVendas = normalizeRestoredItems(backup.data.usadosVendas, restoreTargetStoreId);
  let restoredUsadosArquivos = normalizeRestoredItems(backup.data.usadosArquivos, restoreTargetStoreId);
  const restoredSoldDevices = normalizeRestoredItems(backup.data.soldDevices, restoreTargetStoreId);
  const restoredFornecedores = normalizeRestoredItems(backup.data.fornecedores, restoreTargetStoreId);
  const restoredTaxasPagamento = normalizeRestoredItems(backup.data.taxasPagamento, restoreTargetStoreId);

  if (isDesktopApp() && restoreTargetStoreId && isValidUUID(restoreTargetStoreId)) {
    await applyDesktopTransactionalRecords({
      ...backup,
      data: {
        ...backup.data,
        clientes: restoredClientes,
        produtos: restoredProdutos,
        vendas: restoredVendas,
        ordens: restoredOrdens,
        financeiro: restoredFinanceiro,
        cobrancas: restoredCobrancas,
        devolucoes: restoredDevolucoes,
        encomendas: restoredEncomendas,
        recibos: restoredRecibos,
        codigos: restoredCodigos,
        settings: restoredSettings,
        pessoas: restoredPessoas,
        usados: restoredUsados,
        usadosVendas: restoredUsadosVendas,
        usadosArquivos: restoredUsadosArquivos,
        soldDevices: restoredSoldDevices,
        fornecedores: restoredFornecedores,
        taxasPagamento: restoredTaxasPagamento,
      }
    }, stats, restoreTargetStoreId);
  } else {
    await restoreCollection(clientesRepo, restoredClientes, stats, 'clientes');
    await restoreCollection(produtosRepo, restoredProdutos, stats, 'produtos');
    if (isDesktopApp()) {
      await restoreCollection(vendasRepo, restoredVendas, stats, 'vendas');
    }
    await restoreCollection(ordensRepo, restoredOrdens, stats, 'ordens');
    await restoreCollection(financeiroRepo, restoredFinanceiro, stats, 'financeiro');
    await restoreCollection(cobrancasRepo, restoredCobrancas, stats, 'cobrancas');
    await restoreCollection(devolucoesRepo, restoredDevolucoes, stats, 'devolucoes');
    await restoreCollection(encomendasRepo, restoredEncomendas, stats, 'encomendas');
    await restoreCollection(recibosRepo, restoredRecibos, stats, 'recibos');
    await restoreCollection(codigosRepo, restoredCodigos, stats, 'codigos');
    await restoreCollection(settingsRepo, restoredSettings, stats, 'settings');
    await restoreCollection(pessoasRepo, restoredPessoas, stats, 'pessoas');
    await restoreCollection(usadosRepo, restoredUsados, stats, 'usados');
    await restoreCollection(usadosVendasRepo, restoredUsadosVendas, stats, 'usadosVendas');
    await restoreCollection(usadosArquivosRepo, restoredUsadosArquivos, stats, 'usadosArquivos');
    await restoreCollection(soldDevicesRepo, restoredSoldDevices, stats, 'soldDevices');
    await restoreCollection(fornecedoresRepo, restoredFornecedores, stats, 'fornecedores');
    await restoreCollection(taxasPagamentoRepo, restoredTaxasPagamento, stats, 'taxasPagamento');
  }

  // Em Web/PWA, o restore é local primeiro. Para refletir em outros dispositivos,
  // enfileiramos os registros restaurados para sincronização com o Supabase.
  if (!isDesktopApp()) {
    queueRestoredCollectionForSync('clientes', restoredClientes);
    queueRestoredCollectionForSync('produtos', restoredProdutos);
    queueRestoredCollectionForSync('ordens_servico', restoredOrdens);
    queueRestoredCollectionForSync('financeiro', restoredFinanceiro);
    queueRestoredCollectionForSync('cobrancas', restoredCobrancas);
    queueRestoredCollectionForSync('devolucoes', restoredDevolucoes);
    queueRestoredCollectionForSync('encomendas', restoredEncomendas);
    queueRestoredCollectionForSync('recibos', restoredRecibos);
    queueRestoredCollectionForSync('codigos', restoredCodigos);
    queueRestoredCollectionForSync('settings', restoredSettings);
    queueRestoredCollectionForSync('pessoas', restoredPessoas);
    queueRestoredCollectionForSync('usados', restoredUsados);
    queueRestoredCollectionForSync('usados_vendas', restoredUsadosVendas);
    queueRestoredCollectionForSync('sold_devices', restoredSoldDevices);
    queueRestoredCollectionForSync('fornecedores', restoredFornecedores);
    queueRestoredCollectionForSync('taxas_pagamento', restoredTaxasPagamento);

    // Vendas usam fluxo especial fora da outbox.
    // Marcar como pending força o sync engine a revalidar/enviar essas vendas.
    if (Array.isArray(backup.data.vendas)) {
      await restoreCollection(
        vendasRepo,
        restoredVendas.map((item: any) => ({
          ...item,
          sync_status: 'pending',
          sync_error: undefined,
        })),
        stats,
        'vendas'
      );
    }
  }

  if (backup.data.usadosFiles && Array.isArray(backup.data.usadosFiles)) {
    let restored = 0;
    for (const f of backup.data.usadosFiles) {
      try {
        if (!f?.id || !f?.dataUrl) continue;
        const blob = await dataUrlToBlob(f.dataUrl);
        await putUsadoFile({
          id: String(f.id),
          clientId: getClientId(),
          storeId: f.storeId,
          usadoId: String(f.usadoId),
          kind: f.kind,
          originalName: f.originalName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          created_at: f.created_at || new Date().toISOString(),
          blob
        });
        restored++;
      } catch (e) {
        logger.warn('[Backup] Falha ao restaurar anexo offline:', (f as any)?.id, e);
      }
    }
    stats.usadosFiles = restored;
  }

  if (!isDesktopApp() && restoredUsadosArquivos.length > 0) {
    const migratedRows = [];
    for (const arquivo of restoredUsadosArquivos) {
      if (arquivo?.bucket !== LOCAL_USADOS_BUCKET) {
        migratedRows.push(arquivo);
        continue;
      }

      try {
        const migrated = await promoteLocalUsadoArquivoToRemote(arquivo as any);
        migratedRows.push(migrated as any);
      } catch (error) {
        logger.warn('[Backup] Falha ao enviar anexo restaurado para o Supabase; mantendo local/offline:', arquivo?.id, error);
        migratedRows.push(arquivo);
      }
    }
    restoredUsadosArquivos = migratedRows as any;
  }

  if (!isDesktopApp()) {
    queueRestoredCollectionForSync('usados_arquivos', restoredUsadosArquivos);
  }

  await restoreDesktopKvSnapshot(backup.platformState?.desktopKv, restoreTargetStoreId);
  restoreGlobalLocalStorageSnapshot(backup.platformState?.globalLocalStorage);

  if (backup.data.rawStorage) {
    const expectedStoreId = (restoreTargetStoreId && isValidUUID(restoreTargetStoreId)) ? restoreTargetStoreId : undefined;
    const { safe, skipped } = sanitizeRawStorageDump(backup.data.rawStorage, expectedStoreId);
    const keys = Object.keys(safe);
    if (keys.length > MAX_RAW_STORAGE_KEYS) {
      logger.warn(`[Backup] rawStorage filtrado ainda é muito grande (${keys.length}). Ignorando rawStorage para evitar travamento.`);
    } else {
      for (const [key, rawValue] of Object.entries(safe)) {
        try {
          localStorage.setItem(key, rawValue);
        } catch (error) {
          logger.warn(`[Backup] Erro ao restaurar rawStorage ${key}:`, error);
        }
      }
      if (skipped > 0) logger.warn(`[Backup] rawStorage: ${skipped} chaves ignoradas por segurança.`);
    }
  }

  if (backup.data.company && typeof backup.data.company === 'object') {
    try {
      await upsertCompany({
        nome_fantasia: String(backup.data.company.nome_fantasia || ''),
        razao_social: backup.data.company.razao_social || undefined,
        cnpj: backup.data.company.cnpj || undefined,
        telefone: backup.data.company.telefone || undefined,
        endereco: backup.data.company.endereco || undefined,
        cidade: backup.data.company.cidade || undefined,
        estado: backup.data.company.estado || undefined,
        cep: backup.data.company.cep || undefined,
        logo_url: backup.data.company.logo_url || undefined,
        mensagem_rodape: backup.data.company.mensagem_rodape || undefined,
      });
      stats.company = backup.data.company ? 1 : 0;
    } catch (error) {
      logger.warn('[Backup] Falha ao restaurar dados explicitos da empresa:', error);
    }
  }
}

function getExpectedRestoreCounts(backup: BackupData): Record<string, number> {
  return {
    clientes: backup.data.clientes?.length || 0,
    produtos: backup.data.produtos?.length || 0,
    vendas: backup.data.vendas?.length || 0,
    ordens: backup.data.ordens?.length || 0,
    financeiro: backup.data.financeiro?.length || 0,
    cobrancas: backup.data.cobrancas?.length || 0,
    devolucoes: backup.data.devolucoes?.length || 0,
    encomendas: backup.data.encomendas?.length || 0,
    recibos: backup.data.recibos?.length || 0,
    codigos: backup.data.codigos?.length || 0,
    settings: backup.data.settings?.length || 0,
    pessoas: backup.data.pessoas?.length || 0,
    usados: backup.data.usados?.length || 0,
    usadosVendas: backup.data.usadosVendas?.length || 0,
    usadosArquivos: backup.data.usadosArquivos?.length || 0,
    soldDevices: backup.data.soldDevices?.length || 0,
    fornecedores: backup.data.fornecedores?.length || 0,
    taxasPagamento: backup.data.taxasPagamento?.length || 0,
    company: backup.data.company ? 1 : 0,
  };
}

function getLiveRestoreCounts(): Record<string, number> {
  const companyLocal = safeGet<any>('smart-tech-company', null);
  return {
    clientes: clientesRepo.count(),
    produtos: produtosRepo.count(),
    vendas: vendasRepo.count(),
    ordens: ordensRepo.count(),
    financeiro: financeiroRepo.count(),
    cobrancas: cobrancasRepo.count(),
    devolucoes: devolucoesRepo.count(),
    encomendas: encomendasRepo.count(),
    recibos: recibosRepo.count(),
    codigos: codigosRepo.count(),
    settings: settingsRepo.count(),
    pessoas: pessoasRepo.count(),
    usados: usadosRepo.count(),
    usadosVendas: usadosVendasRepo.count(),
    usadosArquivos: usadosArquivosRepo.count(),
    soldDevices: soldDevicesRepo.count(),
    fornecedores: fornecedoresRepo.count(),
    taxasPagamento: taxasPagamentoRepo.count(),
    company: companyLocal?.success && companyLocal.data ? 1 : 0,
  };
}

function buildRestoreVerificationWarnings(
  expected: Record<string, number>,
  actual: Record<string, number>
): string[] {
  const warnings: string[] = [];
  for (const [key, expectedCount] of Object.entries(expected)) {
    const actualCount = actual[key] ?? 0;
    if (expectedCount !== actualCount) {
      warnings.push(`${key}: esperado ${expectedCount}, encontrado ${actualCount}`);
    }
  }
  return warnings;
}

/**
 * Restaura backup
 */
export async function restoreBackup(backup: BackupData, confirmOverwrite: boolean = false): Promise<{ success: boolean; error?: string; stats?: Record<string, number>; warnings?: string[] }> {
  try {
    // Validar backup
    const validation = validateBackup(backup);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Verificar se há dados existentes
    const hasExistingData = 
      clientesRepo.count() > 0 ||
      produtosRepo.count() > 0 ||
      vendasRepo.count() > 0 ||
      ordensRepo.count() > 0;

    if (hasExistingData && !confirmOverwrite) {
      return { 
        success: false, 
        error: 'Dados existentes encontrados. Confirme a sobrescrita.' 
      };
    }

    logger.log('[Backup] Iniciando restauração...');

    // ✅ Importante: garantir que o restore use o mesmo STORE_ID do backup.
    // Caso o cliente tenha limpado dados do navegador, um novo store_id pode ser gerado.
    // Sem isso, as chaves prefixadas (smarttech:<storeId>:*) e dados do tenant podem ficar "invisíveis".
    const currentStoreId = getValidStoreIdOrNull();
    const restoreTargetStoreId = resolveRestoreStoreId(backup, currentStoreId);
    const session = getCurrentSession();
    const isSuperAdmin = Boolean(session?.isSuperAdmin);

    if (backup.clientId !== getClientId() && !isSuperAdmin) {
      return {
        success: false,
        error: 'Este backup pertence a outro CLIENT_ID. Apenas a conta principal pode restaurar backups de outro cliente.'
      };
    }

    if (
      restoreTargetStoreId &&
      currentStoreId &&
      restoreTargetStoreId !== currentStoreId &&
      !isSuperAdmin
    ) {
      return {
        success: false,
        error: 'Por seguranca, apenas a conta principal pode restaurar backup de outra loja.'
      };
    }

    const shouldSwitchStoreId = Boolean(
      restoreTargetStoreId &&
      isValidUUID(restoreTargetStoreId) &&
      restoreTargetStoreId !== currentStoreId
    );

    const stats: Record<string, number> = {};
    const reposToClear: RestoreRepoLike[] = [
      clientesRepo,
      produtosRepo,
      vendasRepo,
      ordensRepo,
      financeiroRepo,
      cobrancasRepo,
      devolucoesRepo,
      encomendasRepo,
      recibosRepo,
      codigosRepo,
      settingsRepo,
      pessoasRepo,
      usadosRepo,
      usadosVendasRepo,
      usadosArquivosRepo,
      soldDevicesRepo,
      fornecedoresRepo,
      taxasPagamentoRepo,
    ];
    let rescueBackup: BackupData | null = null;

    // Restaurar cada tabela
    try {
      if (confirmOverwrite && hasExistingData) {
        try {
          rescueBackup = await exportBackup({ includeOfflineFilesBase64: true });
          if (rescueBackup) logger.log('[Backup] Snapshot de resgate criado antes da sobrescrita.');
        } catch (e) {
          logger.warn('[Backup] Falha ao criar snapshot de resgate antes do restore:', e);
        }
      }

      // Limpar dados existentes se confirmado
      if (confirmOverwrite) {
        // Limpar todas as chaves do tenant antes (garante restore completo)
        try {
          const { clearTenantData } = await import('./tenant');
          clearTenantData();
        } catch (e) {
          logger.warn('[Backup] Não foi possível limpar dados do tenant antes do restore:', e);
        }

        // Limpar anexos offline (IndexedDB) do client atual
        try {
          await clearUsadoFilesByClientId(getClientId());
        } catch (e) {
          logger.warn('[Backup] Não foi possível limpar anexos offline antes do restore:', e);
        }

        await clearReposForRestore(reposToClear);
      }

      // ✅ Se o backup foi gerado em outro STORE_ID, alterna o tenant ANTES de restaurar.
      // Isso garante que:
      // - os repositórios (localStorage/IndexedDB) gravem no prefixo correto
      // - as chaves rawStorage do backup continuem acessíveis
      if (restoreTargetStoreId && isValidUUID(restoreTargetStoreId)) {
        if (shouldSwitchStoreId) {
          await syncActiveRestoreStore(restoreTargetStoreId);

          logger.log(`[Backup] STORE_ID de restauração: ${restoreTargetStoreId}`);
          // Se foi confirmado sobrescrever, limpar também o tenant alvo (STORE_ID restaurado)
          // para evitar mistura caso já exista algo salvo sob esse store.
          if (confirmOverwrite) {
            try {
              const { clearTenantData } = await import('./tenant');
              clearTenantData();
            } catch (e) {
              logger.warn('[Backup] Não foi possível limpar dados do tenant (store do backup) antes do restore:', e);
            }

            await clearReposForRestore(reposToClear);
          }
        } else {
          // Mesmo store_id: ainda garante que o param na URL esteja consistente
          await syncActiveRestoreStore(restoreTargetStoreId);
        }
      }

      await applyBackupPayload(backup, stats, restoreTargetStoreId);

    const totalRestored = Object.values(stats).reduce((sum, n) => sum + n, 0);
    const verificationWarnings = buildRestoreVerificationWarnings(
      getExpectedRestoreCounts(backup),
      getLiveRestoreCounts()
    );
    if (verificationWarnings.length > 0) {
      logger.warn('[Backup] Restore concluído com divergências de contagem:', verificationWarnings);
    }
    logger.log(`[Backup] Restauração concluída: ${totalRestored} registros em ${Object.keys(stats).length} coleções`);

    // P9: checkpoint imediato após restore (garante WAL limpo e melhora estabilidade)
    try { await forceSqliteCheckpoint('after-restore'); } catch { /* ignore */ }

    try {
      await reconcileFinancialMirrors('backup-restore');
    } catch (error) {
      logger.warn('[Backup] Não foi possível reconciliar espelhos financeiros após o restore:', error);
    }

    if (!isDesktopApp()) {
      try {
        await forceValidateLicense();
      } catch (error) {
        logger.warn('[Backup] Não foi possível revalidar a licença após o restore:', error);
      }
    }

    try {
      const finalStoreId = restoreTargetStoreId || currentStoreId || getValidStoreIdOrNull() || undefined;
      window.dispatchEvent(new CustomEvent('smarttech:sqlite-ready'));
      window.dispatchEvent(new CustomEvent('smarttech:store-changed', { detail: { storeId: finalStoreId } }));
      window.dispatchEvent(new CustomEvent('smart-tech-movimentacao-criada', { detail: { source: 'backup-restore' } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-backup-restored',
        newValue: String(Date.now())
      }));
    } catch {
      // ignore
    }

    return { success: true, stats, warnings: verificationWarnings };
    } catch (innerError) {
      logger.error('[Backup] Erro durante restauração dos dados:', innerError);
      if (rescueBackup) {
        try {
          const rescueStoreId = resolveRestoreStoreId(rescueBackup, currentStoreId) || currentStoreId || undefined;
          logger.warn('[Backup] Tentando rollback automático a partir do snapshot de resgate...');
          await syncActiveRestoreStore(rescueStoreId);
          await clearReposForRestore(reposToClear);
          const rollbackStats: Record<string, number> = {};
          await applyBackupPayload(rescueBackup, rollbackStats, rescueStoreId);
          logger.warn('[Backup] Rollback automático concluído.');
        } catch (rollbackError) {
          logger.error('[Backup] Falha no rollback automático após erro de restore:', rollbackError);
        }
      }
      throw innerError;
    }
  } catch (error) {
    logger.error('[Backup] Erro ao restaurar backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao restaurar'
    };
  }
}


/**
 * Carrega e faz parse de um arquivo de backup (JSON ou JSON.GZ).
 * Retorna BackupData ou null em caso de erro.
 */
export async function loadBackupFromFile(file: File): Promise<BackupData | null> {
  try {
    let text: string;
    const isGzip = file.name.endsWith('.gz') || file.type === 'application/gzip';

    if (isGzip && isGzipSupported()) {
      const blob = await gunzipBlob(new Blob([await file.arrayBuffer()]));
      text = await blob.text();
    } else {
      text = await file.text();
    }

    const parsed: BackupData = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object') {
      logger.error('[Backup] loadBackupFromFile: JSON inválido ou vazio');
      return null;
    }

    return parsed;
  } catch (err) {
    logger.error('[Backup] loadBackupFromFile: falha ao ler arquivo:', err);
    return null;
  }
}
