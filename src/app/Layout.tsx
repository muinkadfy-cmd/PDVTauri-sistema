import { useState, useEffect, useCallback, useMemo, useRef, Suspense, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from '@/components/layout/Topbar';
import Sidebar from '@/components/layout/Sidebar';
import ClassicStatusBar from '@/components/layout/ClassicStatusBar';
import WelcomeAfterLoginBox from '@/components/layout/WelcomeAfterLoginBox';
import MonthlyLicenseGate from '@/components/license/MonthlyLicenseGate';
import BottomNav from '@/components/layout/BottomNav';
import DrawerMenu from '@/components/layout/DrawerMenu';
import AuthGuard from '@/components/AuthGuard';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import UpdateBanner from '@/components/updates/UpdateBanner';
import { APP_EVENTS } from '@/lib/app-events';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';
import { preloadForPathname } from '@/lib/route-preload';
import { installInstantNavigationWarmup, warmCriticalRouteModules, warmRouteModuleForPathname } from '@/lib/route-module-preload';
import { playAppSound } from '@/lib/sound-effects';
import { markNoticesReadByRoute } from '@/lib/system-notices';
import '@/styles/layout.css';
import '@/styles/reference-fidelity.css';

async function clearBrowserCaches() {
  if (typeof window === 'undefined' || typeof caches === 'undefined' || typeof caches.keys !== 'function') {
    return;
  }
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}


function OutletBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Reset on route change
    setErrorMsg(null);

    const onError = (ev: ErrorEvent) => {
      const msg = String(ev?.message || '');
      if (!msg) return;
      // Common for lazy chunk / dynamic import issues
      if (/ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(msg)) {
        setErrorMsg(msg);
      }
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = (ev as any)?.reason;
      const msg = String(reason?.message || reason || '');
      if (!msg) return;
      if (/ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(msg)) {
        setErrorMsg(msg);
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [location.pathname]);


  if (errorMsg) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '240px',
        padding: 16,
        color: 'var(--text-secondary)'
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Falha ao carregar a página</div>
        <div style={{ maxWidth: 620, textAlign: 'center', opacity: 0.9 }}>
          O navegador não conseguiu carregar um módulo (chunk) da aplicação. Isso costuma acontecer por cache antigo (PWA/Service Worker) ou rede instável.
        </div>
        <div style={{ maxWidth: 720, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12, opacity: 0.75 }}>
          {errorMsg}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Recarregar
          </button>
          <button
            type="button"
            onClick={() => {
              void clearBrowserCaches()
                .catch(() => undefined)
                .finally(() => window.location.reload());
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Limpar cache e recarregar
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      {children}
    </Suspense>
  );
}

function Layout() {
  const location = useLocation();
  const { session } = useAuth();
  const privateShellMarkedRef = useRef(false);
  const routeSoundReadyRef = useRef(false);
  const isPublicRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/setup") ||
    location.pathname.startsWith("/configurar-loja") ||
    location.pathname.startsWith("/ativacao") ||
    location.pathname.startsWith("/s/");
  // ⚠️ Importante (Desktop/Tauri): o tamanho mínimo da janela costuma ser ~1024px.
  // Se tratarmos 1024 como "tablet", o usuário fica sem Sidebar e acha que "sumiram abas".
  // Unificamos o breakpoint com o Sidebar (>= 901px = desktop).
  const [isMobile, setIsMobile] = useState(window.innerWidth < 700);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 700 && window.innerWidth < 901);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lowEndActive, setLowEndActive] = useState(() => document.documentElement.hasAttribute('data-low-end'));

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);

  useEffect(() => {
    let raf = 0;
    let timer: number | null = null;

    const commit = () => {
      const width = window.innerWidth;
      setIsMobile(width < 700);
      setIsTablet(width >= 700 && width < 901);
      if (width >= 901) {
        setDrawerOpen(false);
      }
    };

    const handleResize = () => {
      // Debounce leve para evitar "tempestade" de setState em resize
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(commit);
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timer) window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ✅ Performance: primeiro momento em que o shell privado realmente aparece
  useEffect(() => {
    if (isPublicRoute) return;
    if (privateShellMarkedRef.current) return;
    privateShellMarkedRef.current = true;
    try {
      perfMarkOnce('private_shell');
      perfMeasure('auth_ready→private_shell', 'auth_ready', 'private_shell');
    } catch {
      // ignore
    }
  }, [isPublicRoute]);
  // ✅ Low-end flag reativo (para cortar UI extra em PC fraco)
  useEffect(() => {
    const update = () => {
      try { setLowEndActive(document.documentElement.hasAttribute('data-low-end')); } catch {}
    };
    update();
    window.addEventListener(APP_EVENTS.LOW_END_MODE_CHANGED, update as any);
    return () => window.removeEventListener(APP_EVENTS.LOW_END_MODE_CHANGED, update as any);
  }, []);

  useEffect(() => {
    // Fechar drawer ao navegar
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isPublicRoute) return;
    markNoticesReadByRoute(location.pathname);
  }, [isPublicRoute, location.pathname]);

  useEffect(() => {
    if (!routeSoundReadyRef.current) {
      routeSoundReadyRef.current = true;
      return;
    }
    playAppSound('navigation');
  }, [location.pathname]);

  // P14: aquecimento de módulos para navegação instantânea sem tela de carregamento.
  useEffect(() => {
    if (isPublicRoute) return;
    try {
      installInstantNavigationWarmup();
      warmCriticalRouteModules();
    } catch {
      // ignore
    }
  }, [isPublicRoute]);

  // ✅ PC fraco: preload da tela atual + chunk da rota sempre fora do caminho crítico.
  useEffect(() => {
    if (isPublicRoute) return;
    try {
      warmRouteModuleForPathname(location.pathname, 'current-route');
      preloadForPathname(location.pathname);
    } catch {
      // ignore
    }
  }, [isPublicRoute, location.pathname]);


  // ✅ Em rotas públicas (login/setup/redirect), não renderizar chrome do app
  // Isso evita travar em "Inicializando..." quando ainda não existe sessão local.
  if (isPublicRoute) {
    return (
      <OutletBoundary>
        <Outlet />
      </OutletBoundary>
    );
  }

  const showSidebar = useMemo(() => !isMobile && !isTablet, [isMobile, isTablet]);
  const showDrawer = useMemo(() => (isMobile || isTablet) && drawerOpen, [isMobile, isTablet, drawerOpen]);

  return (
    <AuthGuard>
        <CompanyProvider>
          <div className="app">
          <Topbar onMenuToggle={toggleDrawer} />
          <UpdateBanner />
          <WelcomeAfterLoginBox session={session} />
          {/* SyncStatusBar oculto - status já visível no Topbar */}
          <div className="app-container">
            {showSidebar && <Sidebar />}
            {showDrawer && (
              <>
                <div className="drawer-overlay" onClick={closeDrawer} />
                <DrawerMenu onClose={closeDrawer} />
              </>
            )}
            <main className={`main-content ${showSidebar ? 'with-sidebar' : ''}`}>
              <MonthlyLicenseGate>
                <OutletBoundary>
                  <Outlet />
                </OutletBoundary>
              </MonthlyLicenseGate>
            </main>
            {isMobile && <BottomNav onOpenMenu={openDrawer} />}
          </div>
          <ClassicStatusBar />
        </div>
        </CompanyProvider>
    </AuthGuard>
  );
}

export default Layout;
