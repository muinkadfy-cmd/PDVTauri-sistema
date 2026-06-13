import { useState, useEffect } from 'react';
import { getSyncStatus } from '@/lib/repository/sync-engine';
import { getOutboxStats } from '@/lib/repository/outbox';
import { forceSync } from '@/lib/repository';
import { showToast } from '@/components/ui/ToastContainer';
import { logger } from '@/utils/logger';
import { APP_EVENTS } from '@/lib/app-events';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import './SyncStatusBar.css';

const SYNC_CONFLICTS_STORAGE_KEY = 'smart-tech:sync-conflicts';

function getStoredConflictCount(): number {
  try {
    const raw = window.localStorage.getItem(SYNC_CONFLICTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown[] : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function SyncStatusBar() {
  const [isOnline, setIsOnline] = useState(isBrowserOnlineSafe());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Atualizar status de sincronização (event-driven, sem polling agressivo)
  useEffect(() => {
    const updatePending = () => setPendingCount(getOutboxStats().pending);

    const applySyncDetail = (detail: any) => {
      if (!detail) return;
      if (typeof detail.isOnline === 'boolean') setIsOnline(detail.isOnline);
      if (typeof detail.isSyncing === 'boolean') setIsSyncing(detail.isSyncing);

      const lastOk = detail.lastPullOkAt;
      if (typeof lastOk === 'number' && lastOk > 0) {
        try {
          const d = new Date(lastOk);
          setLastSyncTime(
            d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
        } catch {
          setLastSyncTime(null);
        }
      }
    };

    // Estado inicial
    try {
      const s = getSyncStatus();
      setIsOnline(s.isOnline);
      setIsSyncing(s.isSyncing);
    } catch {
      // ignore
    }
    updatePending();
    setConflictCount(getStoredConflictCount());

    const onSyncStatusChanged = (e: any) => applySyncDetail(e?.detail);
    const onOutboxChanged = () => updatePending();
    const onSyncConflict = (e: any) => {
      setConflictCount(getStoredConflictCount());
      const detail = e?.detail;
      const table = detail?.table || 'registro';
      showToast(`Conflito detectado em ${table}. Mantive a versão local pendente e o remoto será revisado na próxima sincronização.`, 'warning', 6500);
    };
    const onNetworkChange = () => {
      try {
        const s = getSyncStatus();
        setIsOnline(s.isOnline);
        setIsSyncing(s.isSyncing);
      } catch {
        // ignore
      }
    };

    window.addEventListener(APP_EVENTS.SYNC_STATUS_CHANGED, onSyncStatusChanged as any);
    window.addEventListener(APP_EVENTS.OUTBOX_CHANGED, onOutboxChanged as any);
    window.addEventListener(APP_EVENTS.SYNC_CONFLICT_DETECTED, onSyncConflict as any);
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);

    // Relógio: atualiza de 30 em 30s e só quando a aba estiver visível
    const tick = () => setCurrentTime(new Date());
    tick();
    const clockInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, 30000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        onNetworkChange();
        updatePending();
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener(APP_EVENTS.SYNC_STATUS_CHANGED, onSyncStatusChanged as any);
      window.removeEventListener(APP_EVENTS.OUTBOX_CHANGED, onOutboxChanged as any);
      window.removeEventListener(APP_EVENTS.SYNC_CONFLICT_DETECTED, onSyncConflict as any);
      window.removeEventListener('online', onNetworkChange);
      window.removeEventListener('offline', onNetworkChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(clockInterval);
    };
  }, []);

  const handleSyncNow = async () => {
    if (isSyncing || !isOnline) {
      return;
    }
    
    setIsSyncing(true);
    showToast('Sincronizando...', 'info');
    
    try {
      const result = await forceSync();
      if (result.errors === 0) {
        showToast(`Sincronização concluída! ${result.synced} itens sincronizados.`, 'success');
      } else {
        showToast(`Sincronização concluída com ${result.errors} erro(s).`, 'warning');
      }
    } catch (error) {
      logger.error('[SyncStatusBar] Erro ao sincronizar:', error);
      showToast('Erro ao sincronizar. Tente novamente.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="sync-status-bar">
      <div className="sync-status-content">
        <div className={`sync-status-badge ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isOnline ? 'Online' : 'Modo Offline (LocalStorage)'}
          </span>
        </div>

        {pendingCount > 0 && (
          <div className="sync-pending-badge">
            <span className="pending-icon">⏳</span>
            <span className="pending-count">{pendingCount}</span>
            <span className="pending-text">pendente{pendingCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {conflictCount > 0 && (
          <div className="sync-pending-badge" title="Conflitos recentes detectados durante a sincronização">
            <span className="pending-icon">⚠️</span>
            <span className="pending-count">{conflictCount}</span>
            <span className="pending-text">conflito{conflictCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {lastSyncTime && (
          <div className="sync-last-time">
            <span className="last-sync-label">Última Sync:</span>
            <span className="last-sync-value">{lastSyncTime}</span>
          </div>
        )}

        {isSyncing && (
          <div className="sync-indicator">
            <span className="sync-icon spinning">🔄</span>
            <span className="sync-indicator-text">Sincronizando...</span>
          </div>
        )}

        {isOnline && !isSyncing && (
          <button
            className="sync-now-button"
            onClick={handleSyncNow}
            aria-label="Sincronizar agora"
            title="Sincronizar agora"
          >
            <span className="sync-now-icon">🔄</span>
            <span className="sync-now-text">Sincronizar</span>
          </button>
        )}

        <div className="sync-time-display">
          <span className="time-label">Horário:</span>
          <span className="time-value">{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  );
}

export default SyncStatusBar;
