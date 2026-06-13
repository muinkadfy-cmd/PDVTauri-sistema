import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isDesktopApp } from '@/lib/platform';
import { setWizardDone } from '@/lib/first-run';

export default function WizardPage() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const run = async () => {
      await setWizardDone().catch(() => undefined);
      const from = (loc.state as any)?.from as string | undefined;
      nav(from || '/painel', { replace: true });
    };
    void run();
  }, [loc.state, nav]);

  return (
    <div className="page-container" style={{ padding: '1.25rem' }}>
      <div style={{
        maxWidth: 760,
        margin: '0 auto',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.03)',
        padding: 20
      }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>✅ Modo offline liberado</div>
        <div style={{ opacity: 0.88, marginTop: 8, lineHeight: 1.5 }}>
          Este Desktop funciona em modo local/offline e não exige ativação nem licença.
          Estamos redirecionando para o painel.
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => nav('/painel', { replace: true })}>
            Entrar no sistema
          </button>
          {!isDesktopApp() && (
            <button className="btn btn-secondary" onClick={() => nav('/', { replace: true })}>
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
