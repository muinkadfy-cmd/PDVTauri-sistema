/**
 * PageSkeleton – Loading state padrão de produto comercial (SaaS)
 *
 * Usado como fallback do Suspense em rotas lazy. Oferece:
 * - Percepção de carregamento mais rápida (estrutura visível em vez de spinner)
 * - Consistência visual com o design system (skeleton.css)
 * - Acessibilidade (aria-busy, role, label)
 * - Suporte a tema claro/escuro via data-theme
 */
import React from 'react';

export interface PageSkeletonProps {
  /** Variante: 'dashboard' (cards + linhas) | 'list' (lista) | 'form' (título + inputs) */
  variant?: 'dashboard' | 'list' | 'form';
  /** Número de cards (dashboard) ou linhas (list) */
  lines?: number;
  className?: string;
}

const DEFAULT_LINES = {
  dashboard: 3,
  list: 5,
  form: 4,
};

export function PageSkeleton({
  variant = 'dashboard',
  lines = DEFAULT_LINES[variant],
  className = '',
}: PageSkeletonProps) {
  const lineCount = Math.min(Math.max(lines, 1), 8);

  return (
    <div
      className={`page-skeleton page-skeleton--${variant} ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label="Carregando página"
    >
      <div className="page-skeleton__inner">
        <div className="skeleton skeleton-title page-skeleton__title" aria-hidden />

        {variant === 'dashboard' && (
          <>
            <div className="page-skeleton__cards">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-card page-skeleton__card">
                  <div className="skeleton skeleton-stat-icon" aria-hidden />
                  <div className="skeleton skeleton-stat-value" aria-hidden />
                  <div className="skeleton skeleton-stat-label" aria-hidden />
                </div>
              ))}
            </div>
            <div className="skeleton-lines page-skeleton__lines">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="skeleton skeleton-line" aria-hidden />
              ))}
            </div>
          </>
        )}

        {variant === 'list' && (
          <div className="page-skeleton__list">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="skeleton-list-item">
                <div className="skeleton skeleton-avatar skeleton-avatar-sm" aria-hidden />
                <div className="skeleton-lines" style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text" aria-hidden />
                  <div className="skeleton skeleton-text skeleton-text-sm" aria-hidden />
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === 'form' && (
          <div className="page-skeleton__form">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="skeleton skeleton-input" aria-hidden />
            ))}
            <div className="page-skeleton__actions">
              <div className="skeleton skeleton-button" aria-hidden />
              <div className="skeleton skeleton-button skeleton-button-sm" aria-hidden />
            </div>
          </div>
        )}
      </div>
      <span className="sr-only">Conteúdo está carregando.</span>
    </div>
  );
}

export default PageSkeleton;
