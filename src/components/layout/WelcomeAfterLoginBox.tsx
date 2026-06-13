import { useEffect, useMemo, useState } from 'react';

import { getCurrentSession, type UserSession } from '@/lib/auth-supabase';

import './WelcomeAfterLoginBox.css';

type WelcomeAfterLoginBoxProps = {
  session?: UserSession | null;
};

const SEEN_KEY_PREFIX = 'smart-tech:welcome-after-login-seen:';

function getGreeting(hour = new Date().getHours()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getSessionKey(session: UserSession): string {
  const user = session.userId || session.username || session.email || 'usuario';
  const loginTime = session.loginTime || session.expiresAt || 'sessao';
  return `${SEEN_KEY_PREFIX}${user}:${loginTime}`;
}

function getDisplayName(session: UserSession): string {
  const raw = session.username || session.email || 'Smart Tech';
  const first = String(raw).trim().split(/\s+/)[0] || 'Smart Tech';
  return first.length > 18 ? `${first.slice(0, 18)}…` : first;
}

export default function WelcomeAfterLoginBox({ session }: WelcomeAfterLoginBoxProps) {
  const activeSession = useMemo(() => session || getCurrentSession(), [session]);
  const [open, setOpen] = useState(false);

  const sessionKey = useMemo(() => {
    return activeSession ? getSessionKey(activeSession) : '';
  }, [activeSession]);

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = useMemo(() => {
    return activeSession ? getDisplayName(activeSession) : 'Smart Tech';
  }, [activeSession]);

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
        className="welcome-after-login-box"
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

        <div className="welcome-after-login-badge">Boas-vindas</div>

        <div className="welcome-after-login-icon" aria-hidden="true">
          ☀
        </div>

        <h2 id="welcome-after-login-title">
          {greeting}, {displayName}!
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
