import { isDesktopApp } from '@/lib/platform';
import { forceSqliteCheckpoint } from '@/lib/sqlite-maintenance';
import { logger } from '@/utils/logger';

let pendingWrites = 0;
let closeGuardRegistered = false;
let closeDrainInProgress = false;
let allowImmediateClose = false;
let closeRequestInFlight = false;

const PENDING_EVENT = 'smarttech:persistence-pending-changed';
const ERROR_EVENT = 'smarttech:persistence-write-failed';
const STATE_EVENT = 'smarttech:persistence-state-changed';
const CLOSE_REQUEST_EVENT = 'smarttech:close-backup-request';
const CLOSE_PROGRESS_EVENT = 'smarttech:close-backup-progress';
const CLOSE_VISUAL_MIN_MS = 3000;

export type CloseBackupChoice = 'backup' | 'skip' | 'cancel';
export type CloseBackupProgressStage = 'idle' | 'waiting' | 'saving' | 'checkpoint' | 'updating' | 'closing' | 'error';

export type PersistenceGuardState = {
  pendingWrites: number;
  closeDrainInProgress: boolean;
  allowImmediateClose: boolean;
};

function notifyPending(): void {
  try {
    window.dispatchEvent(new CustomEvent(PENDING_EVENT, { detail: { pendingWrites } }));
  } catch {
    // ignore
  }
  notifyState();
}

function notifyState(): void {
  try {
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: getPersistenceGuardState() }));
  } catch {
    // ignore
  }
}

function setCloseFlags(partial: { closeDrainInProgress?: boolean; allowImmediateClose?: boolean }): void {
  try {
    const w = window as any;
    if (typeof partial.closeDrainInProgress === 'boolean') {
      closeDrainInProgress = partial.closeDrainInProgress;
      w.__smarttechCloseDrainInProgress = partial.closeDrainInProgress;
    }
    if (typeof partial.allowImmediateClose === 'boolean') {
      allowImmediateClose = partial.allowImmediateClose;
      w.__smarttechAllowImmediateClose = partial.allowImmediateClose;
    }
    w.__smarttechCloseGuardInstalled = true;
  } catch {
    if (typeof partial.closeDrainInProgress === 'boolean') closeDrainInProgress = partial.closeDrainInProgress;
    if (typeof partial.allowImmediateClose === 'boolean') allowImmediateClose = partial.allowImmediateClose;
  }
  notifyState();
}

function notifyCloseProgress(stage: CloseBackupProgressStage, message: string, progress = 0, error?: string): void {
  try {
    window.dispatchEvent(new CustomEvent(CLOSE_PROGRESS_EVENT, { detail: { stage, message, progress, error } }));
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForCloseVisualMinimum(startedAt: number): Promise<void> {
  const remaining = CLOSE_VISUAL_MIN_MS - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

export function beginWrite(_label?: string): void {
  pendingWrites += 1;
  notifyPending();
}

export function endWrite(_label?: string): void {
  pendingWrites = Math.max(0, pendingWrites - 1);
  notifyPending();
}

export function getPendingWritesCount(): number {
  return pendingWrites;
}

export function getPersistenceGuardState(): PersistenceGuardState {
  return {
    pendingWrites,
    closeDrainInProgress,
    allowImmediateClose,
  };
}

export function onPersistenceGuardStateChange(fn: (state: PersistenceGuardState) => void): () => void {
  const handler = (event: Event) => {
    try {
      fn(((event as CustomEvent<PersistenceGuardState>).detail) || getPersistenceGuardState());
    } catch {
      fn(getPersistenceGuardState());
    }
  };

  window.addEventListener(STATE_EVENT, handler as EventListener);
  return () => window.removeEventListener(STATE_EVENT, handler as EventListener);
}

export function isImmediateCloseAllowed(): boolean {
  return allowImmediateClose;
}

export function isCloseDrainActive(): boolean {
  return closeDrainInProgress;
}

export function reportPersistenceError(
  context: string,
  error: unknown,
  options?: { markDbCorrupted?: boolean; dispatchSqliteFailed?: boolean }
): void {
  const message = String((error as any)?.message || error || 'Falha de persistência');
  const markDbCorrupted = options?.markDbCorrupted !== false;
  const dispatchSqliteFailed = options?.dispatchSqliteFailed !== false;

  logger.error(`[PersistenceGate] ${context}:`, error);

  try {
    const w = window as any;
    w.__smarttechSqliteError = message;
    if (markDbCorrupted) w.__smarttechDbCorrupted = true;
  } catch {
    // ignore
  }

  if (dispatchSqliteFailed) {
    try {
      window.dispatchEvent(new CustomEvent('smarttech:sqlite-failed', { detail: { tableKey: context, error: message } }));
    } catch {
      // ignore
    }
  }

  try {
    window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: { context, error: message } }));
  } catch {
    // ignore
  }
}

function reportCloseGuardError(context: string, error: unknown): void {
  reportPersistenceError(context, error, {
    markDbCorrupted: false,
    dispatchSqliteFailed: false,
  });
}

