/**
 * Auto-Backup Offline (P0-04)
 *
 * Sistema de backup automático 100% local — sem cloud, sem internet.
 *
 * Estratégia:
 *  - Persiste timestamp do último backup no SQLite KV (sobrevive a limpeza de WebView)
 *  - Ao fechar o app (beforeunload), faz backup automático se necessário
 *  - Exibe badge de alerta no menu se último backup > ALERT_AFTER_DAYS dias
 *  - Backup automático usa a pasta fixada (pinned dir) ou gera download se não configurada
 *
 * Uso:
 *   import { initAutoBackup, getBackupAlertState } from '@/lib/auto-backup';
 *   initAutoBackup(); // chamar em Layout.tsx no useEffect de mount
 */

import { logger } from '@/utils/logger';
import { isDesktopApp } from './platform';
import { kvGet, kvSet } from './desktop-kv';
import { saveBackup } from './backup';
import { getLicenseStatus } from './license';

// ─── Configuração ─────────────────────────────────────────────────────────────
const LAST_BACKUP_KEY = 'auto_backup_last_ms';

/** Número de dias sem backup antes de mostrar alerta ativo */
const ALERT_AFTER_DAYS = 3;

/** Número de dias sem backup antes de fazer auto-backup ao fechar */
const AUTO_BACKUP_AFTER_DAYS = 7;

/** Evita rodar close backup em duplicidade (beforeunload + pagehide) */
const CLOSE_RUN_DEDUPE_MS = 30_000;

// ─── Backup agendado (diário por horário) ────────────────────────────────────
const SCHEDULE_ENABLED_KEY = 'auto_backup_schedule_enabled';
const SCHEDULE_TIME_KEY = 'auto_backup_schedule_time'; // HH:MM

let _scheduleTimer: number | null = null;
let _nextScheduledRunAtMs = 0;
let _runningPromise: Promise<boolean> | null = null;
let _runningReason: 'close' | 'scheduled' | null = null;
let _lastRunReason: 'close' | 'scheduled' | 'manual' | null = null;
let _lastRunStartedAtMs = 0;
let _lastRunFinishedAtMs = 0;
let _lastRunOk: boolean | null = null;
let _lastRunError = '';
let _lastCloseAttemptMs = 0;

export type AutoBackupSchedule = {
  enabled: boolean;
  time: string; // HH:MM
};

export type AutoBackupRuntimeState = {
  lastBackupMs: number;
  nextScheduledRunAtMs: number;
  running: boolean;
  runningReason: 'close' | 'scheduled' | null;
  lastRunReason: 'close' | 'scheduled' | 'manual' | null;
  lastRunStartedAtMs: number;
  lastRunFinishedAtMs: number;
  lastRunOk: boolean | null;
  lastRunError: string;
};

async function readSchedule(): Promise<AutoBackupSchedule> {
  const fallback: AutoBackupSchedule = { enabled: false, time: '18:00' };
  try {
    if (isDesktopApp()) {
      const [en, t] = await Promise.all([kvGet(SCHEDULE_ENABLED_KEY), kvGet(SCHEDULE_TIME_KEY)]);
      const enabled = en === '1' || en === 'true';
      const time = (t || fallback.time).trim();
      return { enabled, time: /^\d{2}:\d{2}$/.test(time) ? time : fallback.time };
    }
    const enabled = (localStorage.getItem(SCHEDULE_ENABLED_KEY) || '') === '1';
    const time = (localStorage.getItem(SCHEDULE_TIME_KEY) || fallback.time).trim();
    return { enabled, time: /^\d{2}:\d{2}$/.test(time) ? time : fallback.time };
  } catch {
    return fallback;
  }
}

