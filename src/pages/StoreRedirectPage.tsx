/**
 * Página de Redirecionamento de Loja
 * Rota curta: /s/:storeId → Define store_id e redireciona para o sistema
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setStoreId, isValidUUID } from '@/lib/store-id';
import { getCurrentSession } from '@/lib/auth-supabase';
import { isDesktopApp } from '@/lib/platform';

export default function StoreRedirectPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Desktop offline total: link antigo /s/:storeId NÃO pode trocar a loja/banco do cliente.
    // Isso evita abrir outro SQLite e parecer que os dados sumiram.
    if (isDesktopApp()) {
      const session = getCurrentSession();
      navigate(session ? '/painel' : '/login', { replace: true });
      return;
    }

    if (!storeId || !isValidUUID(storeId)) {
      console.error('[StoreRedirect] ID inválido:', storeId);
      navigate('/login', { replace: true });
      return;
    }

    // Web/PWA: link curto ainda pode selecionar a loja remota.
    setStoreId(storeId);
    console.log('[StoreRedirect] Store ID definido:', storeId);

    // Se já existir sessão, segue para o painel da loja atual.
    // Sem sessão, o link curto deve abrir o login da loja, não a área protegida.
    const session = getCurrentSession();
    if (session) {
      navigate('/painel', { replace: true });
      return;
    }

    navigate(`/login?store=${encodeURIComponent(storeId)}`, {
      replace: true,
      state: {
        prefill: {
          storeId,
        },
      },
    });
  }, [storeId, navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--background, #f5f5f5)'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e0e0e0',
          borderTop: '4px solid var(--primary-color, #2563eb)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        <p style={{ color: 'var(--text-secondary, #666)' }}>{isDesktopApp() ? 'Link de loja online desativado no Desktop offline…' : 'Redirecionando...'}</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
