// A small graph on a card (#210): one curve or a line through points, with a light grid, axes and tick numbers.
// It draws the geometry core/graph.ts worked out from the card's graph line, as inline SVG: no markup from the
// card ever reaches the page. It holds no text of its own: the caller passes the text alternative from t()
// and a number formatter for the ticks. Colours come from tokens (styles.css).
import { useId } from 'react';
import type { Plot } from '@lernlab/core/graph';
import { cx } from './logic';

export type GraphPlotProps = {
  plot: Plot;
  /** The text alternative: what a learner could read off the graph, never its formula. */
  label: string;
  formatTick?: (n: number) => string;
  className?: string;
};

export function GraphPlot({ plot, label, formatTick = String, className }: GraphPlotProps) {
  const clip = useId();
  const { box } = plot;
  return (
    <svg
      className={cx('graph-plot', className)}
      viewBox={`0 0 ${plot.width} ${plot.height}`}
      width={plot.width}
      height={plot.height}
      role="img"
      aria-label={label}
    >
      <clipPath id={clip}>
        <rect x={box.left} y={box.top} width={box.right - box.left} height={box.bottom - box.top} />
      </clipPath>
      <rect
        className="graph-plot-box"
        x={box.left}
        y={box.top}
        width={box.right - box.left}
        height={box.bottom - box.top}
      />
      <g aria-hidden="true">
        {plot.xTicks.map((t) => (
          <g key={`x${t.value}`}>
            <line className="graph-plot-grid" x1={t.at} x2={t.at} y1={box.top} y2={box.bottom} />
            <text className="graph-plot-tick" x={t.at} y={box.bottom + 14} textAnchor="middle">
              {formatTick(t.value)}
            </text>
          </g>
        ))}
        {plot.yTicks.map((t) => (
          <g key={`y${t.value}`}>
            <line className="graph-plot-grid" x1={box.left} x2={box.right} y1={t.at} y2={t.at} />
            <text className="graph-plot-tick" x={box.left - 5} y={t.at + 4} textAnchor="end">
              {formatTick(t.value)}
            </text>
          </g>
        ))}
        {plot.xAxis !== null && (
          <line className="graph-plot-axis" x1={box.left} x2={box.right} y1={plot.xAxis} y2={plot.xAxis} />
        )}
        {plot.yAxis !== null && (
          <line className="graph-plot-axis" x1={plot.yAxis} x2={plot.yAxis} y1={box.top} y2={box.bottom} />
        )}
        <g clipPath={`url(#${clip})`}>
          {plot.paths.map((d, i) => (
            <path key={i} className="graph-plot-line" d={d} />
          ))}
          {plot.dots.map(([x, y], i) => (
            <circle key={i} className="graph-plot-dot" cx={x} cy={y} r={3.5} />
          ))}
        </g>
      </g>
    </svg>
  );
}