export async function setAutoBackupSchedule(next: AutoBackupSchedule): Promise<void> {
  const enabled = !!next.enabled;
  const time = (next.time || '18:00').trim();
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '18:00';
  try {
    if (isDesktopApp()) {
      await Promise.all([
        kvSet(SCHEDULE_ENABLED_KEY, enabled ? '1' : '0'),
        kvSet(SCHEDULE_TIME_KEY, safeTime),
      ]);
    } else {
      localStorage.setItem(SCHEDULE_ENABLED_KEY, enabled ? '1' : '0');
      localStorage.setItem(SCHEDULE_TIME_KEY, safeTime);
    }
  } catch {
    // ignore
  }
  // Reagendar imediatamente
  scheduleNextRun({ enabled, time: safeTime });
  notifyRuntimeListeners();
}

export async function getAutoBackupSchedule(): Promise<AutoBackupSchedule> {
  return readSchedule();
}

// ─── Estado em memória ────────────────────────────────────────────────────────
let _lastBackupMs = 0;
let _hydrated = false;
let _unloadRegistered = false;
let _alertListeners: Array<(state: BackupAlertState) => void> = [];
let _runtimeListeners: Array<(state: AutoBackupRuntimeState) => void> = [];

export interface BackupAlertState {
  /** Dias desde o último backup (-1 se nunca fez) */
  daysSinceBackup: number;
  /** true se deve exibir badge de alerta no menu */
  showAlert: boolean;
  /** Timestamp do último backup (ms), 0 se nunca */
  lastBackupMs: number;
  /** Mensagem legível para o usuário */
  message: string;
}

// ─── Leitura / escrita do timestamp ──────────────────────────────────────────
async function loadLastBackupMs(): Promise<number> {
  if (!isDesktopApp()) {
    try {
      const v = localStorage.getItem(LAST_BACKUP_KEY);
      return v ? Number(v) : 0;
    } catch { return 0; }
  }
  try {
    const v = await kvGet(LAST_BACKUP_KEY);
    return v ? Number(v) : 0;
  } catch { return 0; }
}

async function saveLastBackupMs(ms: number): Promise<void> {
  _lastBackupMs = ms;
  try {
    if (isDesktopApp()) {
      await kvSet(LAST_BACKUP_KEY, String(ms));
    } else {
      localStorage.setItem(LAST_BACKUP_KEY, String(ms));
    }
  } catch (e) {
    logger.warn('[AutoBackup] Falha ao salvar timestamp de backup:', e);
  }
}

// ─── Estado de alerta ─────────────────────────────────────────────────────────
export function getBackupAlertState(): BackupAlertState {
  const nowMs = Date.now();
  if (_lastBackupMs === 0) {
    return {
      daysSinceBackup: -1,
      showAlert: true,
      lastBackupMs: 0,
      message: '⚠️ Nenhum backup realizado. Faça um backup agora para proteger seus dados.',
    };
  }
  const days = Math.floor((nowMs - _lastBackupMs) / (24 * 60 * 60 * 1000));
  const showAlert = days >= ALERT_AFTER_DAYS;
  let message = '';
  if (days === 0) message = '✅ Backup realizado hoje';
  else if (days === 1) message = '⚠️ Último backup: ontem';
  else if (showAlert) message = `🔴 Último backup há ${days} dias — faça um backup agora`;
  else message = `Último backup há ${days} dia(s)`;

  return { daysSinceBackup: days, showAlert, lastBackupMs: _lastBackupMs, message };
}

export function getAutoBackupRuntimeState(): AutoBackupRuntimeState {
  return {
    lastBackupMs: _lastBackupMs,
    nextScheduledRunAtMs: _nextScheduledRunAtMs,
    running: !!_runningPromise,
    runningReason: _runningReason,
    lastRunReason: _lastRunReason,
    lastRunStartedAtMs: _lastRunStartedAtMs,
    lastRunFinishedAtMs: _lastRunFinishedAtMs,
    lastRunOk: _lastRunOk,
    lastRunError: _lastRunError,
  };
}

function notifyListeners(): void {
  const state = getBackupAlertState();
  _alertListeners.forEach(fn => { try { fn(state); } catch { /* ignore */ } });
}

