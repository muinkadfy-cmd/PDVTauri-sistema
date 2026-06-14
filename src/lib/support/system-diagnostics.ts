import { BUILD_COMMIT, BUILD_DATE, BUILD_ID, BUILD_VERSION } from '@/config/buildInfo';
import { getClientId } from '@/lib/tenant';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { getDeviceId } from '@/lib/device';
import { getLicenseStatusAsync } from '@/lib/license';
import { getPersistenceInfo } from '@/lib/persistence-info';
import { getDesktopCaptureStats } from '@/lib/desktop/error-capture';
import { getDiagLogsAsync } from '@/lib/telemetry/diag-log';
import { getUpdateLogs } from '@/lib/updateLog';
import { getLowEndMode } from '@/lib/low-end-mode';
import { isDesktopApp } from '@/lib/platform';
import { loadPrintProfile } from '@/print/printProfiles';
import { loadThermalPrintSettings } from '@/services/print/settings';

export type HealthTone = 'ok' | 'warn' | 'danger' | 'info';

export interface SystemDiagnosticsItem {
  label: string;
  value: string;
  tone?: HealthTone;
  secret?: boolean;
}

export interface SystemDiagnosticsSnapshot {
  generatedAt: string;
  runtime: 'desktop' | 'web';
  build: {
    version: string;
    id: string;
    date: string;
    commit: string;
  };
  identity: {
    clientId: string;
    storeId: string;
    deviceIdMasked: string;
  };
  license: {
    status: string;
    validUntil?: string;
    daysRemaining?: number;
    message: string;
  };
  persistence: {
    status: HealthTone;
    storage: string;
    appDataDir?: string;
    dbDir?: string;
    activeStoreId?: string;
    dbStatus?: string;
    dbFilesCount?: number;
    lastWarning?: string;
  };
  printer: {
    paper: string;
    profile: string;
    printerName: string;
    mode: string;
  };
  support: {
    diagnosticsOn: boolean;
    lowEndMode: boolean;
    capturedErrors: number;
    breadcrumbs: number;
    diagLogs: number;
    lastDiag?: string;
    updateLogs: number;
    lastUpdate?: string;
  };
}

export function maskDiagnosticValue(value?: string | null, visibleStart = 6, visibleEnd = 4): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (raw.length <= visibleStart + visibleEnd + 3) return `${raw.slice(0, 2)}•••`;
  return `${raw.slice(0, visibleStart)}…${raw.slice(-visibleEnd)}`;
}

function readDiagnosticsFlag(): boolean {
  try {
    const raw = localStorage.getItem('smart-tech:diagnostics-enabled') || localStorage.getItem('smart-tech-diagnostics-enabled');
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
  } catch {
    return false;
  }
}

function toneFromDbStatus(status?: string): HealthTone {
  const v = String(status || '').toLowerCase();
  if (!v) return 'info';
  if (v.includes('critical') || v.includes('erro') || v.includes('error')) return 'danger';
  if (v.includes('warn') || v.includes('aten')) return 'warn';
  if (v.includes('ok') || v.includes('healthy') || v.includes('ready')) return 'ok';
  return 'info';
}

