/**
 * Serviço de Monitoramento e Error Tracking
 * 
 * Prepara integração com serviços como Sentry, LogRocket, etc.
 * Para ativar, configure as variáveis de ambiente e descomente o código relevante.
 */

import type { ErrorInfo } from 'react';

export interface ErrorContext {
  error: Error;
  errorInfo?: ErrorInfo;
  context?: Record<string, unknown>;
}

/**
 * Inicializa o serviço de monitoramento (Sentry, etc)
 * Chamado uma vez no início da aplicação
 */
export function initMonitoring(): void {
  if (!import.meta.env.PROD) {
    // Não inicializar em desenvolvimento
    return;
  }

  // Verificar se Sentry está habilitado
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (!sentryDsn) {
    return; // Sentry não configurado
  }

  // EXEMPLO: Inicialização do Sentry
  // Descomente quando tiver o Sentry instalado (npm install @sentry/react)
  /*
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 0.1, // 10% das transações
      replaysSessionSampleRate: 0.1, // 10% das sessões
      replaysOnErrorSampleRate: 1.0, // 100% quando há erro
      beforeSend(event, hint) {
        // Filtrar erros conhecidos/ignoráveis
        const error = hint.originalException;
        if (error && typeof error === 'object' && 'message' in error) {
          const msg = String(error.message).toLowerCase();
          if (msg.includes('resizeobserver') || msg.includes('network error')) {
            return null; // Não enviar
          }
        }
        return event;
      },
    });
  });
  */

  console.log('[Monitoring] Serviço de monitoramento pronto (Sentry DSN configurado)');
}

/**
 * Captura e envia erro para o serviço de monitoramento
 */
export function captureError(errorContext: ErrorContext): void {
  const { error, errorInfo, context } = errorContext;

  if (!import.meta.env.PROD) {
    // Em desenvolvimento, apenas log
    console.error('[Monitoring] Error captured:', { error, errorInfo, context });
    return;
  }

  // EXEMPLO: Envio para Sentry
  // Descomente quando tiver o Sentry instalado
  /*
  if (window.Sentry) {
    window.Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo?.componentStack,
        },
        extra: context,
      },
    });
  }
  */

  // Fallback: enviar para API própria (se houver)
  try {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    }).catch(() => {
      // Silenciar erro de network (não queremos loop infinito)
    });
  } catch {
    // Silenciar qualquer erro aqui
  }
}

/**
 * Captura exceção genérica (não React)
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  captureError({ error, context });
}

/**
 * Registra mensagem customizada
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!import.meta.env.PROD) {
    console.log(`[Monitoring] ${level.toUpperCase()}: ${message}`);
    return;
  }

  // EXEMPLO: Envio para Sentry
  /*
  if (window.Sentry) {
    window.Sentry.captureMessage(message, level);
  }
  */
}

/**
 * Define contexto do usuário (para rastreamento)
 */
export function setUserContext(user: { id?: string; email?: string; username?: string }): void {
  if (!import.meta.env.PROD) {
    return;
  }

  // EXEMPLO: Sentry
  /*
  if (window.Sentry) {
    window.Sentry.setUser(user.id ? { id: user.id, email: user.email, username: user.username } : null);
  }
  */
}

/**
 * Adiciona breadcrumb (rastro de eventos antes do erro)
 */
export function addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!import.meta.env.PROD) {
    return;
  }

  // EXEMPLO: Sentry
  /*
  if (window.Sentry) {
    window.Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now() / 1000,
    });
  }
  */
}

// Exportar tipo global para TypeScript (se usar Sentry)
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: unknown) => void;
      captureMessage: (message: string, level?: string) => void;
      setUser: (user: { id?: string; email?: string; username?: string } | null) => void;
      addBreadcrumb: (breadcrumb: unknown) => void;
    };
  }
}