function notifyRuntimeListeners(): void {
  const state = getAutoBackupRuntimeState();
  _runtimeListeners.forEach(fn => { try { fn(state); } catch { /* ignore */ } });
}

/** Subscibe para mudanças no estado de alerta de backup */
export function onBackupAlertChange(fn: (state: BackupAlertState) => void): () => void {
  _alertListeners.push(fn);
  return () => { _alertListeners = _alertListeners.filter(f => f !== fn); };
}

export function onAutoBackupRuntimeChange(fn: (state: AutoBackupRuntimeState) => void): () => void {
  _runtimeListeners.push(fn);
  return () => { _runtimeListeners = _runtimeListeners.filter(f => f !== fn); };
}

// ─── Backup automático ────────────────────────────────────────────────────────
/**
 * Executa o backup automático silencioso.
 * Prioriza pasta fixada; se não configurada, faz download no diretório Downloads.
 */
async function runAutoBackup(reason: 'close' | 'scheduled'): Promise<boolean> {
  if (_runningPromise) return _runningPromise;

  _runningReason = reason;
  _lastRunReason = reason;
  _lastRunStartedAtMs = Date.now();
  _lastRunFinishedAtMs = 0;
  _lastRunOk = null;
  _lastRunError = '';
  notifyRuntimeListeners();

  _runningPromise = (async () => {
    try {
      // Em modo DEMO expirado/bloqueado, não adianta tentar.
      // (saveBackup pode falhar também, mas isso evita spam de logs)
      const st = getLicenseStatus();
      if (st.status === 'expired' || st.status === 'blocked' || st.status === 'invalid') {
        _lastRunOk = false;
        _lastRunError = 'Licença bloqueia backup automático';
        return false;
      }
      logger.warn(`[AutoBackup] Iniciando backup automático (${reason})...`);

      const result = await saveBackup(true, { compress: true, silentDesktop: isDesktopApp() });

      if (result.success) {
        await saveLastBackupMs(Date.now());
        notifyListeners();
        _lastRunOk = true;
        _lastRunError = '';
        logger.warn(`[AutoBackup] Backup automático concluído: ${result.filename || 'ok'}`);
        return true;
      }

      _lastRunOk = false;
      _lastRunError = result.error || 'Falha ao executar backup automático';
      logger.error('[AutoBackup] Backup automático falhou:', result.error);
      return false;
    } catch (e) {
      _lastRunOk = false;
      _lastRunError = String((e as any)?.message || e || 'Falha ao executar backup automático');
      logger.error('[AutoBackup] Exceção no backup automático:', e);
      return false;
    } finally {
      _lastRunFinishedAtMs = Date.now();
      _runningPromise = null;
      _runningReason = null;
      notifyRuntimeListeners();
    }
  })();

  return _runningPromise;
}

function shouldRunCloseAutoBackup(nowMs: number = Date.now()): boolean {
  if (_lastBackupMs === 0) return true;
  const daysSince = (nowMs - _lastBackupMs) / (24 * 60 * 60 * 1000);
  return daysSince >= AUTO_BACKUP_AFTER_DAYS;
}

function getPreviousScheduledSlotMs(timeHHMM: string, nowMs: number = Date.now()): number {
  const [hhRaw, mmRaw] = timeHHMM.split(':');
  const hh = Math.min(23, Math.max(0, Number(hhRaw)));
  const mm = Math.min(59, Math.max(0, Number(mmRaw)));
  const now = new Date(nowMs);
  const slot = new Date(now);
  slot.setHours(hh, mm, 0, 0);
  if (slot.getTime() > nowMs) {
    slot.setDate(slot.getDate() - 1);
  }
  return slot.getTime();
}

async function maybeRunScheduledCatchup(schedule: AutoBackupSchedule): Promise<void> {
  if (!isDesktopApp() || !schedule.enabled) return;
  if (_runningPromise) return;

  const lastSlotMs = getPreviousScheduledSlotMs(schedule.time);
  if (_lastBackupMs >= lastSlotMs) return;

  logger.warn('[AutoBackup] Executando catch-up do agendamento diário no boot.');
  await runAutoBackup('scheduled');
}