async function askBackupBeforeClose(): Promise<CloseBackupChoice> {
  if (typeof window !== 'undefined') {
    try {
      const listenerCount = (window as any).__smarttechCloseBackupDialogListeners || 0;
      if (listenerCount > 0) {
        closeRequestInFlight = true;
        notifyCloseProgress('waiting', 'Aguardando escolha de fechamento.', 0);
        return await new Promise<CloseBackupChoice>((resolve) => {
          let done = false;
          const finish = (choice: CloseBackupChoice) => {
            if (done) return;
            done = true;
            closeRequestInFlight = false;
            resolve(choice);
          };

          window.dispatchEvent(new CustomEvent(CLOSE_REQUEST_EVENT, {
            detail: {
              pendingWrites,
              resolve: finish,
            },
          }));

          window.setTimeout(() => finish('cancel'), 15 * 60 * 1000);
        });
      }
    } catch {
      closeRequestInFlight = false;
    }
  }

  const message =
    'Deseja fazer backup antes de sair?\n\n' +
    'OK = Fazer backup e sair\n' +
    'Cancelar = Sair sem backup';

  try {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const confirmDialog = (dialog as any).confirm as ((message: string, options?: any) => Promise<boolean>) | undefined;
    if (typeof confirmDialog === 'function') {
      const ok = await confirmDialog(message, {
        title: 'Fechar Smart Tech PDV',
        kind: 'warning',
        okLabel: 'Fazer backup e sair',
        cancelLabel: 'Sair sem backup',
      });
      return ok ? 'backup' : 'skip';
    }
  } catch {
    // fallback abaixo
  }

  try {
    return window.confirm(message) ? 'backup' : 'skip';
  } catch {
    return 'cancel';
  }
}

async function notifyCloseBackupFailure(error: unknown): Promise<void> {
  const message = String((error as any)?.message || error || 'Falha ao executar backup.');
  try {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const showMessage = (dialog as any).message as ((message: string, options?: any) => Promise<void>) | undefined;
    if (typeof showMessage === 'function') {
      await showMessage(`Não foi possível concluir o backup.\n\n${message}\n\nO aplicativo será fechado sem backup.`, {
        title: 'Backup não concluído',
        kind: 'error',
      });
      return;
    }
  } catch {
    // fallback abaixo
  }

  try {
    window.alert(`Não foi possível concluir o backup.\n\n${message}\n\nO aplicativo será fechado sem backup.`);
  } catch {
    // ignore
  }
}

export async function flushPendingWrites(timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now();

  while (pendingWrites > 0) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timeout aguardando persistência (${pendingWrites} pendente(s))`);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

export async function registerDesktopPersistenceCloseGuard(): Promise<void> {
  if (!isDesktopApp() || closeGuardRegistered) return;
  closeGuardRegistered = true;
  setCloseFlags({ closeDrainInProgress: false, allowImmediateClose: false });

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();

    await appWindow.onCloseRequested(async (event) => {
      if (allowImmediateClose) return;

      event.preventDefault();

      if (closeDrainInProgress || closeRequestInFlight) return;

      setCloseFlags({ closeDrainInProgress: true });

      try {
        const choice = await askBackupBeforeClose();
        if (choice === 'cancel') {
          notifyCloseProgress('idle', 'Fechamento cancelado.', 0);
          return;
        }

        const closeVisualStartedAt = Date.now();
        notifyCloseProgress('saving', choice === 'backup' ? 'Preparando backup seguro antes de sair.' : 'Preparando fechamento sem backup.', 12);
        await flushPendingWrites(15000);
        notifyCloseProgress('checkpoint', 'Conferindo gravações locais no SQLite.', 34);
        await forceSqliteCheckpoint('app-close', 'TRUNCATE');

        if (choice === 'backup') {
          try {
            notifyCloseProgress('saving', 'Salvando backup de proteção antes de fechar.', 58);
            const { runBackupBeforeClose } = await import('@/lib/auto-backup');
            const ok = await runBackupBeforeClose();
            if (!ok) {
              notifyCloseProgress('error', 'Backup não foi concluído.', 58, 'Backup cancelado ou não concluído.');
              await notifyCloseBackupFailure('Backup cancelado ou não concluído.');
            }
          } catch (backupError) {
            logger.warn('[PersistenceGate] Falha no backup durante fechamento protegido:', backupError);
            notifyCloseProgress('error', 'Falha no backup antes de fechar.', 58, String((backupError as any)?.message || backupError));
            await notifyCloseBackupFailure(backupError);
          }
        }

        notifyCloseProgress('closing', 'Finalizando proteção local e liberando fechamento.', 92);
        await waitForCloseVisualMinimum(closeVisualStartedAt);
        notifyCloseProgress('closing', 'Fechando Smart Tech PDV com segurança.', 100);
        setCloseFlags({ allowImmediateClose: true });
        await appWindow.close();
      } catch (error) {
        notifyCloseProgress('error', 'Não foi possível concluir o fechamento protegido.', 0, String((error as any)?.message || error));
        reportCloseGuardError('close-guard', error);
      } finally {
        setCloseFlags({ closeDrainInProgress: false });
      }
    });
  } catch (error) {
    reportCloseGuardError('close-guard:init', error);
  }
}
