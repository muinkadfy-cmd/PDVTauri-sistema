import { useMemo, useState } from 'react';
import { getDiagLogs, clearDiagLogs } from '@/lib/telemetry/diag-log';
import { isDesktopApp } from '@/lib/platform';

function formatTs(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function SupportPage() {
  const [tick, setTick] = useState(0);

  const snapshot = useMemo(() => {
    const logs = getDiagLogs().slice(-200).reverse();
    return {
      ts: new Date().toISOString(),
      mode: import.meta.env.MODE,
      desktop: isDesktopApp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      logs
    };
  }, [tick]);

  const reportText = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function refresh() {
    setTick((x) => x + 1);
  }

  function clear() {
    clearDiagLogs();
    refresh();
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Suporte / Diagnóstico</h1>
      <p style={{ opacity: 0.8, marginBottom: 12 }}>
        Use esta tela para copiar informações e logs recentes para o suporte (funciona offline).
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn" onClick={copy}>Copiar relatório</button>
        <button className="btn" onClick={refresh}>Atualizar</button>
        <button className="btn" onClick={clear}>Limpar logs</button>
        <button className="btn" onClick={() => history.back()}>Voltar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Resumo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', rowGap: 6, columnGap: 8, fontSize: 13 }}>
            <div>Timestamp</div><div>{snapshot.ts}</div>
            <div>Modo</div><div>{snapshot.mode}</div>
            <div>Desktop</div><div>{String(snapshot.desktop)}</div>
            <div>User Agent</div><div style={{ wordBreak: 'break-word' }}>{snapshot.userAgent}</div>
            <div>Logs no buffer</div><div>{snapshot.logs.length}</div>
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Logs recentes</h2>
          <div style={{ maxHeight: 420, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>
            {snapshot.logs.length === 0 ? (
              <div style={{ opacity: 0.8 }}>Sem logs ainda.</div>
            ) : (
              snapshot.logs.map((l, idx) => (
                <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ opacity: 0.7 }}>{formatTs(l.ts)}</span>
                    <span style={{ fontWeight: 700 }}>{l.level.toUpperCase()}</span>
                    <span style={{ wordBreak: 'break-word' }}>{l.message}</span>
                  </div>
                  {l.meta !== undefined ? (
                    <pre style={{ marginTop: 4, opacity: 0.8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.meta, null, 2)}</pre>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Relatório (JSON)</h2>
          <pre style={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            {reportText}
          </pre>
        </div>
      </div>
    </div>
  );
}
