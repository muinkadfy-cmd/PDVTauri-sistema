/**
 * Página de Diagnóstico Completo do Sistema (DEV Only)
 * Health Check completo: versão, modo, Supabase, dados, sync, rotas
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  clientesRepo, 
  produtosRepo, 
  vendasRepo, 
  ordensRepo, 
  financeiroRepo,
  cobrancasRepo,
  devolucoesRepo,
  encomendasRepo,
  recibosRepo,
  codigosRepo
} from '@/lib/repositories';
import { getOutboxStats, getPendingOutboxItems, getFailedOutboxItems } from '@/lib/repository/outbox';
import { forceSync, forcePull } from '@/lib/repository';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getClientId } from '@/lib/tenant';
import { getStoreIdDiagnostics } from '@/lib/store-id';
import { getCurrentSession } from '@/lib/auth-supabase';
import { router } from '@/app/routes';
import { showToast } from '@/components/ui/ToastContainer';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import './DiagnosticoPage.css';

interface RouteInfo {
  path: string;
  element?: string;
  isPublic: boolean;
  requiresAuth: boolean;
  requiresClientId: boolean;
  isDevOnly: boolean;
}

interface TableStats {
  nome: string;
  tableName: string;
  local: number;
  outbox: number;
  failed: number;
}

function DiagnosticoPage() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(isBrowserOnlineSafe());
  const [isSupabase, setIsSupabase] = useState(false);
  const [storeId, setStoreId] = useState<string>('');
  const [storeIdDiagnostics, setStoreIdDiagnostics] = useState<any>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD && !getDiagnosticsEnabled()) {
      navigate('/');
      return;
    }

    loadData();
    
    const refreshOnline = () => setIsOnline(isBrowserOnlineSafe());

    window.addEventListener('online', refreshOnline);
    window.addEventListener('offline', refreshOnline);

    return () => {
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener('offline', refreshOnline);
    };
  }, [refreshKey, navigate]);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setIsSupabase(isSupabaseConfigured());
    setStoreId(getRuntimeStoreId() || '');
    
    // Diagnóstico do store_id
    const diagnostics = getStoreIdDiagnostics();
    setStoreIdDiagnostics(diagnostics);
    
    const outboxItems = getPendingOutboxItems();
    const failedItems = getFailedOutboxItems();
    
    const stats: TableStats[] = [
      { nome: 'Clientes', tableName: 'clientes', local: clientesRepo.count(), outbox: outboxItems.filter(i => i.table === 'clientes').length, failed: failedItems.filter(i => i.table === 'clientes').length },
      { nome: 'Produtos', tableName: 'produtos', local: produtosRepo.count(), outbox: outboxItems.filter(i => i.table === 'produtos').length, failed: failedItems.filter(i => i.table === 'produtos').length },
      { nome: 'Vendas', tableName: 'vendas', local: vendasRepo.count(), outbox: outboxItems.filter(i => i.table === 'vendas').length, failed: failedItems.filter(i => i.table === 'vendas').length },
      { nome: 'Ordens', tableName: 'ordens_servico', local: ordensRepo.count(), outbox: outboxItems.filter(i => i.table === 'ordens_servico').length, failed: failedItems.filter(i => i.table === 'ordens_servico').length },
      { nome: 'Financeiro', tableName: 'financeiro', local: financeiroRepo.count(), outbox: outboxItems.filter(i => i.table === 'financeiro').length, failed: failedItems.filter(i => i.table === 'financeiro').length },
      { nome: 'Cobranças', tableName: 'cobrancas', local: cobrancasRepo.count(), outbox: outboxItems.filter(i => i.table === 'cobrancas').length, failed: failedItems.filter(i => i.table === 'cobrancas').length },
      { nome: 'Devoluções', tableName: 'devolucoes', local: devolucoesRepo.count(), outbox: outboxItems.filter(i => i.table === 'devolucoes').length, failed: failedItems.filter(i => i.table === 'devolucoes').length },
      { nome: 'Encomendas', tableName: 'encomendas', local: encomendasRepo.count(), outbox: outboxItems.filter(i => i.table === 'encomendas').length, failed: failedItems.filter(i => i.table === 'encomendas').length },
      { nome: 'Recibos', tableName: 'recibos', local: recibosRepo.count(), outbox: outboxItems.filter(i => i.table === 'recibos').length, failed: failedItems.filter(i => i.table === 'recibos').length },
      { nome: 'Códigos', tableName: 'codigos', local: codigosRepo.count(), outbox: outboxItems.filter(i => i.table === 'codigos').length, failed: failedItems.filter(i => i.table === 'codigos').length },
    ];
    
    setTableStats(stats);
    
    // Extrair rotas
    const extractedRoutes = extractRoutes(router.routes);
    setRoutes(extractedRoutes);
    
    // Último erro de sync (do localStorage)
    const lastError = localStorage.getItem('smart-tech-last-sync-error');
    setLastSyncError(lastError);
  };

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

  const handleTestRoute = (path: string) => {
    console.log('[Diagnostico] Testando rota:', path);
    navigate(path);
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const pushResult = await forceSync();
      const pullResult = await forcePull();
      
      const totalSynced = pushResult.synced + pullResult.pulled;
      const totalErrors = pushResult.errors + pullResult.errors;
      
      if (totalErrors === 0) {
        showToast(`Sync: ${pushResult.synced} enviado(s), ${pullResult.pulled} baixado(s)`, 'success');
      } else {
        showToast(`Sync parcial: ${totalSynced} sucesso, ${totalErrors} erro(s)`, 'warning');
      }
      
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      showToast(`Erro ao sincronizar: ${err?.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const session = getCurrentSession();
  const clientId = getClientId();
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
  const mode = import.meta.env.DEV ? 'DEV' : 'PROD';

  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="diagnostico-page">
      <div className="diagnostico-header">
        <h1>🔍 Diagnóstico Completo do Sistema</h1>
        <p>Health Check e Auditoria (DEV Only)</p>
      </div>

      <div className="diagnostico-grid">
        {/* Informações Gerais */}
        <div className="diagnostico-card">
          <h2>📊 Informações Gerais</h2>
          <div className="diagnostico-info">
            <div className="info-row">
              <span className="info-label">Versão do App:</span>
              <span className="info-value">{appVersion}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Modo:</span>
              <span className={`info-value ${mode === 'DEV' ? 'status-ok' : 'status-warning'}`}>
                {mode}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Supabase:</span>
              <span className={`info-value ${isSupabase ? 'status-ok' : 'status-error'}`}>
                {isSupabase ? '✅ ON' : '❌ OFF'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Conexão:</span>
              <span className={`info-value ${isOnline ? 'status-ok' : 'status-error'}`}>
                {isOnline ? '✅ Online' : '❌ Offline'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">CLIENT_ID:</span>
              <span className={`info-value ${clientId ? 'status-ok' : 'status-error'}`}>
                {clientId || '❌ Não configurado'}
              </span>
            </div>
            {storeIdDiagnostics && (
              <>
                <div className="info-row">
                  <span className="info-label">Store ID (UUID):</span>
                  <span className={`info-value ${storeIdDiagnostics.isValid ? 'status-ok' : 'status-error'}`}>
                    {storeIdDiagnostics.storeId || '❌ Inválido/ausente'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Fonte:</span>
                  <span className="info-value">{storeIdDiagnostics.source}</span>
                </div>
              </>
            )}
            <div className="info-row">
              <span className="info-label">Autenticação:</span>
              <span className={`info-value ${session ? 'status-ok' : 'status-warning'}`}>
                {session ? `✅ ${session.username}` : '⚠️ Não autenticado'}
              </span>
            </div>
          </div>
        </div>

        {/* Dados Locais */}
        <div className="diagnostico-card">
          <h2>💾 Dados Locais</h2>
          <div className="diagnostico-table">
            <table>
              <thead>
                <tr>
                  <th>Tabela</th>
                  <th>Local</th>
                  <th>Outbox</th>
                  <th>Falhas</th>
                </tr>
              </thead>
              <tbody>
                {tableStats.map(stat => (
                  <tr key={stat.tableName}>
                    <td>{stat.nome}</td>
                    <td>{stat.local}</td>
                    <td className={stat.outbox > 0 ? 'status-warning' : ''}>{stat.outbox}</td>
                    <td className={stat.failed > 0 ? 'status-error' : ''}>{stat.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="diagnostico-actions">
            <button 
              className="btn-primary"
              onClick={handleForceSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Sincronizando...' : '🔄 Forçar Sync'}
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setRefreshKey(prev => prev + 1)}
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* Status de Sync */}
        <div className="diagnostico-card">
          <h2>🔄 Status de Sincronização</h2>
          <div className="diagnostico-info">
            <div className="info-row">
              <span className="info-label">Último Erro:</span>
              <span className="info-value">
                {lastSyncError ? (
                  <span className="status-error">{lastSyncError}</span>
                ) : (
                  <span className="status-ok">Nenhum erro</span>
                )}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Itens Pendentes:</span>
              <span className="info-value">
                {tableStats.reduce((sum, s) => sum + s.outbox, 0)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Itens com Falha:</span>
              <span className="info-value">
                {tableStats.reduce((sum, s) => sum + s.failed, 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Rotas */}
        <div className="diagnostico-card diagnostico-card-full">
          <h2>🛣️ Rotas do Sistema ({routes.length})</h2>
          <div className="diagnostico-routes">
            <div className="routes-grid">
              {routes.map(route => {
                const status = getRouteStatus(route, clientId, session);
                return (
                  <div 
                    key={route.path} 
                    className={`route-item ${status.status}`}
                    onClick={() => handleTestRoute(route.path)}
                  >
                    <div className="route-path">{route.path}</div>
                    <div className="route-info">
                      <span className="route-element">{route.element || 'Unknown'}</span>
                      <span className={`route-status ${status.status}`}>
                        {status.message}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRouteStatus(route: RouteInfo, clientId: string | null, session: any): { status: 'ok' | 'warning' | 'error'; message: string } {
  if (route.isPublic) {
    return { status: 'ok', message: 'Pública' };
  }

  if (route.requiresClientId && !clientId) {
    return { status: 'error', message: 'Sem CLIENT_ID' };
  }

  if (route.requiresAuth && !session) {
    return { status: 'warning', message: 'Requer auth' };
  }

  return { status: 'ok', message: 'OK' };
}

export default DiagnosticoPage;
