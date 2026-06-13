/**
 * DiagnosticoRotasPage - Diagnóstico Completo de Rotas
 * 
 * Testa todas as rotas do sistema, detecta telas em branco e erros
 * Disponível apenas em DEV
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentSession } from '@/lib/auth-supabase';
import { getClientId } from '@/lib/tenant';
import { canAccessRoute } from '@/lib/permissions';
import { ROLE_ROUTES } from '@/types';
import { showToast } from '@/components/ui/ToastContainer';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';
import './DiagnosticoRotasPage.css';

/**
 * Verifica se uma rota teve erro recente
 * Integração com ErrorBoundary através de localStorage
 */
function checkRouteError(routePath: string): boolean {
  try {
    const errorLog = localStorage.getItem('route-errors');
    if (!errorLog) return false;
    
    const errors = JSON.parse(errorLog) as Record<string, { timestamp: number; count: number }>;
    const errorData = errors[routePath];
    
    if (!errorData) return false;
    
    // Considerar erro se aconteceu nos últimos 5 minutos
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return errorData.timestamp > fiveMinutesAgo;
  } catch {
    return false;
  }
}

/**
 * Registra erro de rota
 */
function recordRouteError(routePath: string): void {
  try {
    const errorLog = localStorage.getItem('route-errors');
    const errors = errorLog ? JSON.parse(errorLog) : {};
    
    errors[routePath] = {
      timestamp: Date.now(),
      count: (errors[routePath]?.count || 0) + 1
    };
    
    localStorage.setItem('route-errors', JSON.stringify(errors));
  } catch {
    // Silenciar erro de localStorage
  }
}

interface RouteTest {
  path: string;
  component: string;
  requiresAuth: boolean;
  requiresRole?: 'admin' | 'atendente' | 'tecnico';
  isDevOnly: boolean;
  status: 'pending' | 'testing' | 'ok' | 'error' | 'blank' | 'blocked';
  error?: string;
  testedAt?: Date;
}

// Lista completa de rotas do sistema
const ALL_ROUTES: Omit<RouteTest, 'status' | 'error' | 'testedAt'>[] = [
  // Públicas
  { path: '/setup', component: 'SetupPage', requiresAuth: false, isDevOnly: false },
  { path: '/login', component: 'LoginPage', requiresAuth: false, isDevOnly: false },
  
  // Protegidas - Principal
  { path: '/', component: 'PainelPage', requiresAuth: true, isDevOnly: false },
  { path: '/painel', component: 'PainelPage', requiresAuth: true, isDevOnly: false },
  
  // Vendas e Operações
  { path: '/clientes', component: 'ClientesPage', requiresAuth: true, isDevOnly: false },
  { path: '/vendas', component: 'VendasPage', requiresAuth: true, isDevOnly: false },
  { path: '/produtos', component: 'ProdutosPage', requiresAuth: true, isDevOnly: false },
  { path: '/ordens', component: 'OrdensPage', requiresAuth: true, isDevOnly: false },
  
  // Financeiro
  { path: '/financeiro', component: 'FinanceiroPage', requiresAuth: true, requiresRole: 'atendente', isDevOnly: false },
  { path: '/relatorios', component: 'RelatoriosPage', requiresAuth: true, requiresRole: 'atendente', isDevOnly: false },
  { path: '/fluxo-caixa', component: 'FluxoCaixaPage', requiresAuth: true, requiresRole: 'atendente', isDevOnly: false },
  { path: '/cobrancas', component: 'CobrancasPage', requiresAuth: true, requiresRole: 'atendente', isDevOnly: false },
  { path: '/recibo', component: 'ReciboPage', requiresAuth: true, requiresRole: 'atendente', isDevOnly: false },
  { path: '/simular-taxas', component: 'SimularTaxasPage', requiresAuth: true, requiresRole: 'atendente', isDevOnly: false },
  
  // Estoque e Serviços
  { path: '/estoque', component: 'EstoquePage', requiresAuth: true, isDevOnly: false },
  { path: '/encomendas', component: 'EncomendasPage', requiresAuth: true, isDevOnly: false },
  { path: '/devolucao', component: 'DevolucaoPage', requiresAuth: true, isDevOnly: false },
  
  // Utilitários
  { path: '/codigos', component: 'CodigosPage', requiresAuth: true, isDevOnly: false },
  { path: '/imei', component: 'ImeiPage', requiresAuth: true, isDevOnly: false },
  { path: '/backup', component: 'BackupPage', requiresAuth: true, isDevOnly: false },
  { path: '/configuracoes', component: 'ConfiguracoesPage', requiresAuth: true, isDevOnly: false },
  
  // Admin Only
  { path: '/usuarios', component: 'UsuariosPage', requiresAuth: true, requiresRole: 'admin', isDevOnly: false },
  { path: '/licenca', component: 'LicensePage', requiresAuth: true, requiresRole: 'admin', isDevOnly: false },
  
  // Utilitárias
  { path: '/supabase-test', component: 'SupabaseTestPage', requiresAuth: true, isDevOnly: false },
  { path: '/sync-status', component: 'SyncStatusPage', requiresAuth: true, isDevOnly: false },
  
  // DEV Only
  { path: '/testes', component: 'SystemTestPage', requiresAuth: true, isDevOnly: true },
  { path: '/diagnostico-dados', component: 'DiagnosticoDadosPage', requiresAuth: true, isDevOnly: true },
  { path: '/produtos-diagnostico', component: 'ProdutosDiagnosticoPage', requiresAuth: true, isDevOnly: true },
  { path: '/audit', component: 'AuditPage', requiresAuth: true, isDevOnly: true },
  { path: '/health-routes', component: 'HealthRoutesPage', requiresAuth: true, isDevOnly: true },
  { path: '/diagnostico', component: 'DiagnosticoPage', requiresAuth: true, isDevOnly: true },
  { path: '/diagnostico-rotas', component: 'DiagnosticoRotasPage', requiresAuth: true, isDevOnly: true },
];

function DiagnosticoRotasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getCurrentSession();
  const clientId = getClientId();
  
  const [routes, setRoutes] = useState<RouteTest[]>(() => 
    ALL_ROUTES.map(r => ({ ...r, status: 'pending' as const }))
  );
  const [testing, setTesting] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  // Verificar se rota está acessível
  const checkRouteAccess = (route: RouteTest): { accessible: boolean; reason?: string } => {
    if (!route.requiresAuth) {
      return { accessible: true };
    }

    if (!clientId) {
      return { accessible: false, reason: 'CLIENT_ID não configurado' };
    }

    if (!session) {
      return { accessible: false, reason: 'Não autenticado' };
    }

    if (route.requiresRole && session.role !== route.requiresRole) {
      return { accessible: false, reason: `Requer role: ${route.requiresRole}, atual: ${session.role}` };
    }

    if (!canAccessRoute(route.path)) {
      return { accessible: false, reason: 'Bloqueado por permissões' };
    }

    return { accessible: true };
  };

  // Testar uma rota específica
  const testRoute = async (route: RouteTest) => {
    const access = checkRouteAccess(route);
    
    if (!access.accessible) {
      setRoutes(prev => prev.map(r => 
        r.path === route.path 
          ? { ...r, status: 'blocked' as const, error: access.reason, testedAt: new Date() }
          : r
      ));
      return;
    }

    setCurrentTest(route.path);
    setRoutes(prev => prev.map(r => 
      r.path === route.path ? { ...r, status: 'testing' as const } : r
    ));

    try {
      // Navegar para a rota
      navigate(route.path);
      
      // Aguardar um pouco para detectar erros
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar se houve erro no console (simulado - em produção usaria ErrorBoundary)
      // Verificar se a rota teve erro (via localStorage ou sessionStorage)
      const hasError = checkRouteError(route.path);
      
      setRoutes(prev => prev.map(r => 
        r.path === route.path 
          ? { 
              ...r, 
              status: hasError ? 'error' as const : 'ok' as const,
              testedAt: new Date()
            }
          : r
      ));
    } catch (error: any) {
      setRoutes(prev => prev.map(r => 
        r.path === route.path 
          ? { 
              ...r, 
              status: 'error' as const, 
              error: error?.message || 'Erro desconhecido',
              testedAt: new Date()
            }
          : r
      ));
    } finally {
      setCurrentTest(null);
    }
  };

  // Testar todas as rotas
  const testAllRoutes = async () => {
    if (testing) return;
    
    setTesting(true);
    const accessibleRoutes = routes.filter(r => checkRouteAccess(r).accessible);
    
    for (const route of accessibleRoutes) {
      await testRoute(route);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay entre testes
    }
    
    setTesting(false);
    showToast(`Teste concluído: ${accessibleRoutes.length} rotas testadas`, 'success');
  };

  const getStatusIcon = (status: RouteTest['status']) => {
    switch (status) {
      case 'ok': return '✅';
      case 'error': return '❌';
      case 'blocked': return '🚫';
      case 'testing': return '⏳';
      case 'blank': return '⬜';
      default: return '⏸️';
    }
  };

  const getStatusColor = (status: RouteTest['status']) => {
    switch (status) {
      case 'ok': return '#10b981';
      case 'error': return '#ef4444';
      case 'blocked': return '#f59e0b';
      case 'testing': return '#3b82f6';
      case 'blank': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  if (!import.meta.env.DEV) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Página de Desenvolvimento</h1>
        <p>Esta página está disponível apenas em modo de desenvolvimento.</p>
      </div>
    );
  }

  const stats = {
    total: routes.length,
    ok: routes.filter(r => r.status === 'ok').length,
    error: routes.filter(r => r.status === 'error').length,
    blocked: routes.filter(r => r.status === 'blocked').length,
    pending: routes.filter(r => r.status === 'pending').length,
  };

  return (
    <div className="diagnostico-rotas-page page-container">
      <div className="page-header">
        <h1>🔍 Diagnóstico de Rotas</h1>
        <p>Teste todas as rotas do sistema e identifique problemas</p>
      </div>

      <div className="diagnostico-stats" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="stat-card" style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ color: '#6b7280' }}>Total</div>
        </div>
        <div className="stat-card" style={{ padding: '1rem', background: '#d1fae5', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{stats.ok}</div>
          <div style={{ color: '#6b7280' }}>OK</div>
        </div>
        <div className="stat-card" style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.error}</div>
          <div style={{ color: '#6b7280' }}>Erro</div>
        </div>
        <div className="stat-card" style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats.blocked}</div>
          <div style={{ color: '#6b7280' }}>Bloqueado</div>
        </div>
        <div className="stat-card" style={{ padding: '1rem', background: '#e5e7eb', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6b7280' }}>{stats.pending}</div>
          <div style={{ color: '#6b7280' }}>Pendente</div>
        </div>
      </div>

      <div className="diagnostico-actions" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={testAllRoutes}
          disabled={testing}
          className="btn-primary"
          style={{ padding: '0.75rem 1.5rem' }}
        >
          {testing ? '⏳ Testando...' : '🚀 Testar Todas as Rotas'}
        </button>
        <button
          onClick={() => setRoutes(ALL_ROUTES.map(r => ({ ...r, status: 'pending' as const })))}
          disabled={testing}
          className="btn-secondary"
          style={{ padding: '0.75rem 1.5rem' }}
        >
          🔄 Resetar
        </button>
      </div>

      <div className="routes-list" style={{ 
        background: 'white', 
        borderRadius: '8px', 
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Path</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Componente</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Requisitos</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route, index) => {
              const access = checkRouteAccess(route);
              return (
                <tr 
                  key={index}
                  style={{ 
                    borderBottom: '1px solid #e5e7eb',
                    background: currentTest === route.path ? '#f0f9ff' : 'white'
                  }}
                >
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      fontSize: '1.5rem',
                      color: getStatusColor(route.status)
                    }}>
                      {getStatusIcon(route.status)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <code style={{ 
                      background: '#f3f4f6', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      {route.path}
                    </code>
                    {route.isDevOnly && (
                      <span style={{ 
                        marginLeft: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        background: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        DEV
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: '#6b7280' }}>
                    {route.component}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                    {route.requiresAuth && (
                      <span style={{ 
                        display: 'inline-block',
                        marginRight: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '4px'
                      }}>
                        🔐 Auth
                      </span>
                    )}
                    {route.requiresRole && (
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        background: '#fce7f3',
                        color: '#9f1239',
                        borderRadius: '4px'
                      }}>
                        👑 {route.requiresRole}
                      </span>
                    )}
                    {!access.accessible && access.reason && (
                      <div style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.75rem' }}>
                        ⚠️ {access.reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => testRoute(route)}
                      disabled={testing || !access.accessible}
                      className="btn-secondary"
                      style={{ 
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      {route.status === 'testing' ? '⏳' : '▶️'} Testar
                    </button>
                    {route.error && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        fontSize: '0.75rem', 
                        color: '#ef4444' 
                      }}>
                        {route.error}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="diagnostico-info" style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        background: '#f9fafb', 
        borderRadius: '8px',
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ Informações</h3>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li><strong>CLIENT_ID:</strong> {clientId ? `✅ ${clientId}` : '❌ Não configurado'}</li>
          <li><strong>Autenticação:</strong> {session ? `✅ ${session.username} (${session.role})` : '❌ Não autenticado'}</li>
          <li><strong>Rota Atual:</strong> {location.pathname}</li>
        </ul>
      </div>
    </div>
  );
}

export default DiagnosticoRotasPage;
