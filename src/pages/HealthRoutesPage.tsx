/**
 * HealthRoutesPage - Diagnóstico de Rotas (DEV Only)
 * 
 * Permite testar todas as rotas do sistema e identificar problemas
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { router } from '@/app/routes';
import { getCurrentSession } from '@/lib/auth-supabase';
import { getClientId } from '@/lib/tenant';
import './HealthRoutesPage.css';

interface RouteInfo {
  path: string;
  element?: string;
  isPublic: boolean;
  requiresAuth: boolean;
  requiresClientId: boolean;
  isDevOnly: boolean;
}

function HealthRoutesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getCurrentSession();
  const clientId = getClientId();

  // Extrair informações das rotas
  const extractRoutes = (routes: any[], parentPath = ''): RouteInfo[] => {
    const result: RouteInfo[] = [];

    routes.forEach(route => {
      const fullPath = parentPath + (route.path || '');
      const isPublic = fullPath === '/login' || fullPath === '/setup';
      const isDevOnly = fullPath.includes('testes') || 
                       fullPath.includes('diagnostico') || 
                       fullPath.includes('audit') ||
                       fullPath.includes('health-routes');

      result.push({
        path: fullPath || '/',
        element: route.element?.type?.name || route.element?.displayName || 'Unknown',
        isPublic,
        requiresAuth: !isPublic,
        requiresClientId: !isPublic,
        isDevOnly
      });

      if (route.children) {
        result.push(...extractRoutes(route.children, fullPath));
      }
    });

    return result;
  };

  const routes = extractRoutes(router.routes);

  const testRoute = (path: string) => {
    console.log('[HealthRoutes] Testando rota:', path);
    navigate(path);
  };

  const getRouteStatus = (route: RouteInfo): { status: 'ok' | 'warning' | 'error'; message: string } => {
    if (route.isPublic) {
      return { status: 'ok', message: 'Rota pública' };
    }

    if (route.requiresClientId && !clientId) {
      return { status: 'error', message: 'CLIENT_ID não configurado' };
    }

    if (route.requiresAuth && !session) {
      return { status: 'warning', message: 'Requer autenticação' };
    }

    return { status: 'ok', message: 'Acessível' };
  };

  if (!import.meta.env.DEV) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Página de Desenvolvimento</h1>
        <p>Esta página está disponível apenas em modo de desenvolvimento.</p>
      </div>
    );
  }

  return (
    <div className="health-routes-page">
      <div className="health-routes-header">
        <h1>🔍 Diagnóstico de Rotas</h1>
        <p>Teste todas as rotas do sistema e identifique problemas</p>
      </div>

      <div className="health-routes-status">
        <div className="status-card">
          <h3>Status do Sistema</h3>
          <div className="status-item">
            <span className="status-label">CLIENT_ID:</span>
            <span className={clientId ? 'status-ok' : 'status-error'}>
              {clientId ? '✅ Configurado' : '❌ Não configurado'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Autenticação:</span>
            <span className={session ? 'status-ok' : 'status-warning'}>
              {session ? `✅ Logado como ${session.username}` : '⚠️ Não autenticado'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Rota Atual:</span>
            <span className="status-info">{location.pathname}</span>
          </div>
        </div>
      </div>

      <div className="health-routes-list">
        <h2>Rotas do Sistema ({routes.length})</h2>
        <div className="routes-table">
          <div className="routes-header">
            <div className="route-col-path">Path</div>
            <div className="route-col-component">Componente</div>
            <div className="route-col-status">Status</div>
            <div className="route-col-actions">Ações</div>
          </div>
          {routes.map((route, index) => {
            const routeStatus = getRouteStatus(route);
            return (
              <div key={index} className="route-row">
                <div className="route-col-path">
                  <code>{route.path}</code>
                  {route.isDevOnly && <span className="dev-badge">DEV</span>}
                </div>
                <div className="route-col-component">
                  {route.element}
                </div>
                <div className="route-col-status">
                  <span className={`status-badge status-${routeStatus.status}`}>
                    {routeStatus.status === 'ok' && '✅'}
                    {routeStatus.status === 'warning' && '⚠️'}
                    {routeStatus.status === 'error' && '❌'}
                    {routeStatus.message}
                  </span>
                </div>
                <div className="route-col-actions">
                  <button
                    onClick={() => testRoute(route.path)}
                    className="btn-test-route"
                    disabled={routeStatus.status === 'error'}
                  >
                    Abrir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="health-routes-actions">
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          Voltar ao Painel
        </button>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary"
        >
          Recarregar Página
        </button>
      </div>
    </div>
  );
}

export default HealthRoutesPage;
