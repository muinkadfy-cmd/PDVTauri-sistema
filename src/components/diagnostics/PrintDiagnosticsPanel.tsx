import { useState } from 'react';
import { showToast } from '@/components/ui/ToastContainer';
import { diagLog } from '@/lib/telemetry/diag-log';
import { isDesktopApp } from '@/lib/platform';
import { openPrintPreviewTest, openPrintTest } from '@/services/print/receipt-service';

export default function PrintDiagnosticsPanel() {
  const [running, setRunning] = useState<string | null>(null);

  const runThermal = async (paperWidth: '58' | '80', label: string) => {
    setRunning(label);
    diagLog('info', `[print-test] iniciado ${label}`, { paperWidth });
    try {
      await openPrintTest({ paperWidth, label });
      showToast(`Teste ${label} enviado para impressão.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no teste de impressão.';
      diagLog('error', `[print-test] falhou ${label}`, { message, paperWidth });
      showToast('Não foi possível imprimir o teste. Veja o diagnóstico/logs.', 'error');
    } finally {
      setRunning(null);
    }
  };

  const runPreview = (paperWidth: '58' | '80', label: string) => {
    try {
      openPrintPreviewTest({ paperWidth, label });
      diagLog('info', `[print-preview] aberto ${label}`, { paperWidth });
      showToast(`Prévia ${label} aberta.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir prévia.';
      diagLog('error', `[print-preview] falhou ${label}`, { message, paperWidth });
      showToast('Não foi possível abrir a prévia de impressão.', 'error');
    }
  };

  return (
    <div className="print-diagnostics-panel">
      <div className="print-diagnostics-panel__head">
        <div>
          <h3>🧪 Diagnóstico de Impressão</h3>
          <p>Teste rápido para suporte: 58mm, 80mm, PDF/diálogo e motor desktop. Registra falhas no diagnóstico sem expor dados sensíveis.</p>
        </div>
        <span className="print-diagnostics-panel__badge">{isDesktopApp() ? 'Desktop' : 'Web/PDF'}</span>
      </div>

      <div className="print-diagnostics-panel__actions">
        <button type="button" className="btn-secondary" disabled={!!running} onClick={() => void runThermal('58', '58mm ESC/POS')}>
          {running === '58mm ESC/POS' ? 'Testando...' : 'Teste 58mm'}
        </button>
        <button type="button" className="btn-secondary" disabled={!!running} onClick={() => void runThermal('80', '80mm ESC/POS')}>
          {running === '80mm ESC/POS' ? 'Testando...' : 'Teste 80mm'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => runPreview('80', 'PDF/A4 fallback')}>
          Prévia PDF/A4
        </button>
        <button type="button" className="btn-secondary" onClick={() => runPreview('58', 'Fallback 58mm')}>
          Prévia 58mm
        </button>
      </div>

      <div className="print-diagnostics-panel__checklist">
        <span>Conferir no papel:</span>
        <strong>corte, acentuação, alinhamento, QR/logo, margem e largura correta.</strong>
      </div>
    </div>
  );
}
