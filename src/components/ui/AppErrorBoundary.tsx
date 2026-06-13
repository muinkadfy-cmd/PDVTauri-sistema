import React from 'react';

async function clearBrowserCaches() {
  if (typeof window === 'undefined' || typeof caches === 'undefined' || typeof caches.keys !== 'function') {
    return;
  }
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

type Props = {
  children: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  message?: string;
};

/**
 * Error boundary de produção.
 * Evita “tela branca” e oferece ação de recarregar/limpar cache (PWA).
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = (error as any)?.message ? String((error as any).message) : String(error);
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: unknown) {
    // Log para diagnóstico (não exibir detalhes sensíveis)
        console.error('[AppErrorBoundary]', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '320px',
          padding: 16,
          color: 'var(--text-secondary)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 18 }}>
          {this.props.title || 'Ocorreu um erro'}
        </div>
        <div style={{ maxWidth: 760, opacity: 0.9 }}>
          A aplicação encontrou um erro ao renderizar esta tela. Você pode recarregar a página. Se estiver usando PWA,
          pode ser cache antigo.
        </div>

        {import.meta.env.DEV && this.state.message ? (
          <div
            style={{
              maxWidth: 820,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
              opacity: 0.75,
              wordBreak: 'break-word',
            }}
          >
            {this.state.message}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
          <button
            type="button"
            onClick={() => {
              void clearBrowserCaches()
                .catch(() => undefined)
                .finally(() => window.location.reload());
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Limpar cache e recarregar
          </button>
        </div>
      </div>
    );
  }
}
