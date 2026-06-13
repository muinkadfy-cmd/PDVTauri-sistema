/**
 * ProtectedRoute - Guard robusto de autenticação
 * 
 * Funcionalidades:
 * - Loading state durante verificação
 * - Preserva rota original no redirect
 * - Logs de diagnóstico em DEV
 * - Evita loops de redirect
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentSession } from '@/lib/auth-supabase';
import { getClientId } from '@/lib/tenant';
import { getStoreId, isValidUUID } from '@/lib/store-id';
import { ensureSupabaseAuthenticated, isSupabaseConfigured } from '@/lib/supabase';
import { isDesktopApp } from '@/lib/platform';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireClientId?: boolean;
}

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'no-client-id' | 'timeout';

export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireClientId = true 
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [hasRedirected, setHasRedirected] = useState(false);
  const [timeoutMsg, setTimeoutMsg] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      // Logs de diagnóstico (DEV only)
      if (import.meta.env.DEV) {
        console.log('[ProtectedRoute] Verificando autenticação...', {
          path: location.pathname,
          search: location.search,
          requireAuth,
          requireClientId
        });
      }

      // 0. Verificar StoreId (multitenant)
      const resolved = getStoreId();
      const storeId = resolved.storeId?.trim() || '';
      if (!storeId || !isValidUUID(storeId)) {
        if (import.meta.env.DEV) {
          console.warn('[ProtectedRoute] StoreId ausente/ inválido, redirecionando para /login');
        }
        setAuthState('unauthenticated');
        if (!hasRedirected) {
          setHasRedirected(true);
          navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
        }
        return;
      }

      // 0.1 Garantir sessão Supabase (RLS) antes de prosseguir (best-effort)
      if (isSupabaseConfigured()) {
        const auth = await ensureSupabaseAuthenticated();
        if (import.meta.env.DEV) {
          console.log('[ProtectedRoute] ensureSupabaseAuthenticated', auth);
        }
      }

      // 1. Verificar CLIENT_ID primeiro
      if (requireClientId) {
        const clientId = getClientId();
        if (!clientId) {
          if (import.meta.env.DEV) {
            console.warn('[ProtectedRoute] CLIENT_ID não configurado, redirecionando para /setup');
          }
          setAuthState('no-client-id');
          if (!hasRedirected) {
            setHasRedirected(true);
            navigate('/setup', { 
              replace: true,
              state: { from: location.pathname }
            });
          }
          return;
        }
      }

      // 2. Verificar autenticação
      if (requireAuth) {
        const session = getCurrentSession();
        
        if (import.meta.env.DEV) {
          console.log('[ProtectedRoute] Sessão:', {
            exists: !!session,
            userId: session?.userId,
            username: session?.username,
            role: session?.role,
            expiresAt: session?.expiresAt
          });
        }

        if (!session) {
          if (import.meta.env.DEV) {
            console.warn('[ProtectedRoute] Não autenticado, redirecionando para /login');
          }
          setAuthState('unauthenticated');
          if (!hasRedirected) {
            setHasRedirected(true);
            // Preservar rota original para redirect pós-login
            const loginUrl = isDesktopApp() ? '/login' : `/login?store=${encodeURIComponent(storeId)}`;
            navigate(loginUrl, { 
              replace: true,
              state: { from: location.pathname + location.search }
            });
          }
          return;
        }

        // Verificar se sessão expirou
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < new Date()) {
          if (import.meta.env.DEV) {
            console.warn('[ProtectedRoute] Sessão expirada');
          }
          setAuthState('unauthenticated');
          if (!hasRedirected) {
            setHasRedirected(true);
            const loginUrl = isDesktopApp() ? '/login' : `/login?store=${encodeURIComponent(storeId)}`;
            navigate(loginUrl, { 
              replace: true,
              state: { from: location.pathname + location.search }
            });
          }
          return;
        }
      }

      // 3. Autenticado e autorizado
      if (import.meta.env.DEV) {
        console.log('[ProtectedRoute] Autenticado, permitindo acesso');
      }
      setAuthState('authenticated');
    };

    setAuthState('loading');
    setTimeoutMsg('');

    const timeoutId = window.setTimeout(() => {
      setAuthState('timeout');
      setTimeoutMsg('A verificação demorou demais (8s). Tente recarregar a página.');
    }, 8000);

    checkAuth()
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  }, [navigate, location.pathname, requireAuth, requireClientId, hasRedirected]);

  // Loading state
  if (authState === 'loading') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--border-light, #e5e7eb)',
          borderTop: '4px solid var(--primary, #3b82f6)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <p style={{ color: 'var(--text-secondary, #666)' }}>
          Verificando autenticação...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (authState === 'timeout') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>⚠️ Não foi possível verificar o acesso</div>
        <div style={{ color: 'var(--text-secondary, #666)' }}>{timeoutMsg || 'Tente novamente.'}</div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => window.location.reload()}
          style={{ minWidth: 180 }}
        >
          Recarregar
        </button>
      </div>
    );
  }

  // Não renderizar enquanto redireciona
  if (authState !== 'authenticated') {
    return null;
  }

  // Renderizar children se autenticado
  return <>{children}</>;
}
