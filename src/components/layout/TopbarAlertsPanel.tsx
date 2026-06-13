import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  getAutoBackupRuntimeState,
  getBackupAlertState,
  onAutoBackupRuntimeChange,
  onBackupAlertChange,
  type AutoBackupRuntimeState,
  type BackupAlertState,
} from '@/lib/auto-backup';
import {
  getMonthlyLicenseStatusSync,
  type MonthlyLicenseStatus,
} from '@/lib/license/monthly-license';
import {
  getSystemNotices,
  markAllCommonNoticesRead,
  markNoticeRead,
  markNoticesReadByRoute,
  onSystemNoticesChange,
  type SystemNotice,
} from '@/lib/system-notices';
import { useAttentionCenter } from '@/hooks/useAttentionCenter';

import './TopbarAlertsPanel.css';

export type TopbarPanelMode = 'alerts' | 'notifications' | 'messages';

type Props = {
  open: boolean;
  mode: TopbarPanelMode;
  onClose: () => void;
};

type PanelTone = 'ok' | 'info' | 'warn' | 'danger';

type PanelItem = {
  id: string;
  tone: PanelTone;
  title: string;
  message: string;
  actionLabel: string;
  path: string;
  status?: SystemNotice['status'];
  type?: SystemNotice['type'];
  resolveWhen?: string;
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(timestamp?: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function licenseTitle(status: MonthlyLicenseStatus): string {
  if (status.status === 'active') return 'Licença ativa';
  if (status.status === 'warning') return 'Licença perto de vencer';
  if (status.status === 'expired') return 'Licença vencida';
  if (status.status === 'blocked') return 'Licença bloqueada';
  return 'Licença não ativada';
}

function licenseMessage(status: MonthlyLicenseStatus): string {
  if (status.status === 'active') {
    return `Sistema liberado até ${formatDate(status.validUntil)}.`;
  }
  if (status.status === 'warning') {
    return `Renove antes de ${formatDate(status.validUntil)} para evitar bloqueio operacional.`;
  }
  if (status.status === 'expired') {
    return `Venceu em ${formatDate(status.validUntil)}. Backup e renovação continuam liberados.`;
  }
  if (status.status === 'blocked') {
    return status.message || 'Uso operacional bloqueado até regularizar a licença.';
  }
  return 'Envie o ID do computador ao suporte e aplique o código mensal.';
}

function backupTitle(alert: BackupAlertState, runtime: AutoBackupRuntimeState): string {
  if (runtime.running) return 'Backup em andamento';
  if (runtime.lastRunOk === false) return 'Backup automático falhou';
  if (alert.daysSinceBackup < 0) return 'Nenhum backup feito';
  if (alert.showAlert) return 'Backup desatualizado';
  return 'Backup em dia';
}

function backupMessage(alert: BackupAlertState, runtime: AutoBackupRuntimeState): string {
  if (runtime.running) {
    return runtime.runningReason === 'close'
      ? 'O sistema está fechando com proteção de backup.'
      : 'Backup automático em execução.';
  }
  if (runtime.lastRunOk === false && runtime.lastRunError) {
    return runtime.lastRunError;
  }
  if (runtime.nextScheduledRunAtMs) {
    return `Próximo auto-backup: ${formatDateTime(runtime.nextScheduledRunAtMs)}.`;
  }
  return alert.message || 'Faça backup regularmente para proteger os dados locais.';
}

function modeTitle(mode: TopbarPanelMode): string {
  if (mode === 'alerts') return 'Central de alertas';
  if (mode === 'notifications') return 'Notificações do sistema';
  return 'Mensagens e suporte';
}

function modeSubtitle(mode: TopbarPanelMode): string {
  if (mode === 'alerts') return 'Licença, backup e avisos importantes.';
  if (mode === 'notifications') return 'Contador de pendências e notificações não lidas.';
  return 'Ajuda rápida para uso no balcão.';
}

function noticeTone(notice: SystemNotice): PanelTone {
  if (notice.severity === 'danger') return 'danger';
  if (notice.severity === 'warning') return 'warn';
  if (notice.severity === 'success') return 'ok';
  return 'info';
}

export default function TopbarAlertsPanel({ open, mode, onClose }: Props) {
  const navigate = useNavigate();
  const attention = useAttentionCenter();
  const [licenseStatus, setLicenseStatus] = useState(() => getMonthlyLicenseStatusSync());
  const [backupAlert, setBackupAlert] = useState(() => getBackupAlertState());
  const [backupRuntime, setBackupRuntime] = useState(() => getAutoBackupRuntimeState());
  const [systemNotices, setSystemNotices] = useState<SystemNotice[]>(() => getSystemNotices());

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const refreshLicense = () => setLicenseStatus(getMonthlyLicenseStatusSync());
    refreshLicense();
    window.addEventListener('smarttech:monthly-license-changed', refreshLicense);
    const t = window.setInterval(refreshLicense, 60_000);
    return () => {
      window.removeEventListener('smarttech:monthly-license-changed', refreshLicense);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    setBackupAlert(getBackupAlertState());
    setBackupRuntime(getAutoBackupRuntimeState());
    const offAlert = onBackupAlertChange(setBackupAlert);
    const offRuntime = onAutoBackupRuntimeChange(setBackupRuntime);
    const t = window.setInterval(() => {
      setBackupAlert(getBackupAlertState());
      setBackupRuntime(getAutoBackupRuntimeState());
    }, 60_000);
    return () => {
      offAlert();
      offRuntime();
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => onSystemNoticesChange(() => setSystemNotices(getSystemNotices())), []);

  useEffect(() => {
    if (!open || mode !== 'notifications') return;
    markAllCommonNoticesRead();
    setSystemNotices(getSystemNotices());
  }, [open, mode]);

  const commonNotices = useMemo(
    () => systemNotices.filter((notice) => notice.type !== 'alert'),
    [systemNotices]
  );

  const unreadCommonCount = useMemo(
    () => commonNotices.filter((notice) => notice.status === 'unread').length,
    [commonNotices]
  );

  const items = useMemo<PanelItem[]>(() => {
    const licenseTone =
      licenseStatus.status === 'active' ? 'ok'
        : licenseStatus.status === 'warning' ? 'warn'
          : 'danger';

    const backupTone =
      backupRuntime.running ? 'info'
        : backupRuntime.lastRunOk === false ? 'danger'
          : backupAlert.showAlert ? 'warn'
            : 'ok';

    const attentionCards: PanelItem[] = attention.items.map((item) => ({
      id: `attention:${item.id}`,
      tone: item.tone,
      title: `${item.title}${item.count > 1 ? ` (${item.count})` : ''}`,
      message: item.message,
      actionLabel: item.actionLabel,
      path: item.path,
      type: 'alert',
      resolveWhen: item.path === '/backup'
        ? 'Resolve quando um backup manual ou automático for concluído.'
        : item.path === '/licenca'
          ? 'Resolve quando a licença mensal for renovada ou regularizada.'
          : 'Resolve quando a pendência real da tela relacionada for concluída.',
    }));

    if (mode === 'notifications') {
      const notificationCards: PanelItem[] = commonNotices.slice(0, 8).map((notice) => ({
        id: notice.id,
        tone: noticeTone(notice),
        title: notice.status === 'read' ? `${notice.title} · lida` : notice.title,
        message: notice.message,
        actionLabel: notice.actionLabel || 'Abrir',
        path: notice.route || '/painel',
        status: notice.status,
        type: notice.type,
        resolveWhen: notice.resolveWhen,
      }));

      const cards = notificationCards.slice(0, 8);

      return cards.length > 0 ? cards : [
        {
          id: 'empty:updates',
          tone: 'info',
          title: 'Atualizações',
          message: 'Verifique atualizações manuais/online quando for preparar uma nova entrega.',
          actionLabel: 'Ver atualizações',
          path: '/atualizacoes',
          type: 'notification',
          resolveWhen: 'Sem pendência. Este card é apenas um atalho operacional.',
        },
        {
          id: 'empty:license',
          tone: licenseTone,
          title: licenseTitle(licenseStatus),
          message: licenseMessage(licenseStatus),
          actionLabel: 'Abrir licença',
          path: '/licenca',
          type: 'notification',
          resolveWhen: 'Sem pendência de notificação comum.',
        },
        {
          id: 'empty:backup',
          tone: backupTone,
          title: backupTitle(backupAlert, backupRuntime),
          message: backupMessage(backupAlert, backupRuntime),
          actionLabel: 'Abrir backup',
          path: '/backup',
          type: 'notification',
          resolveWhen: 'Sem pendência de notificação comum.',
        },
      ];
    }

    if (mode === 'messages') {
      const messageCards = commonNotices
        .filter((notice) => notice.type === 'message')
        .map((notice) => ({
          id: notice.id,
          tone: noticeTone(notice),
          title: notice.title,
          message: notice.message,
          actionLabel: notice.actionLabel || 'Abrir',
          path: notice.route || '/ajuda',
          status: notice.status,
          type: notice.type,
          resolveWhen: notice.resolveWhen,
        }));

      return messageCards.length > 0 ? messageCards : [
        {
          id: 'message:balcao',
          tone: 'ok',
          title: 'Uso no balcão',
          message: 'Mantenha backup em dia e confira licença antes de iniciar o atendimento.',
          actionLabel: 'Ver painel',
          path: '/painel',
          type: 'message',
          resolveWhen: 'Mensagem informativa, sem pendência operacional.',
        },
        {
          id: 'message:licenca',
          tone: licenseTone,
          title: 'Mensagem da licença',
          message: licenseMessage(licenseStatus),
          actionLabel: 'Renovar',
          path: '/licenca',
          type: 'message',
          resolveWhen: 'Regularize a licença se houver aviso ativo.',
        },
      ];
    }

    if (attentionCards.length > 0) {
      return attentionCards.slice(0, 8);
    }

    return [
      {
        id: 'status:license',
        tone: licenseTone,
        title: licenseTitle(licenseStatus),
        message: licenseMessage(licenseStatus),
        actionLabel: licenseStatus.active ? 'Ver licença' : 'Ativar licença',
        path: '/licenca',
        type: 'alert',
        resolveWhen: 'Resolve quando a licença mensal estiver ativa.',
      },
      {
        id: 'status:backup',
        tone: backupTone,
        title: backupTitle(backupAlert, backupRuntime),
        message: backupMessage(backupAlert, backupRuntime),
        actionLabel: 'Fazer backup',
        path: '/backup',
        type: 'alert',
        resolveWhen: 'Resolve quando um backup for concluído com sucesso.',
      },
      {
        id: 'status:system',
        tone: 'info',
        title: 'Sistema local',
        message: 'Atalhos rápidos para manter o PDV operacional e protegido.',
        actionLabel: 'Abrir painel',
        path: '/painel',
        type: 'alert',
        resolveWhen: 'Sem pendência real no momento.',
      },
    ];
  }, [attention.items, backupAlert, backupRuntime, commonNotices, licenseStatus, mode]);

  if (!open) return null;

  return (
    <section className="topbar-alerts-panel" aria-label={modeTitle(mode)}>
      <header className="topbar-alerts-panel__header">
        <div>
          <strong>{modeTitle(mode)}</strong>
          <span>{modeSubtitle(mode)}</span>
        </div>
        <div className="topbar-alerts-panel__actions">
          {mode === 'notifications' && unreadCommonCount > 0 ? (
            <button
              type="button"
              className="topbar-alerts-panel__mark-read"
              onClick={() => {
                markAllCommonNoticesRead();
                setSystemNotices(getSystemNotices());
              }}
            >
              Lidas
            </button>
          ) : null}
          <button type="button" className="topbar-alerts-panel__close" onClick={onClose} aria-label="Fechar central">
            ×
          </button>
        </div>
      </header>

      <div className="topbar-alerts-panel__list">
        {items.map((item) => (
          <article key={item.id} className={`topbar-alert-card topbar-alert-card--${item.tone} ${item.status === 'read' ? 'topbar-alert-card--read' : ''}`}>
            <div className="topbar-alert-card__dot" aria-hidden="true" />
            <div className="topbar-alert-card__copy">
              <strong>{item.title}</strong>
              <span>{item.message}</span>
              {item.resolveWhen ? <small>{item.resolveWhen}</small> : null}
            </div>
            <button
              type="button"
              className="topbar-alert-card__action"
              onClick={() => {
                if (item.id && !item.id.startsWith('attention:') && !item.id.startsWith('empty:') && !item.id.startsWith('status:')) {
                  markNoticeRead(item.id);
                }
                markNoticesReadByRoute(item.path);
                setSystemNotices(getSystemNotices());
                onClose();
                navigate(item.path);
              }}
            >
              {item.actionLabel}
            </button>
          </article>
        ))}
      </div>

      <footer className="topbar-alerts-panel__footer">
        <span>Central leve · sem animação pesada</span>
        <span>Esc para fechar</span>
      </footer>
    </section>
  );
}
