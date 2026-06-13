import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { getLicenseStatus, getLicenseStatusAsync, type LicenseStatus } from '@/lib/license';
import { isLicenseEnabled } from '@/lib/mode';

function FullscreenCheck({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          width: 'min(720px, 96vw)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.03)',
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            aria-hidden
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: '3px solid rgba(255,255,255,0.18)',
              borderTopColor: 'var(--primary)',
              animation: 'spin 0.85s linear infinite',
            }}
          />
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{message}</div>
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
          Se ficar travado, abra a tela de ativação:
          <button
            type="button"
            onClick={() => (window.location.href = '/comprar')}
            style={{
              marginLeft: 10,
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Ir para ativação
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Gate de licença (antes de entrar no sistema).
 * - Só bloqueia quando o recurso de licença estiver ATIVO (feature flag).
 * - Em DEV nunca bloqueia.
 */
export default function LicenseGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  const [status, setStatus] = useState<LicenseStatus>(() => getLicenseStatus());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    redirectedRef.current = false;
    setStatus(getLicenseStatus());
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!isLicenseEnabled()) return;

    // nunca bloquear telas públicas (login/setup) — deve abrir no login e só bloquear após entrar
    if (
      location.pathname.startsWith('/login') ||
      location.pathname.startsWith('/setup') ||
      location.pathname.startsWith('/wizard') ||
      location.pathname.startsWith('/reset')
    ) return;

    // nunca bloquear a tela de ativação
    if (location.pathname.startsWith('/ativacao') || location.pathname.startsWith('/comprar')) return;

    const st = getLicenseStatus();
    // já está ok
    if (st.status === 'active' || st.status === 'trial') return;

    const from = location.pathname + location.search;

    // Se estiver "offline" (ainda sem validar assinatura), valida 1x antes de redirecionar.
    if (st.status === 'offline') {
      setChecking(true);
      getLicenseStatusAsync()
        .then((verified) => {
          setStatus(verified);
          if (verified.status !== 'active' && verified.status !== 'trial' && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate('/comprar', { replace: true, state: { from } });
          }
        })
        .catch(() => {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            navigate('/comprar', { replace: true, state: { from } });
          }
        })
        .finally(() => setChecking(false));
      return;
    }

    // Qualquer outro status (not_found/invalid/expired/blocked) -> ativação.
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      navigate('/comprar', { replace: true, state: { from } });
    }
  }, [location.pathname, location.search, navigate]);

  if (!import.meta.env.DEV && isLicenseEnabled() && (checking || status.status === 'offline')) {
    return <FullscreenCheck message="Validando licença…" />;
  }

  return children;
}