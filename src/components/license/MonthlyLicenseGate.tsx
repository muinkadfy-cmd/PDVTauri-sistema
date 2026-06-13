import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  getMonthlyLicenseStatusSync,
  hydrateMonthlyLicenseFromDesktopKv,
  isMonthlyLicenseExemptPath,
  type MonthlyLicenseStatus,
} from '@/lib/license/monthly-license';
import './MonthlyLicenseGate.css';

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function getTitle(status: MonthlyLicenseStatus): string {
  if (status.status === 'blocked') return 'Licença bloqueada';
  if (status.status === 'expired') return 'Licença mensal vencida';
  return 'Licença mensal necessária';
}

function getDescription(status: MonthlyLicenseStatus): string {
  if (status.reason === 'clock_rollback') {
    return 'A data ou hora do Windows parece ter sido alterada. Confirme a licença para continuar usando os módulos principais.';
  }
  if (status.reason === 'device_mismatch') {
    return 'A licença salva pertence a outro computador. Solicite um novo código para este ID.';
  }
  if (status.status === 'expired') {
    return 'Renove a mensalidade para voltar a criar vendas, OS, cadastros e lançamentos.';
  }
  return 'Digite o código mensal enviado pelo suporte para liberar o uso do sistema neste computador.';
}

function MonthlyLicenseBlocked({ status }: { status: MonthlyLicenseStatus }) {
  return (
    <section className="monthly-license-blocked" aria-label="Licença mensal necessária">
      <div className="monthly-license-blocked-card">
        <div className="monthly-license-blocked-icon" aria-hidden="true">🔐</div>
        <div>
          <h1>{getTitle(status)}</h1>
          <p>{getDescription(status)}</p>
        </div>

        <div className="monthly-license-blocked-grid">
          <div>
            <strong>ID deste computador</strong>
            <span>{status.deviceCode}</span>
          </div>
          <div>
            <strong>Vencimento</strong>
            <span>{formatDate(status.validUntil)}</span>
          </div>
          <div>
            <strong>Status</strong>
            <span>{status.message}</span>
          </div>
        </div>

        <div className="monthly-license-blocked-actions">
          <Link className="btn btn-primary" to="/licenca">Inserir código de renovação</Link>
          <Link className="btn btn-secondary" to="/backup">Fazer backup dos dados</Link>
          <Link className="btn btn-secondary" to="/ajuda">Ajuda/Suporte</Link>
        </div>

        <p className="monthly-license-blocked-note">
          Seus dados continuam no computador. Backup e tela de licença ficam liberados mesmo com a licença vencida.
        </p>
      </div>
    </section>
  );
}

export default function MonthlyLicenseGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => getMonthlyLicenseStatusSync());
  const exempt = useMemo(() => isMonthlyLicenseExemptPath(location.pathname), [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted) setStatus(getMonthlyLicenseStatusSync());
    };

    refresh();
    void hydrateMonthlyLicenseFromDesktopKv().finally(refresh);

    window.addEventListener('smarttech:monthly-license-changed', refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      mounted = false;
      window.removeEventListener('smarttech:monthly-license-changed', refresh);
      window.clearInterval(interval);
    };
  }, [location.pathname]);

  if (status.canUseCore || exempt) {
    return <>{children}</>;
  }

  return <MonthlyLicenseBlocked status={status} />;
}
