// Numeric answers (math, physics, chemistry): a number with an optional tolerance and an optional unit.
// The rules are documented in docs/FORMAT.md ("Numeric cards").
import { unicodeSuperscripts } from './math';
import { stripHtml, type CheckResult } from './text';
import type { Item } from './types';

export type Tolerance = { abs: number } | { rel: number };
export type NumericAnswer = { value: number; tolerance: Tolerance | null; unit: string; text: string };

/** Unify minus signs, superscripts and digit-group spaces before reading a number. */
const tidy = (s: string) =>
  unicodeSuperscripts(s.normalize('NFC'))
    .replace(/[−–]/g, '-')
    .replace(/(\d)[ \u00a0\u2009\u202f_'](?=\d{3}(?!\d))/g, '$1') // 300 000, 1'000
    .trim();

const MANTISSA = /^[+-]?(?:\d[\d.,]*|[.,]\d+)/;
const EXPONENT = /^\s*(?:[eE]([+-]?\d+)|(?:[xX×*·⋅]|\\times|\\cdot)\s*10\s*(?:\^|\*\*)\s*\{?\s*([+-]?\d+)\s*\}?)/;

/** Which of `.` and `,` is the decimal mark: the last one when both appear; a lone comma is a decimal comma. */
function decimal(m: string): string {
  const dots = m.split('.').length - 1;
  const commas = m.split(',').length - 1;
  let s = m;
  if (dots && commas)
    s = m.lastIndexOf('.') > m.lastIndexOf(',') ? m.replace(/,/g, '') : m.replace(/\./g, '').replace(',', '.');
  else if (commas) s = commas === 1 ? m.replace(',', '.') : m.replace(/,/g, '');
  else if (dots > 1) s = m.replace(/\./g, '');
  return s;
}

/** A number at the start of `s` (9.81, 9,81, 6.02e23, 6.02 × 10^23, 10⁻³), and the text after it. */
export function parseNumber(s: string): { value: number; rest: string } | null {
  const t = tidy(s);
  const m = t.match(MANTISSA);
  if (!m) return null;
  const digits = decimal(m[0].replace(/[.,]$/, ''));
  let rest = t.slice(m[0].length);
  const e = rest.match(EXPONENT);
  if (e) rest = rest.slice(e[0].length);
  const value = Number(e ? `${digits}e${e[1] ?? e[2]}` : digits);
  return Number.isFinite(value) ? { value, rest: rest.trim() } : null;
}

/** "0.05" or "±0.05" (absolute, in the card's unit) or "2%" (relative). */
export function parseTolerance(s: string): Tolerance | null {
  const t = s.trim().replace(/^±|^\+\/-|^\+-/, '');
  const n = parseNumber(t);
  if (!n || n.value < 0) return null;
  if (n.rest === '%') return { rel: n.value / 100 };
  return n.rest ? null : { abs: n.value };
}

/** Write units one way: µ → u, ² → ^2, ** → ^, no spaces, any multiplication dot → *. */
export const normalizeUnit = (u: string) =>
  unicodeSuperscripts(u.normalize('NFC'))
    .replace(/[µμ]/g, 'u')
    .replace(/\*\*/g, '^')
    .replace(/\^\{([^{}]*)\}/g, '^$1')
    .replace(/\s*[·⋅*]\s*/g, '*')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '*')
    .trim();

/** A card's answer: "9.81", "9.81 m/s^2" or "9.81 ± 0.05 m/s^2". Null when it does not start with a number. */
export function parseQuantity(s: string): Omit<NumericAnswer, 'text'> | null {
  const n = parseNumber(s);
  if (!n) return null;
  let rest = n.rest;
  let tolerance: Tolerance | null = null;
  const pm = rest.match(/^(?:±|\+\/-|\+-)\s*([^\s%]+\s*%?)/);
  if (pm) {
    tolerance = parseTolerance(pm[1]);
    if (!tolerance) return null;
    rest = rest.slice(pm[0].length).trim();
  }
  const unit = normalizeUnit(rest);
  if (/^[\d.,]/.test(unit)) return null;
  if (unit && !/^[\p{L}°Ω%]/u.test(unit)) return null;
  return { value: n.value, tolerance, unit };
}

/** The numeric answer of a numeric card: the back, with the card's `tolerance` field when it has one. */
export function numericOf(item: Pick<Item, 'kind' | 'meaning' | 'extra'>): NumericAnswer | null {
  if (item.kind !== 'numeric') return null;
  const text = stripHtml(item.meaning);
  const q = parseQuantity(text);
  if (!q) return null;
  const own = item.extra?.tolerance ? parseTolerance(item.extra.tolerance) : null;
  return { ...q, tolerance: own ?? q.tolerance, text };
}

const PREFIX: Record<string, number> = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  da: 10,
  d: 0.1,
  c: 1e-2,
  m: 1e-3,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  '': 1,
};
const BASE = new Set(['m', 'g', 's', 'A', 'K', 'mol', 'cd', 'Hz', 'N', 'Pa', 'J', 'W', 'C', 'V', 'F', 'Ω', 'S']);
['T', 'H', 'L', 'l', 'eV', 'Wb', 'Bq', 'Gy', 'Sv', 'bar', 'B'].forEach((u) => BASE.add(u));

/** How many card units one `given` unit is (km → m: 1000), or null when they are not the same base unit. */
export function unitFactor(given: string, card: string): number | null {
  if (given === card) return 1;
  for (const [p, pf] of Object.entries(PREFIX))
    for (const [q, qf] of Object.entries(PREFIX)) {
      const base = given.slice(p.length);
      if (given.startsWith(p) && card.startsWith(q) && card.slice(q.length) === base && BASE.has(base)) return pf / qf;
    }
  return null;
}

/**
 * Check a typed number. Right when it is within the tolerance (exact, give or take float noise, without one).
 * The unit may be left out; a typed unit must be the card's unit or the same unit with another SI prefix.
 * No near misses: a number is right or wrong.
 */
export function checkNumeric(input: string, ans: NumericAnswer): CheckResult {
  const wrong = { correct: false, nearMiss: false, articleError: false, matched: ans.text };
  const n = parseNumber(input);
  if (!n) return wrong;
  let value = n.value;
  const unit = normalizeUnit(n.rest);
  if (unit && ans.unit) {
    const f = unitFactor(unit, ans.unit);
    if (f === null) return wrong;
    value *= f;
  }
  const t = ans.tolerance;
  const allowed =
    (t ? ('abs' in t ? t.abs : t.rel * Math.abs(ans.value)) : 0) + 1e-9 * Math.max(1, Math.abs(ans.value));
  return Math.abs(value - ans.value) <= allowed ? { ...wrong, correct: true } : wrong;
}
