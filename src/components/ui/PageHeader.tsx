import { type ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  kicker?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({ kicker, title, subtitle, actions, right, children }: PageHeaderProps) {
  return (
    <header className="st-page-header">
      <div className="st-page-header__top">
        <div className="st-page-header__titles">
          {kicker ? <div className="st-page-header__kicker">{kicker}</div> : null}
          <h1 className="st-page-header__title">{title}</h1>
          {subtitle ? <div className="st-page-header__subtitle">{subtitle}</div> : null}
        </div>

        <div className="st-page-header__right">
          {right ? <div className="st-page-header__rightslot">{right}</div> : null}
          {actions ? <div className="st-page-header__actions">{actions}</div> : null}
        </div>
      </div>

      {children ? <div className="st-page-header__bottom">{children}</div> : null}
    </header>
  );
}
