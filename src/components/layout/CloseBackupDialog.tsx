import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { getBackupAlertState, getAutoBackupRuntimeState } from '@/lib/auto-backup';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import type { CloseBackupChoice, CloseBackupProgressStage } from '@/lib/persistence-gate';
import './CloseBackupDialog.css';

type RequestDetail = {
  pendingWrites?: number;
  resolve?: (choice: CloseBackupChoice) => void;
};

type ProgressDetail = {
  stage: CloseBackupProgressStage;
  message: string;
  progress?: number;
  error?: string;
};

const CLOSE_VISUAL_MIN_MS = 3000;

const CLOSE_BOOT_LINES = [
  'PS C:\\SmartTech> persistence-gate --flush-pending-writes',
  'PS C:\\SmartTech> sqlite-local-store --checkpoint TRUNCATE',
  'PS C:\\SmartTech> backup-engine --compactar-dados-local',
  'PS C:\\SmartTech> desktop-shell --liberar-fechamento'
];

function formatDateTime(value?: number | null): string {
  if (!value) return 'Nenhum backup manual registrado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nenhum backup manual registrado';
  return date.toLocaleString('pt-BR');
}

export default function CloseBackupDialog() {
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState<((choice: CloseBackupChoice) => void) | null>(null);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [stage, setStage] = useState<CloseBackupProgressStage>('idle');
  const [message, setMessage] = useState('Escolha como deseja fechar o sistema.');
  const [progress, setProgress] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);
  const [commandIndex, setCommandIndex] = useState(0);
  const [error, setError] = useState('');
  const [backupRuntime, setBackupRuntime] = useState(() => getAutoBackupRuntimeState());
  const [backupAlert, setBackupAlert] = useState(() => getBackupAlertState());
  const busyStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const w = window as any;
    w.__smarttechCloseBackupDialogListeners = Number(w.__smarttechCloseBackupDialogListeners || 0) + 1;

    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<RequestDetail>).detail || {};
      setBackupRuntime(getAutoBackupRuntimeState());
      setBackupAlert(getBackupAlertState());
      setPendingWrites(Number(detail.pendingWrites || 0));
      setResolver(() => detail.resolve || null);
      setStage('waiting');
      setMessage('Antes de sair, escolha se deseja salvar um backup de proteção.');
      setProgress(0);
      setVisualProgress(0);
      setCommandIndex(0);
      busyStartedAtRef.current = null;
      setError('');
      setOpen(true);
    };

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<ProgressDetail>).detail;
      if (!detail) return;
      setStage(detail.stage || 'idle');
      setMessage(detail.message || 'Processando fechamento seguro.');
      setProgress(Math.max(0, Math.min(100, Number(detail.progress || 0))));
      setError(detail.error || '');
      if (detail.stage !== 'idle') setOpen(true);
    };

    window.addEventListener('smarttech:close-backup-request', onRequest as EventListener);
    window.addEventListener('smarttech:close-backup-progress', onProgress as EventListener);

    return () => {
      w.__smarttechCloseBackupDialogListeners = Math.max(0, Number(w.__smarttechCloseBackupDialogListeners || 1) - 1);
      window.removeEventListener('smarttech:close-backup-request', onRequest as EventListener);
      window.removeEventListener('smarttech:close-backup-progress', onProgress as EventListener);
    };
  }, []);

  const busy = stage === 'saving' || stage === 'checkpoint' || stage === 'updating' || stage === 'closing';
  const storeId = getRuntimeStoreId();

  useEffect(() => {
    if (!busy) {
      if (stage === 'error') setVisualProgress((current) => Math.max(current, progress));
      else if (stage === 'waiting' || stage === 'idle') setVisualProgress(0);
      busyStartedAtRef.current = null;
      return;
    }

    if (busyStartedAtRef.current === null) {
      busyStartedAtRef.current = performance.now();
      setVisualProgress(0);
      setCommandIndex(0);
    }

    const tick = () => {
      const startedAt = busyStartedAtRef.current ?? performance.now();
      const elapsed = performance.now() - startedAt;
      const timedProgress = Math.min(96, Math.round((elapsed / CLOSE_VISUAL_MIN_MS) * 96));
      const stageFloor = Math.min(96, Math.max(0, Number(progress || 0)));
      const nextProgress = stage === 'closing' && progress >= 100
        ? 100
        : Math.min(96, Math.max(timedProgress, Math.min(stageFloor, timedProgress + 12)));

      setVisualProgress(nextProgress);
      setCommandIndex(Math.floor(elapsed / 550) % CLOSE_BOOT_LINES.length);
    };

    tick();
    const timer = window.setInterval(tick, 80);
    return () => window.clearInterval(timer);
  }, [busy, progress, stage]);

  const statusText = useMemo(() => {
    if (stage === 'error') return 'Atenção';
    if (busy) return 'Salvando';
    return 'Fechamento seguro';
  }, [busy, stage]);

  const choose = (choice: CloseBackupChoice) => {
    if (choice === 'cancel') {
      resolver?.('cancel');
      setOpen(false);
      setResolver(null);
      return;
    }

    setStage(choice === 'backup' ? 'saving' : 'closing');
    setMessage(choice === 'backup' ? 'Carregando backup seguro antes de fechar...' : 'Fechando sem gerar novo backup...');
    setProgress(choice === 'backup' ? 8 : 20);
    resolver?.(choice);
    setResolver(null);
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!busy) choose('cancel');
      }}
      title="Fechar Smart Tech PDV"
      size="md"
    >
      <div className="close-backup-dialog">
        <div className={`close-backup-dialog__badge close-backup-dialog__badge--${stage === 'error' ? 'error' : busy ? 'busy' : 'idle'}`}>
          {statusText}
        </div>

        <div className="close-backup-dialog__hero">
          <div className="close-backup-dialog__icon" aria-hidden="true">
            {stage === 'error' ? '!' : '↥'}
          </div>
          <div>
            <h3>Deseja fazer backup antes de sair?</h3>
            <p>{message}</p>
          </div>
        </div>

        {(busy || progress > 0) && (
          <div className="close-backup-dialog__boot" aria-label="Progresso do fechamento">
            <div className="close-backup-dialog__boot-head">
              <span>{stage === 'closing' ? 'FINALIZANDO FECHAMENTO LOCAL' : 'SALVANDO BACKUP LOCAL'}</span>
              <strong>{Math.round(visualProgress)}%</strong>
            </div>
            <div className="close-backup-dialog__progress">
              <div style={{ width: `${Math.max(0, Math.min(100, visualProgress))}%` }} />
            </div>
            <div className="close-backup-dialog__terminal" aria-hidden="true">
              {CLOSE_BOOT_LINES.map((line, index) => (
                <div key={line} className={index === commandIndex ? 'is-active' : ''}>
                  {line} {index === commandIndex ? '-- executando' : '-- ok'}
                </div>
              ))}
            </div>
          </div>
        )}

        {error ? <div className="close-backup-dialog__error">{error}</div> : null}

        <div className="close-backup-dialog__details">
          <div>
            <span>Último backup</span>
            <strong>{formatDateTime(backupRuntime.lastBackupMs)}</strong>
          </div>
          <div>
            <span>Pendências de escrita</span>
            <strong>{pendingWrites}</strong>
          </div>
          <div>
            <span>Backup</span>
            <strong>{backupAlert.showAlert ? 'Recomendado agora' : 'Em dia'}</strong>
          </div>
          <div>
            <span>STORE_ID</span>
            <strong title={storeId || '—'}>{storeId ? `${storeId.slice(0, 8)}...` : '—'}</strong>
          </div>
        </div>

        <div className="close-backup-dialog__note">
          Fazer backup e sair salva uma cópia de proteção antes de fechar. Sair sem backup apenas finaliza as gravações locais já pendentes.
        </div>

        <div className="close-backup-dialog__actions">
          <button type="button" className="btn-secondary" onClick={() => choose('cancel')} disabled={busy}>
            Continuar usando
          </button>
          <button type="button" className="btn-secondary" onClick={() => choose('skip')} disabled={busy}>
            Sair sem backup
          </button>
          <button type="button" className="btn-primary" onClick={() => choose('backup')} disabled={busy}>
            {busy ? 'Salvando...' : 'Fazer backup e sair'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
