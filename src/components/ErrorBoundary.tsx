/**
 * Error Boundary Global
 * Captura erros de renderização e exibe tela amigável
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureError } from '@/lib/monitoring';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log do erro
    console.error('[ErrorBoundary] Erro capturado:', error);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component Stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo
    });

    // Registrar erro da rota atual para diagnóstico
    try {
      const currentPath = window.location.pathname;
      const errorLog = localStorage.getItem('route-errors');
      const errors = errorLog ? JSON.parse(errorLog) : {};
      
      errors[currentPath] = {
        timestamp: Date.now(),
        count: (errors[currentPath]?.count || 0) + 1,
        message: error.message
      };
      
      localStorage.setItem('route-errors', JSON.stringify(errors));
    } catch {
      // Silenciar erro de localStorage
    }

    // Enviar para serviço de monitoramento (Sentry, LogRocket, etc)
    captureError({
      error,
      errorInfo,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDetails = () => {
    const details = this.getErrorDetails();
    if (!navigator.clipboard?.writeText) {
      alert('Erro ao copiar. Detalhes:\n\n' + details);
      return;
    }
    navigator.clipboard.writeText(details).then(() => {
      alert('Detalhes copiados para a área de transferência!');
    }).catch(() => {
      alert('Erro ao copiar. Detalhes:\n\n' + details);
    });
  };

  getErrorDetails(): string {
    const { error, errorInfo } = this.state;
    const details = [
      '=== ERRO NO SISTEMA SMART TECH ===',
      '',
      `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      '',
      '--- Erro ---',
      error?.name || 'Unknown',
      error?.message || 'Sem mensagem',
      '',
      '--- Stack Trace ---',
      error?.stack || 'Sem stack trace',
      ''
    ];

    if (errorInfo) {
      details.push('--- Component Stack ---');
      details.push(errorInfo.componentStack || 'Sem component stack');
    }

    return details.join('\n');
  }

  
private buildReport() {
  try {
    const { error, errorInfo } = this.state;
    const payload = {
      ts: new Date().toISOString(),
      message: error?.message || 'unknown',
      stack: error?.stack || null,
      componentStack: errorInfo?.componentStack || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      mode: import.meta.env.MODE
    };
    return JSON.stringify(payload, null, 2);
  } catch {
    return 'Falha ao montar relatório.';
  }
}

private copyReport = async () => {
  const report = this.buildReport();
  try {
    await navigator.clipboard.writeText(report);
  } catch {
    // fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // ignore
    }
  }
};

private goSupport = () => {
  try {
    window.location.href = '/suporte';
  } catch {
    // ignore
  }
};

render() {
    if (this.state.hasError) {
      const { error } = this.state;
      
      return (
        <div className="error-boundary">
          <div className="error-boundary-container">
            <div className="error-boundary-icon">⚠️</div>
            <h1 className="error-boundary-title">Ops! Algo deu errado</h1>
            <p className="error-boundary-message">
              Ocorreu um erro inesperado no sistema. Por favor, recarregue a página ou entre em contato com o suporte.
            </p>
            
            {import.meta.env.DEV && error && (
              <div className="error-boundary-details">
                <details>
                  <summary>Detalhes do erro (DEV)</summary>
                  <div className="error-boundary-error">
                    <strong>{error.name}:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <pre className="error-boundary-stack">{error.stack}</pre>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <pre className="error-boundary-stack">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              </div>
            )}

            <div className="error-boundary-actions">
              <button 
                className="error-boundary-btn error-boundary-btn-primary"
                onClick={this.handleReload}
              >
                🔄 Recarregar Página
              </button>
              <button 
                className="error-boundary-btn error-boundary-btn-secondary"
                onClick={this.handleCopyDetails}
              >
                📋 Copiar Detalhes
              </button>
            </div>

            <div className="error-boundary-help">
              <p>
                Se o problema persistir, entre em contato com o suporte técnico e forneça os detalhes do erro.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
