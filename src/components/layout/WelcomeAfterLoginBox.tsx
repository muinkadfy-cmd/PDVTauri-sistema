import { useEffect, useMemo, useState } from 'react';

import { useCompany } from '@/contexts/CompanyContext';
import { getCurrentSession, type UserSession } from '@/lib/auth-supabase';

import './WelcomeAfterLoginBox.css';

type WelcomeAfterLoginBoxProps = {
  session?: UserSession | null;
};

const SEEN_KEY_PREFIX = 'smart-tech:welcome-after-login-seen:';

type WelcomeMood = {
  greeting: 'Bom dia' | 'Boa tarde' | 'Boa noite';
  period: 'morning' | 'afternoon' | 'night';
  badge: string;
};

function getWelcomeMood(hour = new Date().getHours()): WelcomeMood {
  if (hour >= 5 && hour < 12) {
    return { greeting: 'Bom dia', period: 'morning', badge: 'Manhã tranquila' };
  }
  if (hour >= 12 && hour < 18) {
    return { greeting: 'Boa tarde', period: 'afternoon', badge: 'Tarde produtiva' };
  }
  return { greeting: 'Boa noite', period: 'night', badge: 'Noite serena' };
}

function getSessionKey(session: UserSession): string {
  const user = session.userId || session.username || session.email || 'usuario';
  const loginTime = session.loginTime || session.expiresAt || 'sessao';
  return `${SEEN_KEY_PREFIX}${user}:${loginTime}`;
}

function getDisplayName(session: UserSession, companyName?: string): string {
  const storeDisplay = companyName || session.storeName || '';
  const raw = storeDisplay || session.username || session.email || 'Smart Tech';
  const first = String(raw).trim().split(/\s+/)[0] || 'Smart Tech';
  const display = storeDisplay ? String(raw).trim() : first;
  return display.length > 28 ? `${display.slice(0, 28)}…` : display;
}

export default function WelcomeAfterLoginBox({ session }: WelcomeAfterLoginBoxProps) {
  const { company } = useCompany();
  const activeSession = useMemo(() => session || getCurrentSession(), [session]);
  const [open, setOpen] = useState(false);

  const sessionKey = useMemo(() => {
    return activeSession ? getSessionKey(activeSession) : '';
  }, [activeSession]);

  const mood = useMemo(() => getWelcomeMood(), []);
  const companyName = useMemo(() => {
    const value = company?.nome_fantasia || company?.razao_social || '';
    return String(value || '').trim();
  }, [company?.nome_fantasia, company?.razao_social]);
  const displayName = useMemo(() => {
    return activeSession ? getDisplayName(activeSession, companyName) : (companyName || 'Smart Tech');
  }, [activeSession, companyName]);

  useEffect(() => {
    if (!activeSession || !sessionKey) {
      setOpen(false);
      return;
    }

    try {
      const alreadySeen = window.sessionStorage.getItem(sessionKey) === '1';
      setOpen(!alreadySeen);
    } catch {
      setOpen(true);
    }
  }, [activeSession, sessionKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeWelcome();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionKey]);

  const closeWelcome = () => {
    try {
      if (sessionKey) window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Sem sessionStorage: apenas fecha em memória.
    }
    setOpen(false);
  };

  if (!open || !activeSession) return null;

  return (
    <div className="welcome-after-login-overlay" role="presentation" onClick={closeWelcome}>
      <section
        className={`welcome-after-login-box welcome-after-login-box--${mood.period}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-after-login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="welcome-after-login-close"
          onClick={closeWelcome}
          aria-label="Fechar mensagem de boas-vindas"
        >
          ×
        </button>

        <div className="welcome-after-login-badge">{mood.badge}</div>

        <div className={`welcome-after-login-weather welcome-after-login-weather--${mood.period}`} aria-hidden="true">
          {mood.period === 'morning' ? (
            <>
              <span className="weather-cloud weather-cloud--back" />
              <span className="weather-cloud weather-cloud--front" />
            </>
          ) : null}
          {mood.period === 'afternoon' ? (
            <>
              <span className="weather-sun" />
              <span className="weather-ray weather-ray--one" />
              <span className="weather-ray weather-ray--two" />
              <span className="weather-ray weather-ray--three" />
              <span className="weather-ray weather-ray--four" />
            </>
          ) : null}
          {mood.period === 'night' ? (
            <>
              <span className="weather-moon" />
              <span className="weather-star weather-star--one" />
              <span className="weather-star weather-star--two" />
              <span className="weather-star weather-star--three" />
            </>
          ) : null}
        </div>

        <h2 id="welcome-after-login-title">
          {mood.greeting}, {displayName}!
        </h2>

        <p>
          Que seu atendimento hoje seja leve, produtivo e cheio de bons resultados.
          Trabalhe com foco, alegria e confiança: cada cliente é uma nova oportunidade
          de fazer bem feito.
        </p>

        <strong className="welcome-after-login-blessing">
          Deus abençoe seu dia.
        </strong>

        <button type="button" className="welcome-after-login-action" onClick={closeWelcome}>
          Começar atendimento
        </button>
      </section>
    </div>
  );
}
