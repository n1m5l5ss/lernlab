// A small graph on a card (#210): one function of x, or a list of points joined by lines, drawn by LernLab
// itself, so a card can ask for the formula of a graph, or the graph of a formula. Several representations
// help only when learners practise translating between them [Ainsworth 2006]. The card carries one line of text, `y = x^2 - 1; x = -3..3` or
// `(0,1) (1,3) (2,5)`, in its extra field `graph` (no migration). Deck files are untrusted: the line is read
// by the small parser below (numbers, x, + - * / ^, brackets and a fixed list of functions; nothing is ever
// evaluated as code), it is capped in length, and what is kept holds only digits, letters and operators.
import type { Item } from './types';

/** A graph line is at most this long, and a point list has 2 to this many points. */
export const GRAPH_MAX_LENGTH = 300;
export const GRAPH_MAX_POINTS = 50;
/** Ranges and points stay within ±this. */
const LIMIT = 1e6;
const DEFAULT_X: Range = [-5, 5];
const SAMPLES = 120;

export type Range = [number, number];
export type Point = [number, number];
type Fn = (x: number) => number;
export type Graph =
  { kind: 'function'; expr: string; f: Fn; x: Range; y: Range | null } | { kind: 'points'; points: Point[] };

const FUNCTIONS: Record<string, Fn> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
/** Longest first, so "exp" is not read as e·x·p. */
const NAMES = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), 'x'].sort((a, b) => b.length - a.length);

type Token = { t: 'num'; v: number } | { t: 'name'; v: string } | { t: 'op'; v: string };

