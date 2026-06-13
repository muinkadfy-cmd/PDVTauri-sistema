import { useEffect, useMemo, useState } from 'react';

import { useCompany } from '@/contexts/CompanyContext';
import { getMonthlyLicenseStatusSync, hydrateMonthlyLicenseFromDesktopKv, type MonthlyLicenseStatus } from '@/lib/license/monthly-license';
import { BUILD_BASE_VERSION } from '@/config/buildInfo';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatDatePtBR(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatIsoDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDatePtBR(d);
}

function licenseLabel(status: MonthlyLicenseStatus): string {
  if (status.status === 'active') return `Licença: ${status.daysRemaining ?? '—'} dias`;
  if (status.status === 'warning') return `Licença: vence em ${status.daysRemaining ?? '—'} dias`;
  if (status.status === 'expired') return 'Licença: vencida';
  if (status.status === 'blocked') return 'Licença: bloqueada';
  return 'Licença: ativar';
}

function licenseMeta(status: MonthlyLicenseStatus): string {
  if (status.validUntil) {
    const prefix = status.status === 'expired' || status.status === 'blocked' ? 'Expirou:' : 'Expira:';
    return `${prefix} ${formatIsoDate(status.validUntil)}`;
  }
  if (status.status === 'not_found') return 'Sem renovação ativa';
  return 'Aguardando validação';
}

type StatusIconName = 'info' | 'date' | 'time' | 'store' | 'license';

function StatusIcon({ name }: { name: StatusIconName }) {
  if (name === 'date') {
    return (
      <svg className="classic-statusbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'time') {
    return (
      <svg className="classic-statusbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }


  if (name === 'license') {
    return (
      <svg className="classic-statusbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4.8h10v7.4c0 3.2-2.1 6.2-5 7.6-2.9-1.4-5-4.4-5-7.6V4.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9.4 11.2 1.6 1.6 3.7-3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === 'store') {
    return (
      <svg className="classic-statusbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9l1.4-4h13.2L20 9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M5 9h14v10H5V9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 19v-5h6v5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className="classic-statusbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function ClassicStatusBar() {
  const { company } = useCompany();
  const [now, setNow] = useState(() => new Date());
  const [licenseStatus, setLicenseStatus] = useState(() => getMonthlyLicenseStatusSync());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const refresh = () => setLicenseStatus(getMonthlyLicenseStatusSync());
    refresh();
    void hydrateMonthlyLicenseFromDesktopKv().finally(refresh);
    window.addEventListener('smarttech:monthly-license-changed', refresh);
    const t = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('smarttech:monthly-license-changed', refresh);
      window.clearInterval(t);
    };
  }, []);

  const loja = useMemo(() => {
    const name = (company?.nome_fantasia || company?.razao_social || 'Smart Tech').trim();
    return name || 'Smart Tech';
  }, [company?.nome_fantasia, company?.razao_social]);

  const version = String(import.meta.env.VITE_APP_VERSION || BUILD_BASE_VERSION);
  const corporateBrand = 'Smart Tech Rolândia';

  return (
    <footer className="classic-statusbar" role="contentinfo" aria-label="Status do sistema">
      <div className="classic-statusbar-cell">
        <StatusIcon name="info" />
        <span>Versão {version}</span>
      </div>
      <div className="classic-statusbar-cell">
        <StatusIcon name="date" />
        <span>Data:&nbsp; {formatDatePtBR(now)}</span>
      </div>
      <div className="classic-statusbar-cell">
        <StatusIcon name="time" />
        <span>Hora:&nbsp; {formatTime(now)}</span>
      </div>
      <div className={`classic-statusbar-cell classic-statusbar-license classic-statusbar-license--${licenseStatus.status}`}>
        <StatusIcon name="license" />
        <div className="classic-statusbar-license-copy">
          <strong>{licenseLabel(licenseStatus)}</strong>
          <small>{licenseMeta(licenseStatus)}</small>
        </div>
        <span className="classic-statusbar-dot" aria-hidden="true" />
      </div>
      <div className="classic-statusbar-cell">
        <span>Sistema:&nbsp;</span>
        <span className="classic-statusbar-ok">Operacional</span>
        <span className="classic-statusbar-dot" aria-hidden="true" />
      </div>
      <div className="classic-statusbar-cell classic-statusbar-cell--brand">
        <StatusIcon name="store" />
        <div className="classic-statusbar-brand-copy">
          <strong>© {corporateBrand}</strong>
          <small>Loja: {loja}</small>
        </div>
      </div>
    </footer>
  );
}
