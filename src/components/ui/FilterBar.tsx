import { useMemo, useState, type ReactNode } from 'react';
import './FilterBar.css';

interface FilterBarProps {
  title?: string;
  defaultCollapsed?: boolean;
  summary?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}

export default function FilterBar({
  title = 'Filtros',
  defaultCollapsed = true,
  summary,
  right,
  children
}: FilterBarProps) {
  const [open, setOpen] = useState(!defaultCollapsed);

  const ariaLabel = useMemo(() => (open ? 'Recolher filtros' : 'Expandir filtros'), [open]);

  return (
    <section className="st-filterbar">
      <div className="st-filterbar__head">
        <button
          type="button"
          className="st-filterbar__toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <span className="st-filterbar__chev" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="st-filterbar__title">{title}</span>
          {!open && summary ? <span className="st-filterbar__summary">{summary}</span> : null}
        </button>

        <div className="st-filterbar__right">{right}</div>
      </div>

      {open ? <div className="st-filterbar__body">{children}</div> : null}
    </section>
  );
}
