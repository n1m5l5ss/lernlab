// The graph of the card being asked (core/graph.ts, #210), or nothing for a card without one.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { graphOf, graphPoints, parseGraph, plotGraph } from '@lernlab/core/graph';
import type { Item } from '@lernlab/core/types';
import { GraphPlot } from './components';
import { formatNumber } from './i18n';

const tick = (n: number) => formatNumber(n, { maximumFractionDigits: 4 });

/** A graph line drawn; nothing when it does not read. */
export function GraphOf({ line, small = false }: { line: string; small?: boolean }) {
  const { t } = useTranslation();
  const graph = useMemo(() => parseGraph(line), [line]);
  const plot = useMemo(() => graph && (small ? plotGraph(graph, 260, 180) : plotGraph(graph)), [graph, small]);
  if (!graph || !plot) return null;
  // The text alternative: points read off the graph. The formula is often the answer, so it is never said.
  const points = graphPoints(graph)
    .map(([x, y]) => t('ex.graph.point', { x: tick(x), y: tick(y) }))
    .join(t('ex.graph.pointSeparator'));
  const label =
    graph.kind === 'points'
      ? t('ex.graph.altPoints', { points })
      : t('ex.graph.alt', { from: tick(graph.x[0]), to: tick(graph.x[1]), points });
  return (
    <div className="media">
      <GraphPlot plot={plot} label={label} formatTick={tick} />
    </div>
  );
}

export function GraphFor({ item, small }: { item?: Pick<Item, 'extra'> | null; small?: boolean }) {
  const line = item ? graphOf(item) : '';
  return line ? <GraphOf line={line} small={small} /> : null;
}
