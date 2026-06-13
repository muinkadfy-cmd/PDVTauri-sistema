import { useEffect, useMemo, useState } from 'react';
import {
  activateMonthlyLicenseCode,
  getMonthlyLicenseStatusSync,
  hydrateMonthlyLicenseFromDesktopKv,
  removeMonthlyLicense,
  type MonthlyLicenseStatus,
} from '@/lib/license/monthly-license';
import { canManageLicense } from '@/lib/permissions';
import './LicencaMensalPage.css';

type FeedbackState = {
  type: 'ok' | 'error' | 'info';
  title: string;
  text: string;
  expiresAt?: string;
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function statusLabel(status: MonthlyLicenseStatus): string {
  if (status.status === 'active') return 'Ativa';
  if (status.status === 'warning') return 'A vencer';
  if (status.status === 'expired') return 'Vencida';
  if (status.status === 'blocked') return 'Bloqueada';
  return 'Não ativada';
}

function daysText(status: MonthlyLicenseStatus): string {
  if (typeof status.daysRemaining !== 'number') return '—';
  if (status.daysRemaining === 0) return 'vence hoje';
  if (status.daysRemaining === 1) return '1 dia';
  return `${status.daysRemaining} dias`;
}

function supportText(status: MonthlyLicenseStatus): string {
  if (status.active) {
    return `Licença liberada até ${formatDate(status.validUntil)}.`;
  }
  if (status.status === 'warning') {
    return `Atenção: renove antes de ${formatDate(status.validUntil)}.`;
  }
  if (status.status === 'expired') return 'Licença vencida. Solicite um novo código mensal.';
  if (status.status === 'blocked') return 'Uso operacional bloqueado. Verifique a licença.';
  return 'Envie o ID ao suporte e insira o código mensal recebido.';
}

export default function LicencaMensalPage() {
  const [status, setStatus] = useState(() => getMonthlyLicenseStatusSync());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const canManage = useMemo(() => canManageLicense(), []);

  const refresh = () => setStatus(getMonthlyLicenseStatusSync());

  useEffect(() => {
    refresh();
    void hydrateMonthlyLicenseFromDesktopKv().finally(refresh);
    const onChange = () => refresh();
    window.addEventListener('smarttech:monthly-license-changed', onChange);
    return () => window.removeEventListener('smarttech:monthly-license-changed', onChange);
  }, []);

  const copyDevice = async () => {
    try {
      await navigator.clipboard.writeText(status.deviceCode);
      setFeedback({
        type: 'ok',
        title: 'ID copiado',
        text: 'Envie este ID ao suporte para receber o código mensal correto deste computador.',
      });
    } catch {
      setFeedback({
        type: 'info',
        title: 'Copie manualmente',
        text: `ID deste computador: ${status.deviceCode}`,
      });
    }
  };

  const activate = async () => {
    if (!canManage) {
      setFeedback({
        type: 'error',
        title: 'Permissão necessária',
        text: 'Entre com usuário administrador para renovar a licença.',
      });
      return;
    }
    if (!code.trim()) {
      setFeedback({
        type: 'error',
        title: 'Código obrigatório',
        text: 'Cole o código mensal enviado pelo suporte antes de ativar.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await activateMonthlyLicenseCode(code);
      if (!result.ok) {
        setFeedback({
          type: 'error',
          title: 'Código não validado',
          text: result.error || 'Não foi possível ativar a licença mensal.',
        });
        return;
      }

      const nextStatus = result.status || getMonthlyLicenseStatusSync();
      setCode('');
      setStatus(nextStatus);

      const expiresAt = formatDate(nextStatus.validUntil);
      setFeedback({
        type: 'ok',
        title: 'Ativação realizada com sucesso',
        text: nextStatus.validUntil
          ? `Sistema liberado. A licença expira em ${expiresAt}.`
          : 'Sistema liberado com sucesso.',
        expiresAt: nextStatus.validUntil,
      });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!canManage) return;
    const ok = window.confirm('Remover a licença mensal deste computador?');
    if (!ok) return;
    await removeMonthlyLicense();
    const next = getMonthlyLicenseStatusSync();
    setStatus(next);
    setFeedback({
      type: 'info',
      title: 'Licença removida',
      text: 'A licença local foi removida deste computador.',
    });
  };

  return (
    <div className="licenca-mensal-page">
      <header className="licenca-mensal-header">
        <div className="licenca-mensal-heading">
          <span className="licenca-mensal-kicker">Controle mensal offline</span>
          <h1>Licença mensal</h1>
          <p>Renovação local por código. O sistema continua offline, mas precisa de um código para liberar o mês.</p>
        </div>
        <div className={`licenca-mensal-status licenca-mensal-status--${status.status}`}>
          <span>Status da licença</span>
          <strong>{statusLabel(status)}</strong>
          <small>{supportText(status)}</small>
        </div>
      </header>

      <section className="licenca-mensal-main-grid">
        <article className="licenca-mensal-card licenca-mensal-card--device">
          <div className="licenca-card-title-row">
            <h2>Dados deste computador</h2>
            <span className="licenca-chip">ID local</span>
          </div>
          <div className="licenca-mensal-detail licenca-mensal-detail--device">
            <strong>ID para suporte</strong>
            <span>{status.deviceCode}</span>
          </div>
          <button type="button" className="btn btn-secondary licenca-copy-button" onClick={copyDevice}>
            Copiar ID do computador
          </button>
          <p className="licenca-mensal-help">Envie este ID ao suporte para receber o código de renovação deste computador.</p>
        </article>

        <article className="licenca-mensal-card licenca-mensal-card--status">
          <div className="licenca-card-title-row">
            <h2>Status atual</h2>
            <span className={`licenca-chip licenca-chip--${status.status}`}>{statusLabel(status)}</span>
          </div>
          <div className="licenca-status-compact">
            <div className="licenca-mensal-detail">
              <strong>Cliente</strong>
              <span>{status.customer || '—'}</span>
            </div>
            <div className="licenca-mensal-detail">
              <strong>Vencimento</strong>
              <span>{formatDate(status.validUntil)}</span>
            </div>
            <div className="licenca-mensal-detail">
              <strong>Dias restantes</strong>
              <span>{daysText(status)}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="licenca-mensal-card licenca-mensal-activation">
        <div className="licenca-card-title-row">
          <div>
            <h2>Ativar ou renovar</h2>
            <p className="licenca-mensal-help">Cole o código mensal recebido após o pagamento e confirme a ativação.</p>
          </div>
          {status.validUntil ? <span className="licenca-chip">Expira: {formatDate(status.validUntil)}</span> : null}
        </div>

        <label htmlFor="monthlyLicenseCode">Código mensal</label>
        <textarea
          id="monthlyLicenseCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Cole aqui o código enviado pelo suporte"
          rows={3}
          disabled={!canManage || busy}
        />

        <div className="licenca-mensal-actions">
          <button type="button" className="btn btn-primary" onClick={activate} disabled={busy || !canManage}>
            {busy ? 'Validando código...' : 'Ativar / renovar'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={clear} disabled={busy || !canManage}>
            Remover licença local
          </button>
        </div>

        {!canManage ? <p className="licenca-mensal-warning">Entre com usuário administrador para renovar a licença.</p> : null}

        {feedback ? (
          <div className={`licenca-mensal-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
            <strong>{feedback.title}</strong>
            <span>{feedback.text}</span>
            {feedback.type === 'ok' && feedback.expiresAt ? (
              <em>Data de expiração: {formatDate(feedback.expiresAt)}</em>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="licenca-mensal-card licenca-mensal-policy-card">
        <div className="licenca-card-title-row">
          <h2>Política de bloqueio</h2>
          <span className="licenca-chip">Backup liberado</span>
        </div>
        <ul className="licenca-mensal-policy">
          <li>Backup, licença, ajuda e atualização ficam liberados mesmo vencido.</li>
          <li>Vendas, OS, cadastros, financeiro e impressão ficam bloqueados após vencer.</li>
          <li>Se a data do Windows voltar, o sistema pede renovação/confirmação.</li>
        </ul>
      </section>
    </div>
  );
}
