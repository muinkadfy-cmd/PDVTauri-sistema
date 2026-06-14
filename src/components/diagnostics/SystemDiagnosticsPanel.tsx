import { useEffect, useMemo, useState } from 'react';
import { showToast } from '@/components/ui/ToastContainer';
import { downloadSupportPack } from '@/lib/support-pack';
import {
  buildSystemDiagnosticsText,
  collectSystemDiagnostics,
  type SystemDiagnosticsSnapshot,
} from '@/lib/support/system-diagnostics';

function statusLabel(tone?: string) {
  if (tone === 'ok') return 'OK';
  if (tone === 'warn') return 'ATENÇÃO';
  if (tone === 'danger') return 'CRÍTICO';
  return 'INFO';
}

export default function SystemDiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState<SystemDiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setSnapshot(await collectSystemDiagnostics());
    } catch (error) {
      console.error('[Diagnostics] Falha ao carregar diagnóstico:', error);
      showToast('Não foi possível carregar o diagnóstico agora.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const copyText = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(buildSystemDiagnosticsText(snapshot));
      showToast('Diagnóstico copiado sem dados sensíveis.', 'success');
    } catch {
      showToast('Não foi possível copiar automaticamente.', 'warning');
    }
  };

  const summary = useMemo(() => {
    if (!snapshot) return [];
    return [
      { label: 'Runtime', value: snapshot.runtime === 'desktop' ? 'Desktop Tauri' : 'Web', tone: 'ok' },
      { label: 'Versão', value: snapshot.build.version, tone: 'info' },
      { label: 'Licença', value: snapshot.license.status, tone: snapshot.license.status === 'active' || snapshot.license.status === 'trial' ? 'ok' : 'warn' },
      { label: 'Banco', value: snapshot.persistence.dbStatus || snapshot.persistence.storage, tone: snapshot.persistence.status },
      { label: 'Impressão', value: snapshot.printer.paper, tone: snapshot.printer.printerName === 'Não selecionada' ? 'warn' : 'ok' },
      { label: 'PC lento', value: snapshot.support.lowEndMode ? 'Ativo' : 'Desativado', tone: snapshot.support.lowEndMode ? 'ok' : 'info' },
    ];
  }, [snapshot]);

  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-panel__head">
        <div>
          <h3>🧰 Diagnóstico do Sistema</h3>
          <p>Resumo seguro para suporte: não mostra token, senha, chave privada ou licença completa.</p>
        </div>
        <div className="diagnostics-panel__actions">
          <button type="button" className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button type="button" className="btn-secondary" onClick={copyText} disabled={!snapshot}>
            Copiar resumo
          </button>
          <button type="button" className="btn-secondary" onClick={() => void downloadSupportPack()}>
            Pacote de suporte
          </button>
        </div>
      </div>

      <div className="diagnostics-panel__grid">
        {summary.map((item) => (
          <div key={item.label} className={`diagnostics-panel__card tone-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value || '—'}</strong>
            <small>{statusLabel(item.tone)}</small>
          </div>
        ))}
      </div>

      {snapshot && (
        <>
          <div className="diagnostics-panel__safe-list">
            <div><span>STORE_ID</span><strong>{snapshot.identity.storeId}</strong></div>
            <div><span>DEVICE_ID</span><strong>{snapshot.identity.deviceIdMasked}</strong></div>
            <div><span>AppData</span><strong>{snapshot.persistence.appDataDir || '—'}</strong></div>
            <div><span>DB dir</span><strong>{snapshot.persistence.dbDir || '—'}</strong></div>
            <div><span>Impressora</span><strong>{snapshot.printer.printerName}</strong></div>
          </div>

          {snapshot.persistence.lastWarning && (
            <div className="diagnostics-panel__warning">
              {snapshot.persistence.lastWarning}
            </div>
          )}

          <button type="button" className="btn-secondary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos seguros'}
          </button>

          {expanded && (
            <pre className="diagnostics-panel__pre">{buildSystemDiagnosticsText(snapshot)}</pre>
          )}
        </>
      )}
    </div>
  );
}
