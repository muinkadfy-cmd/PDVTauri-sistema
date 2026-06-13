import { useState, type ReactNode } from 'react';
import './InfoBanner.css';

type Variant = 'info' | 'warning' | 'success' | 'danger';

interface InfoBannerProps {
  variant?: Variant;
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export default function InfoBanner({
  variant = 'info',
  title,
  children,
  collapsible = true,
  defaultCollapsed = true,
  className
}: InfoBannerProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className={`st-infobanner st-infobanner--${variant} ${className || ''}`.trim()}>
      <div className="st-infobanner__header">
        <div className="st-infobanner__title">
          <span className="st-infobanner__dot" aria-hidden="true" />
          <span>{title || 'Informação'}</span>
        </div>

        {collapsible ? (
          <button
            type="button"
            className="st-infobanner__toggle"
            onClick={() => setCollapsed(v => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed ? 'Ver detalhes' : 'Ocultar'}
          </button>
        ) : null}
      </div>

      {!collapsible || !collapsed ? (
        <div className="st-infobanner__body">
          {children}
        </div>
      ) : null}
    </section>
  );
}
