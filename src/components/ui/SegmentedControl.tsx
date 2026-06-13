import { type ReactNode, useId, useMemo, type KeyboardEvent } from 'react';
import './SegmentedControl.css';

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  title?: string;
  disabled?: boolean;
};

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * SegmentedControl (pílulas premium / estilo SaaS)
 * - Acessível (radiogroup)
 * - Teclado: setas / Home / End
 */
export default function SegmentedControl({
  value,
  onChange,
  options,
  ariaLabel = 'Selecionar filtro',
  className = '',
  size = 'md'
}: SegmentedControlProps) {
  const id = useId();

  const enabledOptions = useMemo(() => options.filter((o) => !o.disabled), [options]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = enabledOptions.findIndex((o) => o.value === value);
    if (currentIdx < 0) return;

    const go = (idx: number) => {
      const opt = enabledOptions[idx];
      if (opt) onChange(opt.value);
    };

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go((currentIdx + 1) % enabledOptions.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go((currentIdx - 1 + enabledOptions.length) % enabledOptions.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(enabledOptions.length - 1);
    }
  };

  return (
    <div
      className={`st-segmented st-segmented--${size} ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const btnId = `${id}-${opt.value}`;
        return (
          <button
            key={opt.value}
            id={btnId}
            type="button"
            className={`st-segmented__btn ${active ? 'st-segmented__btn--active' : ''}`.trim()}
            role="radio"
            aria-checked={active}
            aria-disabled={opt.disabled ? 'true' : 'false'}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
