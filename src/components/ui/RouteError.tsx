import React from 'react';
import { Link, useRouteError } from 'react-router-dom';
import './RouteError.css';

function IconRefresh(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 6h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L14 10h6V4l-2.35 2.35z"
      />
    </svg>
  );
}

function IconArrowLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M20 11H7.83l5.58-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
      />
    </svg>
  );
}

export default function RouteError() {
  const error = useRouteError() as any;
  const isDev = Boolean((import.meta as any)?.env?.DEV);

  const title =
    error?.status && typeof error.status === 'number'
      ? `Erro ${error.status}`
      : 'Ops… algo deu errado';

  const message =
    error?.statusText ||
    error?.message ||
    (typeof error === 'string' ? error : null) ||
    'Ocorreu um erro inesperado.';

  const details = isDev ? (typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)) : null;

  return (
    <div className="route-error">
      <div className="route-error__card">
        <div className="route-error__header">
          <div className="route-error__badge">Erro</div>
          <h1 className="route-error__title">{title}</h1>
          <p className="route-error__message">{message}</p>
        </div>

        <div className="route-error__actions">
          <button
            type="button"
            className="route-error__btn"
            onClick={() => window.history.back()}
          >
            <IconArrowLeft />
            Voltar
          </button>

          <button
            type="button"
            className="route-error__btn route-error__btn--primary"
            onClick={() => window.location.reload()}
          >
            <IconRefresh />
            Recarregar
          </button>

          <Link to="/painel" className="route-error__link">
            Ir para o Painel
          </Link>
        </div>

        {details ? (
          <details className="route-error__details">
            <summary>Detalhes técnicos (DEV)</summary>
            <pre>{details}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