export async function collectSystemDiagnostics(): Promise<SystemDiagnosticsSnapshot> {
  const [license, persistence, captureStats, diagLogs] = await Promise.all([
    getLicenseStatusAsync().catch((error) => ({
      status: 'invalid',
      message: error instanceof Error ? error.message : 'Não foi possível ler licença.',
    } as any)),
    getPersistenceInfo().catch(() => null as any),
    getDesktopCaptureStats().catch(() => ({ errors: 0, breadcrumbs: 0 })),
    getDiagLogsAsync().catch(() => []),
  ]);

  const updateLogs = getUpdateLogs();
  const thermal = loadThermalPrintSettings();
  const printProfile = loadPrintProfile();
  const storeId = getRuntimeStoreId() || '';
  const deviceId = await Promise.resolve(getDeviceId()).catch(() => '');
  const dbStatus = persistence?.dbStatus || persistence?.databaseStatus || '';
  const dbFiles = Array.isArray(persistence?.dbFiles) ? persistence.dbFiles.length : undefined;
  const warnings = Array.isArray(persistence?.warnings) ? persistence.warnings : [];
  const lastDiag = Array.isArray(diagLogs) && diagLogs.length
    ? `${new Date(diagLogs[diagLogs.length - 1].ts).toLocaleString('pt-BR')} · ${diagLogs[diagLogs.length - 1].level}: ${diagLogs[diagLogs.length - 1].message}`
    : undefined;
  const lastUpdate = updateLogs.length
    ? `${updateLogs[updateLogs.length - 1].ts} · ${updateLogs[updateLogs.length - 1].type}: ${updateLogs[updateLogs.length - 1].message}`
    : undefined;

  return {
    generatedAt: new Date().toISOString(),
    runtime: isDesktopApp() ? 'desktop' : 'web',
    build: {
      version: BUILD_VERSION || '—',
      id: BUILD_ID || '—',
      date: BUILD_DATE || '—',
      commit: BUILD_COMMIT || '—',
    },
    identity: {
      clientId: getClientId() || '—',
      storeId: maskDiagnosticValue(storeId, 8, 6),
      deviceIdMasked: maskDiagnosticValue(deviceId, 8, 6),
    },
    license: {
      status: String((license as any)?.status || 'desconhecida'),
      validUntil: (license as any)?.validUntil || (license as any)?.expires_at,
      daysRemaining: typeof (license as any)?.daysRemaining === 'number' ? (license as any).daysRemaining : undefined,
      message: String((license as any)?.message || '—'),
    },
    persistence: {
      status: toneFromDbStatus(dbStatus),
      storage: isDesktopApp() ? 'SQLite local / AppData' : 'Web offline-first',
      appDataDir: persistence?.appDataDir,
      dbDir: persistence?.dbDir,
      activeStoreId: maskDiagnosticValue(persistence?.activeStoreId || persistence?.storeIdKv || storeId, 8, 6),
      dbStatus: dbStatus || undefined,
      dbFilesCount: dbFiles,
      lastWarning: warnings[0],
    },
    printer: {
      paper: `${thermal.paperWidth || '80'}mm`,
      profile: String(thermal.printerProfile || printProfile.preset || 'padrão'),
      printerName: printProfile.printerName || 'Não selecionada',
      mode: isDesktopApp() ? 'Tauri nativo / ESC-POS quando disponível' : 'Navegador / PDF',
    },
    support: {
      diagnosticsOn: readDiagnosticsFlag(),
      lowEndMode: getLowEndMode(),
      capturedErrors: Number(captureStats.errors || 0),
      breadcrumbs: Number(captureStats.breadcrumbs || 0),
      diagLogs: Array.isArray(diagLogs) ? diagLogs.length : 0,
      lastDiag,
      updateLogs: updateLogs.length,
      lastUpdate,
    },
  };
}

export function buildSystemDiagnosticsText(snapshot: SystemDiagnosticsSnapshot): string {
  const lines = [
    'Smart Tech PDV — Diagnóstico de Sistema',
    `Gerado em: ${new Date(snapshot.generatedAt).toLocaleString('pt-BR')}`,
    '',
    `Runtime: ${snapshot.runtime === 'desktop' ? 'Desktop Tauri' : 'Web'}`,
    `Versão: ${snapshot.build.version}`,
    `Build: ${snapshot.build.id}`,
    `Data do build: ${snapshot.build.date}`,
    `Commit: ${maskDiagnosticValue(snapshot.build.commit, 8, 6)}`,
    '',
    `CLIENT_ID: ${snapshot.identity.clientId}`,
    `STORE_ID: ${snapshot.identity.storeId}`,
    `DEVICE_ID: ${snapshot.identity.deviceIdMasked}`,
    '',
    `Licença: ${snapshot.license.status}`,
    `Validade: ${snapshot.license.validUntil || '—'}`,
    `Mensagem: ${snapshot.license.message}`,
    '',
    `Persistência: ${snapshot.persistence.storage}`,
    `Status DB: ${snapshot.persistence.dbStatus || '—'}`,
    `AppData: ${snapshot.persistence.appDataDir || '—'}`,
    `DB dir: ${snapshot.persistence.dbDir || '—'}`,
    `Arquivos DB: ${snapshot.persistence.dbFilesCount ?? '—'}`,
    `Aviso: ${snapshot.persistence.lastWarning || 'sem avisos'}`,
    '',
    `Impressão: ${snapshot.printer.mode}`,
    `Papel: ${snapshot.printer.paper}`,
    `Perfil: ${snapshot.printer.profile}`,
    `Impressora: ${snapshot.printer.printerName}`,
    '',
    `Modo PC lento: ${snapshot.support.lowEndMode ? 'ativo' : 'desativado'}`,
    `Diagnóstico: ${snapshot.support.diagnosticsOn ? 'ativo' : 'desativado'}`,
    `Erros capturados: ${snapshot.support.capturedErrors}`,
    `Breadcrumbs: ${snapshot.support.breadcrumbs}`,
    `Logs diagnóstico: ${snapshot.support.diagLogs}`,
    `Logs update: ${snapshot.support.updateLogs}`,
  ];
  return lines.join('\n');
}
