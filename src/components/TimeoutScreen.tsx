import { useCallback, useState } from 'react';

export function TimeoutScreen({
  title = 'Demorou mais que o esperado',
  message = 'Alguma operação levou tempo demais. Você pode tentar novamente.',
  details,
  onRetry,
}: {
  title?: string;
  message?: string;
  details?: string;
  onRetry: () => void;
}) {
  const [copyFeedback, setCopyFeedback] = useState('');

  const copy = useCallback(async () => {
    const text = details || `${title}\n\n${message}\n\nURL: ${window.location.href}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyFeedback('Detalhes copiados.');
    } catch {
      setCopyFeedback('Não foi possível copiar automaticamente. Abra os detalhes abaixo e copie manualmente.');
    }
  }, [details, title, message]);

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 560,
        width: '100%',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
      }}>
        <div style={{ fontSize: 34, lineHeight: 1 }}>⏱️</div>
        <h1 style={{ margin: '12px 0 6px', fontSize: 18 }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{message}</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={onRetry}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--primary)',
              color: 'var(--primary-contrast, #000)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Tentar novamente
          </button>

          <button
            onClick={copy}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
          >
            Copiar detalhes
          </button>
        </div>

        {copyFeedback ? (
          <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
            {copyFeedback}
          </div>
        ) : null}

        {details && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Detalhes</summary>
            <pre style={{
              marginTop: 10,
              padding: 12,
              overflow: 'auto',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              fontSize: 12,
              whiteSpace: 'pre-wrap'
            }}>{details}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
