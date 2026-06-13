import { useState, useEffect } from 'react';
import { getOutboxStats, getPendingOutboxItems, getFailedOutboxItems, forceSync, forcePull, clearOutboxErrors } from '@/lib/repository';
import { getSyncStatus } from '@/lib/repository/sync-engine';
import { showToast } from '@/components/ui/ToastContainer';
import { APP_EVENTS } from '@/lib/app-events';
import './SyncStatusPage.css';

const SYNC_CONFLICTS_STORAGE_KEY = 'smart-tech:sync-conflicts';

type SyncConflictRecord = {
  key: string;
  table: string;
  id: string;
  localUpdatedAt: string | null;
  remoteUpdatedAt: string | null;
  detectedAt: string;
};

function getStoredSyncConflicts(): SyncConflictRecord[] {
  try {
    const raw = localStorage.getItem(SYNC_CONFLICTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as SyncConflictRecord[] : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function SyncStatusPage() {
  const [stats, setStats] = useState(getOutboxStats());
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [pendingItems, setPendingItems] = useState(getPendingOutboxItems());
  const [failedItems, setFailedItems] = useState(getFailedOutboxItems());
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>(getStoredSyncConflicts());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(
    localStorage.getItem('smart-tech-last-sync') || null
  );

  useEffect(() => {
    const updateAll = () => {
      setStats(getOutboxStats());
      setSyncStatus(getSyncStatus());
      setPendingItems(getPendingOutboxItems());
      setFailedItems(getFailedOutboxItems());
      setConflicts(getStoredSyncConflicts());
    };

    updateAll();

    const handleSyncStatus = () => setSyncStatus(getSyncStatus());
    const handleOutboxChanged = () => updateAll();

    window.addEventListener(APP_EVENTS.OUTBOX_CHANGED, handleOutboxChanged as any);
    window.addEventListener(APP_EVENTS.SYNC_STATUS_CHANGED, handleOutboxChanged as any);
    window.addEventListener(APP_EVENTS.SYNC_CONFLICT_DETECTED, handleOutboxChanged as any);
    window.addEventListener('online', handleSyncStatus);
    window.addEventListener('offline', handleSyncStatus);

    return () => {
      window.removeEventListener(APP_EVENTS.OUTBOX_CHANGED, handleOutboxChanged as any);
      window.removeEventListener(APP_EVENTS.SYNC_STATUS_CHANGED, handleOutboxChanged as any);
      window.removeEventListener(APP_EVENTS.SYNC_CONFLICT_DETECTED, handleOutboxChanged as any);
      window.removeEventListener('online', handleSyncStatus);
      window.removeEventListener('offline', handleSyncStatus);
    };
  }, []);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      // Primeiro push (enviar dados locais)
      const pushResult = await forceSync();
      
      // Depois pull (baixar dados do Supabase)
      const pullResult = await forcePull();
      
      setStats(getOutboxStats());
      setPendingItems(getPendingOutboxItems());
      setFailedItems(getFailedOutboxItems());
      setLastSync(new Date().toISOString());
      localStorage.setItem('smart-tech-last-sync', new Date().toISOString());
      
      const totalSynced = pushResult.synced + pullResult.pulled;
      const totalErrors = pushResult.errors + pullResult.errors;
      
      if (totalErrors === 0) {
        showToast(`Sincronização completa: ${pushResult.synced} enviado(s), ${pullResult.pulled} baixado(s)`, 'success');
      } else {
        showToast(`Sincronização parcial: ${totalSynced} sucesso, ${totalErrors} erro(s)`, 'warning');
      }
    } catch (err: any) {
      showToast(`Erro ao sincronizar: ${err?.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearErrors = () => {
    if (confirm('Tem certeza que deseja limpar os erros? Isso permitirá tentar sincronizar novamente os itens que falharam.')) {
      const cleared = clearOutboxErrors();
      setStats(getOutboxStats());
      setFailedItems(getFailedOutboxItems());
      showToast(`${cleared} erro(s) limpo(s)`, 'success');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="sync-status-page">
      {/* Badge de Status Online/Offline no Topo */}
      <div className={`status-badge-top ${syncStatus.isOnline ? 'online' : 'offline'}`}>
        <span className="status-badge-icon">
          {syncStatus.isOnline ? '🟢' : '🔴'}
        </span>
        <span className="status-badge-text">
          {syncStatus.isOnline ? 'Online' : 'Offline'}
        </span>
        {syncStatus.isSyncing && (
          <span className="status-badge-syncing">⏳ Sincronizando...</span>
        )}
      </div>

      <div className="page-header">
        <h1>🔄 Status de Sincronização</h1>
        <p>Gerencie a sincronização entre LocalStorage e Supabase</p>
      </div>

      {/* Status Geral */}
      <div className="status-cards">
        <div className={`status-card ${syncStatus.isOnline ? 'online' : 'offline'} ${syncStatus.isOnline ? 'highlighted' : ''}`}>
          <div className="status-icon">
            {syncStatus.isOnline ? '🟢' : '🔴'}
          </div>
          <div className="status-info">
            <h3>{syncStatus.isOnline ? 'Online' : 'Offline'}</h3>
            <p>{syncStatus.isOnline ? 'Conectado ao Supabase - Sincronização ativa' : 'Modo offline - usando LocalStorage'}</p>
          </div>
          {syncStatus.isOnline && (
            <div className="status-badge-online">
              <span className="pulse-dot"></span>
              <span>Sincronizando automaticamente</span>
            </div>
          )}
        </div>

        <div className={`status-card ${syncStatus.isSyncing ? 'syncing' : ''}`}>
          <div className="status-icon">
            {syncStatus.isSyncing ? '⏳' : '✅'}
          </div>
          <div className="status-info">
            <h3>{syncStatus.isSyncing ? 'Sincronizando...' : 'Pronto'}</h3>
            <p>{syncStatus.isSyncing ? 'Processando itens pendentes' : 'Aguardando sincronização'}</p>
          </div>
        </div>

        <div className="status-card">
          <div className="status-icon">📊</div>
          <div className="status-info">
            <h3>{stats.pending} Pendente(s)</h3>
            <p>{stats.failed} com erro, {stats.synced} sincronizado(s)</p>
          </div>
        </div>
      </div>

      {/* Última Sincronização */}
      <div className="sync-info">
        <h3>📅 Última Sincronização</h3>
        <p>{formatDate(lastSync)}</p>
      </div>

      {conflicts.length > 0 && (
        <div className="failed-section">
          <h3>⚠️ Conflitos Recentes ({conflicts.length})</h3>
          <div className="items-list">
            {conflicts.slice(0, 10).map(item => (
              <div key={item.key} className="outbox-item error">
                <span className="item-operation">⚠️</span>
                <div className="item-info">
                  <strong>{item.table}</strong>
                  <span className="item-id">ID: {item.id.substring(0, 8)}...</span>
                  <span className="item-error">
                    Local pendente e remoto atualizado ao mesmo tempo. Mantida a versão local até a próxima sincronização.
                  </span>
                </div>
                <span className="item-retries">{formatDate(item.detectedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="sync-actions">
        <button
          className="btn-primary"
          onClick={handleForceSync}
          disabled={isSyncing || !syncStatus.isOnline}
        >
          {isSyncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Agora'}
        </button>
        {stats.failed > 0 && (
          <button
            className="btn-secondary"
            onClick={handleClearErrors}
          >
            🧹 Limpar Erros
          </button>
        )}
      </div>

      {/* Itens Pendentes */}
      {pendingItems.length > 0 && (
        <div className="pending-section">
          <h3>⏳ Itens Pendentes ({pendingItems.length})</h3>
          <div className="items-list">
            {pendingItems.slice(0, 10).map(item => (
              <div key={item.id} className="outbox-item">
                <span className="item-operation">{item.operation === 'upsert' ? '📝' : '🗑️'}</span>
                <div className="item-info">
                  <strong>{item.table}</strong>
                  <span className="item-id">ID: {item.clientGeneratedId.substring(0, 8)}...</span>
                </div>
                <span className="item-retries">Tentativas: {item.retries}/{5}</span>
              </div>
            ))}
            {pendingItems.length > 10 && (
              <p className="more-items">... e mais {pendingItems.length - 10} item(s)</p>
            )}
          </div>
        </div>
      )}

      {/* Itens com Erro */}
      {failedItems.length > 0 && (
        <div className="failed-section">
          <h3>❌ Itens com Erro ({failedItems.length})</h3>
          <div className="items-list">
            {failedItems.slice(0, 10).map(item => (
              <div key={item.id} className="outbox-item error">
                <span className="item-operation">{item.operation === 'upsert' ? '📝' : '🗑️'}</span>
                <div className="item-info">
                  <strong>{item.table}</strong>
                  <span className="item-id">ID: {item.clientGeneratedId.substring(0, 8)}...</span>
                  {item.lastError && (
                    <span className="item-error">Erro: {item.lastError.substring(0, 50)}...</span>
                  )}
                </div>
                <span className="item-retries">Tentativas: {item.retries}/5</span>
              </div>
            ))}
            {failedItems.length > 10 && (
              <p className="more-items">... e mais {failedItems.length - 10} item(s)</p>
            )}
          </div>
        </div>
      )}

      {/* Estatísticas Detalhadas */}
      <div className="stats-details">
        <h3>📊 Estatísticas</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total na Outbox:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pendentes:</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Com Erro:</span>
            <span className="stat-value error">{stats.failed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Sincronizados:</span>
            <span className="stat-value success">{stats.synced}</span>
          </div>
        </div>
      </div>

      {/* Informações */}
      <div className="sync-info-box">
        <h3>ℹ️ Como Funciona</h3>
        <ul>
          <li><strong>Offline-First:</strong> Todos os dados são salvos localmente primeiro</li>
          <li><strong>Sincronização Automática:</strong> Itens são sincronizados quando online</li>
          <li><strong>Outbox:</strong> Operações offline ficam na fila e são processadas quando possível</li>
          <li><strong>Retry:</strong> Itens com erro são tentados novamente automaticamente</li>
          <li><strong>Conflitos:</strong> Resolvidos usando "last-write-wins" (última modificação vence)</li>
        </ul>
      </div>
    </div>
  );
}

export default SyncStatusPage;
