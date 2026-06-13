import { memo, useMemo } from 'react';

export type LineSeries = {
  name: string;
  values: number[];
};

interface MiniLineChartProps {
  series: LineSeries[];
  height?: number;
  className?: string;
}

function buildPath(values: number[], width: number, height: number, pad: number, min: number, max: number) {
  const n = values.length;
  if (n === 0) return '';

  const span = Math.max(1e-9, max - min);
  const xStep = (width - pad * 2) / Math.max(1, n - 1);

  return values
    .map((v, i) => {
      const x = pad + i * xStep;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function MiniLineChart({ series, height = 180, className }: MiniLineChartProps) {
  const width = 560;
  const pad = 12;

  const { min, max } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      for (const v of s.values) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    if (lo === hi) {
      hi = lo + 1;
    }
    return { min: lo, max: hi };
  }, [series]);

  const paths = useMemo(() => {
    return series.map((s) => buildPath(s.values, width, height, pad, min, max));
  }, [series, height, min, max]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico de linhas"
      preserveAspectRatio="none"
    >
      {/* grid */}
      <g className="mini-chart-grid">
        {[0.2, 0.4, 0.6, 0.8].map((t) => {
          const y = pad + t * (height - pad * 2);
          return <line key={t} x1={pad} y1={y} x2={width - pad} y2={y} />;
        })}
      </g>

      {/* lines */}
      <g className="mini-chart-lines">
        {paths.map((d, idx) => (
          <path key={idx} d={d} className={`mini-chart-line line-${idx}`} />
        ))}
      </g>
    </svg>
  );
}

export default memo(MiniLineChart);
