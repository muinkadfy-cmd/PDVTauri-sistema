import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type VirtualListFixedProps<T> = {
  items: T[];
  /** Altura fixa do item (px). */
  itemHeight: number;
  /**
   * Altura do viewport do list (px). Se omitido, usa 520px.
   * Dica: calcule com base no viewport (window.innerHeight - offset).
   */
  height?: number;
  /** Espaço extra (itens) acima/abaixo do viewport para rolagem suave. */
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
};

/**
 * Lista virtualizada simples (fixed-height). Zero dependências.
 * Excelente para PC fraco e listas grandes.
 */
function VirtualListFixedInner<T>({
  items,
  itemHeight,
  height = 520,
  overscan = 6,
  className,
  renderItem,
}: VirtualListFixedProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    if (!viewportRef.current) return;
    // Throttle por RAF para evitar re-render excessivo
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(viewportRef.current ? viewportRef.current.scrollTop : 0);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const totalHeight = items.length * itemHeight;

  const range = useMemo(() => {
    const viewportHeight = Math.max(0, height);
    const start = Math.floor(scrollTop / itemHeight) - overscan;
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
    const from = Math.max(0, start);
    const to = Math.min(items.length, from + visibleCount);
    return { from, to };
  }, [scrollTop, itemHeight, items.length, height, overscan]);

  const visible = useMemo(() => items.slice(range.from, range.to), [items, range.from, range.to]);

  return (
    <div
      ref={viewportRef}
      className={className}
      style={{ height, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: range.from * itemHeight,
            left: 0,
            right: 0,
          }}
        >
          {visible.map((item, i) => {
            const index = range.from + i;
            return (
              <div key={index} style={{ height: itemHeight, overflow: 'visible' }}>
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Memo para reduzir re-render quando pai atualiza sem mudar props relevantes.
export const VirtualListFixed = memo(VirtualListFixedInner) as typeof VirtualListFixedInner;
