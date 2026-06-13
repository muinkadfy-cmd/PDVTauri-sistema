import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getCurrentSession } from '@/lib/auth-supabase';
import { useStoreResolver } from '@/hooks/useStoreResolver';
import { getStoreId } from '@/lib/store-id';
import { ROLE_ROUTES, type UserRole } from '@/types';
import { getEffectiveAllowedRoutes } from '@/lib/store-access';
import { getLicenseStatusAsync } from '@/lib/license';
import { isLicenseEnabled, isLicenseMandatory } from '@/lib/mode';
import { isDesktopApp } from '@/lib/platform';
import { isWizardDoneSync, hydrateWizardDoneFromDesktopKv } from '@/lib/first-run';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';


interface AuthGuardProps {
  children: ReactNode;
  requireRole?: UserRole;
}

export default function AuthGuard({ children, requireRole }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeId, status: storeStatus } = useStoreResolver();

  const resolvedStoreId = storeId || getCurrentSession()?.storeId || getStoreId().storeId;
  const buildUrl = (path: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    // Web/PWA: manter ?store na navegação. Desktop/Tauri: evitar querystring (troca de loja por URL antiga)
    if (!isDesktopApp() && resolvedStoreId) params.set('store', resolvedStoreId);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const redirectedRef = useRef(false);
  const runIdRef = useRef(0);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  // evita estado travado após redirect
  useEffect(() => {
    redirectedRef.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const runId = ++runIdRef.current;
    let active = true;
    const commit = (action: () => void) => {
      if (!active || runIdRef.current !== runId) return;
      action();
    };

    const init = async () => {
      commit(() => {
        if (!readyRef.current) setReady(false);
      });

      const pathname = location.pathname;

      // 🧭 Wizard de primeiro uso (Desktop): garante configuração guiada
      hydrateWizardDoneFromDesktopKv();
      if (isDesktopApp() && !isWizardDoneSync() && !pathname.startsWith('/wizard') && !pathname.startsWith('/ativacao') && !pathname.startsWith('/comprar')) {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          navigate('/wizard', { replace: true, state: { from: pathname } });
        }
        return;
      }

      // 🔐 Build de venda (Desktop/PROD): exige licença ativa antes de permitir uso.
      const licenseRequired = isLicenseMandatory() || isLicenseEnabled();
      if (licenseRequired && pathname !== '/ativacao' && pathname !== '/comprar') {
        try {
          const lic = await getLicenseStatusAsync();
          if (lic.status !== 'active' && lic.status !== 'trial') {
            if (!redirectedRef.current) {
              redirectedRef.current = true;
              navigate('/comprar', { replace: true, state: { from: pathname } });
            }
            return;
          }
        } catch {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            navigate('/comprar', { replace: true, state: { from: pathname } });
          }
          return;
        }
      }


      const PUBLIC_PATHS = new Set<string>(['/login', '/setup', '/configurar-loja', '/ativacao', '/wizard', '/comprar']);
      const ALWAYS_ALLOW_PREFIX = ['/s/'];
      const isPublicPath = (p: string) => PUBLIC_PATHS.has(p) || ALWAYS_ALLOW_PREFIX.some((x) => p.startsWith(x));

      // aguardar store resolver
      if (storeStatus === 'loading') {
        return;
      }

      // se store não resolvido, manda para configurar-loja (ou login, se público)
      if (!storeId && !isPublicPath(pathname)) {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          navigate('/configurar-loja', { replace: true });
        }
        return;
      }

      const session = getCurrentSession();

      // sem sessão
      if (!session && !isPublicPath(pathname)) {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          navigate(buildUrl('/login'), { replace: true, state: { from: pathname } });
        }
        return;
      }

      // com sessão, não precisa ficar na tela de login
      if (session && pathname === '/login') {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          navigate(buildUrl('/painel'), { replace: true });
        }
        return;
      }

      // (Modo local) Licença desativada.

      // role obrigatório no componente
      if (requireRole && session && session.role !== requireRole) {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          navigate(buildUrl('/painel'), { replace: true });
        }
        return;
      }

      // permissões por rota
      if (session) {
        if (session.isSuperAdmin && (pathname.startsWith('/lojas') || pathname.startsWith('/permissoes-loja'))) {
          commit(() => {
            readyRef.current = true;
            setReady(true);
          });
          return;
        }

        // Desktop offline P2: atualizações, backup, financeiro e configurações
        // passam pela matriz ROLE_ROUTES. Não liberar /atualizacoes para todo usuário logado.

        const allowed = await getEffectiveAllowedRoutes(session.role, storeId || session.storeId);
        const baseAllowed = ROLE_ROUTES[session.role] ?? [];
        const finalAllowed = (allowed && allowed.length ? allowed : baseAllowed);

        const isAllowedRoute = finalAllowed.some((r) => pathname.startsWith(r));
        if (!isAllowedRoute && !isPublicPath(pathname)) {
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            navigate(buildUrl('/painel'), { replace: true });
          }
          return;
        }
      }

      commit(() => {
        readyRef.current = true;
        setReady(true);
      });

      // ✅ Performance: ponto em que Auth/Guards estão ok
      try {
        perfMarkOnce('auth_ready');
        perfMeasure('app_start→auth_ready', 'app_start', 'auth_ready');
      } catch {
        // ignore
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [location.pathname, navigate, storeId, storeStatus, requireRole]);

  if (!ready) {
    return (
      <div style={{ padding: 18, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderTopColor: "transparent",  }} aria-hidden="true" />
        <div>Carregando…</div>
      </div>
    );
  }
  return children;
}
