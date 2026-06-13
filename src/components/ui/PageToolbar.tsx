import { type ReactNode } from 'react';
import './PageToolbar.css';

interface PageToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
}

/**
 * Toolbar compacta e consistente para páginas (busca, filtros e ações secundárias).
 * Suporta:
 * - Slots (left/right)
 * - Conteúdo adicional (children) em uma segunda linha
 *
 * ✅ Mantém compatibilidade: páginas que só usam children continuam funcionando.
 * ✅ Corrige caso comum: páginas que passam left/right + children (antes left/right eram ignorados).
 */
export default function PageToolbar({ left, right, children, sticky = true }: PageToolbarProps) {
  const hasSlots = Boolean(left || right);

  const className = [
    'st-page-toolbar',
    sticky ? 'st-page-toolbar--sticky' : '',
    hasSlots ? 'st-page-toolbar--slots' : '',
    hasSlots && children ? 'st-page-toolbar--stacked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      {hasSlots ? (
        <div className="st-page-toolbar__row st-page-toolbar__row--slots">
          {left ? <div className="st-page-toolbar__left">{left}</div> : null}
          {right ? <div className="st-page-toolbar__right">{right}</div> : null}
        </div>
      ) : null}

      {children ? (
        <div className="st-page-toolbar__row st-page-toolbar__row--content">{children}</div>
      ) : null}
    </div>
  );
}
