import { memo, useMemo } from 'react';

export type BarDatum = {
  label: string;
  value: number;
};

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
  className?: string;
}

function MiniBarChart({ data, height = 180, className }: MiniBarChartProps) {
  const width = 560;
  const pad = 12;

  const max = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, Math.abs(d.value));
    return m || 1;
  }, [data]);

  const innerH = height - pad * 2;
  const innerW = width - pad * 2;
  const n = Math.max(1, data.length);
  const gap = 8;
  const barW = Math.max(12, (innerW - gap * (n - 1)) / n);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico de barras"
      preserveAspectRatio="none"
    >
      <g className="mini-chart-grid">
        {[0.25, 0.5, 0.75].map((t) => {
          const y = pad + t * innerH;
          return <line key={t} x1={pad} y1={y} x2={width - pad} y2={y} />;
        })}
      </g>

      <g className="mini-bar-bars">
        {data.map((d, i) => {
          const h = (Math.abs(d.value) / max) * innerH;
          const x = pad + i * (barW + gap);
          const y = pad + innerH - h;

          return (
            <g key={d.label} className={`mini-bar bar-${i}`}>
              <rect x={x} y={y} width={barW} height={h} rx={8} />
              <text
                x={x + barW / 2}
                y={height - 2}
                textAnchor="middle"
                className="mini-bar-label"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default memo(MiniBarChart);
