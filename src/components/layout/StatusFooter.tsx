import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCompany } from '@/contexts/CompanyContext';
import {
  getBackupAlertState,
  getAutoBackupRuntimeState,
  onAutoBackupRuntimeChange,
  onBackupAlertChange,
  type AutoBackupRuntimeState,
  type BackupAlertState,
} from '@/lib/auto-backup';
import {
  getPersistenceGuardState,
  onPersistenceGuardStateChange,
  type PersistenceGuardState,
} from '@/lib/persistence-gate';

function formatDateTimePtBR(timestamp?: number | null) {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function backupFooterMeta(alert: BackupAlertState, runtime: AutoBackupRuntimeState): string | null {
  if (runtime.running) {
    return runtime.runningReason === 'close'
      ? 'Fechando com proteção de backup…'
      : 'Executando backup automático…';
  }
  if (runtime.lastRunOk === false && runtime.lastRunError) {
    return `Backup automático falhou: ${runtime.lastRunError}`;
  }
  if (!runtime.lastBackupMs && runtime.nextScheduledRunAtMs) {
    const next = formatDateTimePtBR(runtime.nextScheduledRunAtMs);
    return next
      ? `Primeiro auto-backup agendado: ${next}`
      : 'Primeiro auto-backup já está agendado';
  }
  if (runtime.nextScheduledRunAtMs) {
    const next = formatDateTimePtBR(runtime.nextScheduledRunAtMs);
    if (next) return `Próximo auto-backup: ${next}`;
  }
  return alert.message || null;
}

function persistenceFooterMeta(state: PersistenceGuardState): string | null {
  if (state.closeDrainInProgress) return 'Fechando com checkpoint seguro…';
  if (state.pendingWrites > 0) {
    return state.pendingWrites === 1
      ? '1 gravação local pendente'
      : `${state.pendingWrites} gravações locais pendentes`;
  }
  return 'Persistência local estável';
}

function backupPillTone(alert: BackupAlertState, runtime: AutoBackupRuntimeState): 'ok' | 'warn' | 'danger' | 'info' {
  if (runtime.running) return 'info';
  if (runtime.lastRunOk === false) return 'danger';
  if (!runtime.lastBackupMs && runtime.nextScheduledRunAtMs) return 'info';
  if (alert.showAlert) return 'warn';
  return 'ok';
}

function backupLabel(alert: BackupAlertState, runtime: AutoBackupRuntimeState): string {
  if (runtime.running) return 'Backup em andamento';
  if (runtime.lastRunOk === false) return 'Backup com falha';
  if (!runtime.lastBackupMs && runtime.nextScheduledRunAtMs) return 'Auto-backup armado';
  if (alert.showAlert) return alert.daysSinceBackup < 0 ? 'Backup pendente' : 'Backup desatualizado';
  return 'Backup OK';
}

function persistencePillTone(state: PersistenceGuardState): 'ok' | 'warn' | 'danger' | 'info' {
  if (state.closeDrainInProgress) return 'info';
  if (state.pendingWrites > 0) return 'warn';
  return 'ok';
}

export function StatusFooter() {
  const { company } = useCompany();
  const [backupAlert, setBackupAlert] = useState<BackupAlertState>(() => getBackupAlertState());
  const [backupRuntime, setBackupRuntime] = useState<AutoBackupRuntimeState>(() => getAutoBackupRuntimeState());
  const [persistenceState, setPersistenceState] = useState<PersistenceGuardState>(() => getPersistenceGuardState());
  const navigate = useNavigate();

  const openBackup = () => {
    navigate('/backup');
  };

  useEffect(() => onBackupAlertChange(setBackupAlert), []);
  useEffect(() => onAutoBackupRuntimeChange(setBackupRuntime), []);
  useEffect(() => onPersistenceGuardStateChange(setPersistenceState), []);

  const companyName = (company?.nome_fantasia || 'Smart Tech Rolândia').trim();
  const appName = 'Sistema PDV Offline';

  const offlineMeta = 'Sistema local/offline — sem licença, sem Supabase e sem ativação.';
  const backupTone = backupPillTone(backupAlert, backupRuntime);
  const persistenceTone = persistencePillTone(persistenceState);
  const backupMeta = backupFooterMeta(backupAlert, backupRuntime);
  const persistenceMeta = persistenceFooterMeta(persistenceState);

  return (
    <footer className="status-footer" role="contentinfo">
      <div className="sf-shell">
        <div className="sf-group sf-group--brand" title={companyName}>
          <span className="sf-kicker">Loja atual</span>
          <div className="sf-brand-row">
            <span className="sf-brand">{companyName}</span>
            <span className="sf-app">{appName}</span>
          </div>
        </div>

        <div className="sf-group sf-group--status">
          <span
            className={`sf-pill sf-pill--${persistenceTone}`}
            title={persistenceMeta || 'Persistência local'}
          >
            {persistenceState.closeDrainInProgress
              ? 'Fechando com proteção'
              : persistenceState.pendingWrites > 0
                ? `Salvando (${persistenceState.pendingWrites})`
                : 'Persistência OK'}
          </span>
          <div className="sf-copy">
            <span className="sf-label">Persistência</span>
            <span className="sf-detail">{persistenceMeta || 'Persistência local estável'}</span>
          </div>
        </div>

        <button
          type="button"
          className="sf-group sf-group--status sf-group--clickable"
          title={backupMeta || 'Clique para abrir Backup'}
          onClick={openBackup}
        >
          <span className={`sf-pill sf-pill--${backupTone}`}>
            {backupLabel(backupAlert, backupRuntime)}
          </span>
          <div className="sf-copy">
            <span className="sf-label">Backup</span>
            <span className="sf-detail">{backupMeta || 'Clique para abrir Backup e restauração'}</span>
          </div>
        </button>

        <div
          className="sf-group sf-group--status sf-group--status-offline"
          title={offlineMeta}
        >
          <span className="sf-pill sf-pill--ok">Offline local</span>
          <div className="sf-copy">
            <span className="sf-label">Modo</span>
            <span className="sf-detail">{offlineMeta}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
