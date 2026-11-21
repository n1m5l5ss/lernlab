// Math (LaTeX) in card text: where it is, and how a typed math answer is compared.
// Delimiters are Anki's: \( … \) inline, \[ … \] or $$ … $$ on its own line. A single $ is never math (prices).

const MATH = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;

export type MathPart = { text: string } | { tex: string; display: boolean };

/** Card text split into plain text and math parts, in order. */
export function splitMath(s: string): MathPart[] {
  const out: MathPart[] = [];
  let last = 0;
  for (const m of s.matchAll(MATH)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push(m[1] !== undefined ? { tex: m[1], display: false } : { tex: m[2] ?? m[3], display: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

export const hasMath = (s: string) => splitMath(s).some((p) => 'tex' in p);

/** Apply `f` to the text outside math only (so `*` or `/` inside a formula stays as written). */
export function outsideMath(s: string, f: (text: string) => string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(MATH)) {
    out += f(s.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + f(s.slice(last));
}

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
};
/** x² → x^2, 10⁻³ → 10^-3 (also used for units and numbers). */
export const unicodeSuperscripts = (s: string) =>
  s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => `^${[...m].map((c) => SUPERSCRIPT[c]).join('')}`);

/** Layout-only commands: they change spacing or size, never the value. */
const DROP = new Set(['\\left', '\\right', '\\displaystyle', '\\textstyle', '\\,', '\\;', '\\:', '\\!', '\\ ']);
DROP.add('\\quad').add('\\qquad');
const SAME: Record<string, string> = { '\\cdot': '*', '\\times': '*', '\\dfrac': '\\frac', '\\tfrac': '\\frac' };

/**
 * The comparison key for a typed math answer (rule documented in docs/FORMAT.md):
 * delimiters, spaces and layout-only commands are ignored, braces around a single symbol are optional
 * (x^{2} = x^2, \frac{1}{2} = \frac12), every multiplication sign is the same sign, and case matters.
 */
export function mathKey(s: string): string {
  const src = unicodeSuperscripts(
    splitMath(s)
      .map((p) => ('tex' in p ? p.tex : p.text))
      .join(' '),
  )
    .normalize('NFC')
    .replace(/[−–]/g, '-')
    .replace(/[·⋅×]/g, '*');
  let tokens = (src.match(/\\[a-zA-Z]+|\\.|\S/g) ?? []).map((t) => SAME[t] ?? t).filter((t) => !DROP.has(t));
  for (let changed = true; changed;) {
    changed = false;
    const next: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === '{' && tokens[i + 2] === '}' && !'{}'.includes(tokens[i + 1] ?? '{')) {
        next.push(tokens[i + 1]);
        i += 2;
        changed = true;
      } else next.push(tokens[i]);
    }
    tokens = next;
  }
  return tokens.join(' ');
}