function tokens(expr: string): Token[] | null {
  const out: Token[] = [];
  for (let i = 0; i < expr.length;) {
    const ch = expr[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    const num = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(expr.slice(i, i + 40));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    if ('+-*/^()'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    const name = NAMES.find((n) => expr.startsWith(n, i));
    if (!name) return null;
    out.push({ t: 'name', v: name });
    i += name.length;
  }
  return out;
}

/**
 * Read an expression in x into a function. Recursive descent: sums of products of powers, unary minus,
 * implied multiplication (`2x`, `3(x+1)`), brackets, named functions with brackets. Null when it does not read.
 */
function compile(expr: string): Fn | null {
  const list = tokens(expr);
  if (!list?.length) return null;
  let pos = 0;
  const isOp = (v: string) => list[pos]?.t === 'op' && list[pos].v === v;
  class Bad extends Error {}

  function sum(): Fn {
    let left = product();
    while (isOp('+') || isOp('-')) {
      const minus = list![pos++].v === '-';
      const a = left;
      const b = product();
      left = minus ? (x) => a(x) - b(x) : (x) => a(x) + b(x);
    }
    return left;
  }
  function product(): Fn {
    let left = unary();
    for (;;) {
      const a = left;
      if (isOp('*') || isOp('/')) {
        const div = list![pos++].v === '/';
        const b = unary();
        left = div ? (x) => a(x) / b(x) : (x) => a(x) * b(x);
      } else if (pos < list!.length && (list![pos].t !== 'op' || isOp('('))) {
        const b = power(); // implied multiplication: 2x, x(x+1), 2 sin(x)
        left = (x) => a(x) * b(x);
      } else return left;
    }
  }
  function unary(): Fn {
    if (isOp('-')) {
      pos++;
      const a = unary();
      return (x) => -a(x);
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return power();
  }
  function power(): Fn {
    const a = atom();
    if (!isOp('^')) return a;
    pos++;
    const b = unary(); // right to left: 2^3^2 = 2^9, and 2^-x reads
    return (x) => Math.pow(a(x), b(x));
  }
  function bracket(): Fn {
    if (!isOp('(')) throw new Bad();
    pos++;
    const inner = sum();
    if (!isOp(')')) throw new Bad();
    pos++;
    return inner;
  }
  function atom(): Fn {
    const tok = list![pos];
    if (!tok) throw new Bad();
    if (tok.t === 'num') {
      pos++;
      return () => tok.v;
    }
    if (tok.t === 'name') {
      pos++;
      if (tok.v === 'x') return (x) => x;
      if (tok.v in CONSTANTS) return () => CONSTANTS[tok.v];
      const fn = FUNCTIONS[tok.v];
      const inner = bracket();
      return (x) => fn(inner(x));
    }
    return bracket();
  }

  try {
    const f = sum();
    return pos === list.length ? f : null;
  } catch (e) {
    if (e instanceof Bad) return null;
    throw e;
  }
}

/** A number of a range or point as it is written back: at most four decimals, never an exponent. */
const round = (n: number) => Number(n.toFixed(4)) + 0;
const NUM = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const POINT = new RegExp(`\\(\\s*(${NUM})\\s*[,;]\\s*(${NUM})\\s*\\)`, 'g');
const RANGE = new RegExp(`^([xy])=(${NUM})\\.\\.(${NUM})$`);

function readRange(a: string, b: string): Range | null {
  const r: Range = [round(Number(a)), round(Number(b))];
  return r[0] < r[1] && r[0] >= -LIMIT && r[1] <= LIMIT ? r : null;
}

/** Read a graph line. Null when it is empty, too long, does not read or has nothing to draw. */
export function parseGraph(line: string | undefined): Graph | null {
  if (!line || typeof line !== 'string' || line.length > GRAPH_MAX_LENGTH) return null;
  const text = line.toLowerCase().replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  // A point list: nothing but (x, y) pairs.
  if (text.startsWith('(') && !text.replace(POINT, '').replace(/[\s,;]/g, '')) {
    const points: Point[] = [];
    for (const m of text.matchAll(POINT)) {
      const p: Point = [round(Number(m[1])), round(Number(m[2]))];
      if (Math.abs(p[0]) > LIMIT || Math.abs(p[1]) > LIMIT) return null;
      points.push(p);
    }
    if (points.length >= 2 && points.length <= GRAPH_MAX_POINTS) return { kind: 'points', points };
    if (points.length !== 1) return null; // one pair may still be a product, like (x, …) never is
  }
  const [first, ...rest] = text.split(';').map((p) => p.trim());
  const expr = first.replace(/^(?:y|f ?\( ?x ?\)) ?= ?/, '');
  const f = compile(expr);
  if (!f) return null;
  let x: Range = DEFAULT_X;
  let y: Range | null = null;
  for (const part of rest) {
    if (!part) continue;
    const m = RANGE.exec(part.replace(/ /g, ''));
    const r = m && readRange(m[2], m[3]);
    if (!m || !r) return null;
    if (m[1] === 'x') x = r;
    else y = r;
  }
  const g: Graph = { kind: 'function', expr, f, x, y };
  return samples(g).filter((p) => p !== null).length >= 2 ? g : null;
}

/** The graph line in its one canonical form (it reads back to itself); '' when it does not read. */
export function cleanGraph(line: string | undefined): string {
  const g = parseGraph(line);
  if (!g) return '';
  if (g.kind === 'points') return g.points.map(([x, y]) => `(${x},${y})`).join(' ');
  const xr = g.x[0] === DEFAULT_X[0] && g.x[1] === DEFAULT_X[1] ? '' : `; x = ${g.x[0]}..${g.x[1]}`;
  return `y = ${g.expr}${xr}${g.y ? `; y = ${g.y[0]}..${g.y[1]}` : ''}`;
}

export const graphOf = (item: Pick<Item, 'extra'>): string => item.extra?.graph ?? '';
/** A card with a graph (cardToItem keeps the field only when it reads). */
export const hasGraph = (item: Pick<Item, 'extra'>): boolean => !!item.extra?.graph;

/** The function at evenly spaced x; null where it has no finite value. */
function samples(g: Extract<Graph, { kind: 'function' }>, n = SAMPLES): (Point | null)[] {
  const out: (Point | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const x = g.x[0] + ((g.x[1] - g.x[0]) * i) / n;
    const y = g.f(x);
    out.push(Number.isFinite(y) && Math.abs(y) <= 1e9 ? [x, y] : null);
  }
  return out;
}

/** A few points on the graph, rounded, for its text alternative: what a sighted learner could read off it. */
export function graphPoints(g: Graph, count = 5): Point[] {
  const r2 = (n: number) => Number(n.toFixed(2)) + 0;
  if (g.kind === 'points') return g.points.slice(0, count * 2).map(([x, y]) => [r2(x), r2(y)]);
  return samples(g, count - 1)
    .filter((p) => p !== null)
    .map(([x, y]) => [r2(x), r2(y)]);
}

/** Tick values at a round step (1, 2 or 5 times a power of ten), about five across the range. */
export function ticks([lo, hi]: Range): number[] {
  const raw = (hi - lo) / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const step = (frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10) * pow;
  const out: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9 && out.length < 12; k++)
    out.push(Number((k * step).toPrecision(10)) + 0);
  return out;
}

export type Plot = {
  width: number;
  height: number;
  /** The plot area inside the margins that hold the tick labels. */
  box: { left: number; top: number; right: number; bottom: number };
  /** SVG path data, one per unbroken piece of the curve. */
  paths: string[];
  /** The points of a point list, in pixels. */
  dots: Point[];
  xTicks: { at: number; value: number }[];
  yTicks: { at: number; value: number }[];
  /** Where the axes y = 0 and x = 0 run, in pixels; null when outside the range. */
  xAxis: number | null;
  yAxis: number | null;
  x: Range;
  y: Range;
};

/** A y range that shows the curve: all of it, or its middle when a pole would flatten the rest. */
function fitY(ys: number[]): Range {
  const sorted = [...ys].sort((a, b) => a - b);
  let lo = sorted[0];
  let hi = sorted[sorted.length - 1];
  const q = (p: number) => sorted[Math.round((sorted.length - 1) * p)];
  const mid = q(0.9) - q(0.1);
  if (mid > 0 && hi - lo > 5 * mid) {
    lo = Math.max(lo, q(0.1) - mid);
    hi = Math.min(hi, q(0.9) + mid);
  }
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  return [lo - pad, hi + pad];
}

/** The geometry of a graph drawn `width` × `height` pixels: paths, dots, ticks and axes. Pure numbers, no markup. */
export function plotGraph(g: Graph, width = 320, height = 220): Plot {
  const box = { left: 38, top: 8, right: width - 8, bottom: height - 22 };
  const pts = g.kind === 'function' ? samples(g) : g.points;
  const real = pts.filter((p) => p !== null);
  let x: Range;
  if (g.kind === 'function') x = g.x;
  else {
    const xs = real.map((p) => p[0]);
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    const pad = hi - lo < 1e-9 ? 1 : (hi - lo) * 0.06;
    x = [lo - pad, hi + pad];
  }
  const y = (g.kind === 'function' && g.y) || fitY(real.map((p) => p[1]));
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const px = (v: number) => r1(box.left + ((v - x[0]) / (x[1] - x[0])) * (box.right - box.left));
  const span = y[1] - y[0];
  // Far outside the range a value is drawn at the range's edge plus one height: the clip hides it.
  const py = (v: number) =>
    r1(box.bottom - ((Math.min(Math.max(v, y[0] - span), y[1] + span) - y[0]) / span) * (box.bottom - box.top));
  const paths: string[] = [];
  let piece: string[] = [];
  let last: Point | null = null;
  const end = () => {
    if (piece.length > 1) paths.push(piece.join(' '));
    piece = [];
    last = null;
  };
  for (const p of pts) {
    if (!p) {
      end();
      continue;
    }
    // A jump from below the range to above it (or back) is a pole, not a line.
    const prev = last as Point | null;
    if (prev && ((prev[1] < y[0] && p[1] > y[1]) || (prev[1] > y[1] && p[1] < y[0]))) end();
    piece.push(`${piece.length ? 'L' : 'M'}${px(p[0])} ${py(p[1])}`);
    last = p;
  }
  end();
  const inside = (v: number, [lo, hi]: Range) => v >= lo && v <= hi;
  return {
    width,
    height,
    box,
    paths,
    dots: g.kind === 'points' ? g.points.map(([a, b]) => [px(a), py(b)] as Point) : [],
    xTicks: ticks(x)
      .filter((v) => inside(v, x))
      .map((value) => ({ at: px(value), value })),
    yTicks: ticks(y)
      .filter((v) => inside(v, y))
      .map((value) => ({ at: py(value), value })),
    xAxis: inside(0, y) ? py(0) : null,
    yAxis: inside(0, x) ? px(0) : null,
    x,
    y,
  };
}
