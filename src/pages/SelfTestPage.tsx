import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { runSelfTest, type SelfTestResult, getLastSelfTest } from '@/lib/self-test';
import { downloadSupportPack } from '@/lib/support-pack';
import './SelfTestPage.css';

export default function SelfTestPage() {
  const [result, setResult] = useState<SelfTestResult | null>(() => getLastSelfTest());
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const summary = useMemo(() => {
    if (!result) return null;
    const ok = result.checks.filter(c => c.ok).length;
    const total = result.checks.length;
    return { ok, total };
  }, [result]);

  const run = () => {
    setRunning(true);
    try {
      const r = runSelfTest();
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  const exportSupport = async () => {
    setExporting(true);
    try {
      await downloadSupportPack();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="selftest-page">
      <div className="selftest-header">
        <div>
          <h1>Auto-teste do Sistema</h1>
          <p className="muted">
            Use esta tela quando o PC estiver lento, após atualização, ou para validar offline/backup.
          </p>
        </div>
        <div className="selftest-actions">
          <button className="btn" onClick={run} disabled={running}>
            {running ? 'Executando...' : 'Executar auto-teste'}
          </button>
          <button className="btn secondary" onClick={exportSupport} disabled={exporting}>
            {exporting ? 'Gerando...' : 'Baixar pacote de suporte'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Roteiro de teste (Passo 10)</h2>
        <ol className="steps">
          <li>Abra o app e aguarde o Painel.</li>
          <li>Entre em <b>Clientes</b> e digite na busca rapidamente (10–15s).</li>
          <li>Entre em <b>Produtos</b> e repita (busca + filtros).</li>
          <li>Abra <b>Vendas</b> e faça uma venda teste (sem internet, se possível).</li>
          <li>Abra <b>Ordens</b>, crie uma OS teste e imprima (A4 e/ou térmica).</li>
          <li>Vá em <b>Backup</b> e gere um backup.</li>
          <li>Volte aqui e clique em <b>Baixar pacote de suporte</b>.</li>
        </ol>
        <p className="muted">
          Dica: se o PC for fraco, ative o modo economia/baixo desempenho nas configurações (quando disponível).
        </p>
      </div>

      <div className="card">
        <h2>Resultado</h2>
        {!result ? (
          <p className="muted">Nenhum auto-teste executado ainda. Clique em “Executar auto-teste”.</p>
        ) : (
          <>
            <div className="summary">
              <div className={result.ok ? 'pill ok' : 'pill fail'}>
                {result.ok ? 'OK' : 'ATENÇÃO'}
              </div>
              <div className="muted">
                {summary?.ok}/{summary?.total} verificações passaram • {new Date(result.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="checks">
              {result.checks.map(c => (
                <div key={c.id} className={c.ok ? 'check ok' : 'check fail'}>
                  <div className="check-title">
                    <span className="dot" />
                    <b>{c.name}</b>
                  </div>
                  {c.details ? <div className="check-details">{c.details}</div> : null}
                </div>
              ))}
            </div>

            <details className="raw">
              <summary>Ver JSON (para suporte)</summary>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </details>
          </>
        )}
      </div>

      <div className="footer">
        <Link to="/ajuda">← Voltar para Ajuda</Link>
      </div>
    </div>
  );
}