export async function runAutoBackupBeforeCloseIfNeeded(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  if (!shouldRunCloseAutoBackup()) return false;

  return runAutoBackup('close');
}

export async function runBackupBeforeClose(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  return runAutoBackup('close');
}

function clearScheduleTimer(): void {
  if (_scheduleTimer != null) {
    window.clearTimeout(_scheduleTimer);
    _scheduleTimer = null;
  }
  if (_nextScheduledRunAtMs !== 0) {
    _nextScheduledRunAtMs = 0;
    notifyRuntimeListeners();
  }
}

function msUntilNextTime(timeHHMM: string): number {
  const [hhRaw, mmRaw] = timeHHMM.split(':');
  const hh = Math.min(23, Math.max(0, Number(hhRaw)));
  const mm = Math.min(59, Math.max(0, Number(mmRaw)));
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function triggerCloseBackupIfNeeded(): void {
  if (!shouldRunCloseAutoBackup()) return;

  const now = Date.now();
  if (_lastCloseAttemptMs && now - _lastCloseAttemptMs < CLOSE_RUN_DEDUPE_MS) return;
  _lastCloseAttemptMs = now;

  void runAutoBackup('close');
}

function scheduleNextRun(schedule: AutoBackupSchedule): void {
  clearScheduleTimer();
  if (!schedule.enabled) return;

  const waitMs = msUntilNextTime(schedule.time);
  _nextScheduledRunAtMs = Date.now() + waitMs;
  notifyRuntimeListeners();
  _scheduleTimer = window.setTimeout(async () => {
    try {
      await runAutoBackup('scheduled');
    } finally {
      // agenda o próximo dia
      scheduleNextRun(schedule);
    }
  }, waitMs);
}

// ─── Registro de fechamento do app ────────────────────────────────────────────
function registerUnloadHandler(): void {
  if (_unloadRegistered) return;
  _unloadRegistered = true;

  // beforeunload: síncrono, não pode await — usa sendBeacon ou fire-and-forget
  window.addEventListener('beforeunload', (_event: BeforeUnloadEvent) => {
    triggerCloseBackupIfNeeded();
  });

  // pagehide é mais confiável que beforeunload em alguns navegadores embedded (Tauri WebView)
  window.addEventListener('pagehide', (_event: Event) => {
    triggerCloseBackupIfNeeded();
  });
}


// ─── Inicialização ────────────────────────────────────────────────────────────
/**
 * Inicializa o sistema de auto-backup.
 * Chamar uma vez em Layout.tsx no useEffect de mount.
 */
export async function initAutoBackup(): Promise<void> {
  if (_hydrated) return;
  _hydrated = true;

  try {
    _lastBackupMs = await loadLastBackupMs();
    notifyListeners();
    notifyRuntimeListeners();

    if (!isDesktopApp()) {
      registerUnloadHandler();
    }

    if (import.meta.env.DEV) {
      logger.log('[AutoBackup] Inicializado. Último backup:', _lastBackupMs
        ? new Date(_lastBackupMs).toLocaleString('pt-BR')
        : 'Nunca');
    }

    // Agendamento diário por horário
    const schedule = await readSchedule();
    scheduleNextRun(schedule);
    void maybeRunScheduledCatchup(schedule);
  } catch (e) {
    logger.error('[AutoBackup] Falha na inicialização:', e);
  }
}

/**
 * Registrar que um backup manual foi concluído com sucesso.
 * Chamar em BackupPage após saveBackup() com sucesso.
 */
export async function recordManualBackup(): Promise<void> {
  _lastRunReason = 'manual';
  _lastRunStartedAtMs = Date.now();
  _lastRunFinishedAtMs = _lastRunStartedAtMs;
  _lastRunOk = true;
  _lastRunError = '';
  await saveLastBackupMs(Date.now());
  notifyListeners();
  notifyRuntimeListeners();
}
