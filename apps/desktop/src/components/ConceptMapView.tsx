// A concept map as a picture (#219): terms as boxes, links as arrows with their label. It is the visual view
// of a list the screen also shows as text, so it is one image with a text alternative; nothing in it is
// interactive. A link's tone says how it compared with the other map, by line style as well as colour:
// solid for a link both maps have, dashed for one only the author has, dotted for one only the learner drew.
// It holds no text of its own: terms and labels come from the caller, colours from tokens (styles.css).
import { useId } from 'react';
import { cx } from './logic';

export type ConceptMapNode = { term: string; x: number; y: number };
export type ConceptMapEdge = { from: string; to: string; label: string; tone?: 'matched' | 'missing' | 'extra' };
export type ConceptMapViewProps = {
  nodes: ConceptMapNode[];
  links: ConceptMapEdge[];
  /** The text alternative, e.g. "Your map: 3 links". The links themselves are listed as text by the caller. */
  label: string;
  width?: number;
  height?: number;
  className?: string;
};

/** A long term or label is cut in the picture; the list beside it has it in full. */
const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const NODE_W = 124;
const NODE_H = 30;

export function ConceptMapView({ nodes, links, label, width = 360, height = 260, className }: ConceptMapViewProps) {
  const arrow = useId();
  const at = new Map(nodes.map((n) => [n.term.toLowerCase(), n]));
  return (
    <svg
      className={cx('cmap-view', className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path className="cmap-view-arrow" d="M0 0 L10 5 L0 10 z" />
        </marker>
      </defs>
      <g aria-hidden="true">
        {links.map((l, i) => {
          const a = at.get(l.from.toLowerCase());
          const b = at.get(l.to.toLowerCase());
          if (!a || !b) return null;
          // The arrow stops at the edge of the target's box, not under it.
          const [dx, dy] = [b.x - a.x, b.y - a.y];
          const cut = Math.min(NODE_W / 2 / Math.abs(dx || 1e-9), NODE_H / 2 / Math.abs(dy || 1e-9), 0.45);
          const [x2, y2] = [b.x - dx * cut, b.y - dy * cut];
          return (
            <g key={i} className={cx('cmap-view-link', l.tone && `cmap-view-${l.tone}`)}>
              <line x1={a.x} y1={a.y} x2={x2} y2={y2} markerEnd={`url(#${arrow})`} />
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.term}>
            <rect
              className="cmap-view-node"
              x={n.x - NODE_W / 2}
              y={n.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={8}
            />
            <text className="cmap-view-term" x={n.x} y={n.y + 4} textAnchor="middle">
              {short(n.term, 18)}
            </text>
          </g>
        ))}
        {/* Labels last, so a box never hides one. */}
        {links.map((l, i) => {
          const a = at.get(l.from.toLowerCase());
          const b = at.get(l.to.toLowerCase());
          if (!a || !b || !l.label) return null;
          return (
            <text key={i} className="cmap-view-label" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 4} textAnchor="middle">
              {short(l.label, 22)}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
