// The colour pairs the app draws, and their measured contrast in each theme. contrast.test.ts fails when
// one is too low; style-doc.ts writes the measured ratios into docs/design/style.md.
import tokens from '../../../docs/design/tokens.json';
import { contrast, over, tint } from './contrast';

export type Colour = keyof typeof tokens.color.light;
/** Foreground and background. `x@N` is token x at N% over the surface, like `color-mix(in srgb, var(--color-x) N%, var(--color-surface))`. */
export type Pair = [fg: Colour, bg: Colour | `${Colour}@${number}`];
export type PairGroup = { what: string; min: number; pairs: Pair[] };

/** Text and its background: at least 4.5:1 (WCAG 1.4.3). */
const TEXT: Pair[] = [
  ...(['text', 'textMuted', 'accent', 'correct', 'incorrect'] as const).flatMap((fg): Pair[] => [
    [fg, 'bg'],
    [fg, 'surface'],
    [fg, 'subtle'],
  ]),
  ['onAccent', 'accent'],
  ['text', 'accentTint'],
  ['accent', 'accentTint'],
  ['text', 'correctFill@12'], // a right answer's option
  ['text', 'incorrectFill@12'], // a wrong answer's option
  ['text', 'correctFill@20'], // "known" in the card list
];

/** Large bold text (the der/die/das and true/false buttons): at least 3:1 (WCAG 1.4.3). */
const LARGE_TEXT: Pair[] = [
  ['onAccent', 'accent'],
  ['onAccent', 'correctFill'],
  ['onAccent', 'incorrectFill'],
];

/** Focus rings, form-control borders and answer outlines against what they sit on: at least 3:1 (WCAG 1.4.11). */
const UI: Pair[] = (['accent', 'borderStrong', 'correct', 'incorrect'] as const).flatMap((fg): Pair[] => [
  [fg, 'bg'],
  [fg, 'surface'],
  [fg, 'subtle'],
]);

export const PAIR_GROUPS: PairGroup[] = [
  { what: 'text pairs', min: 4.5, pairs: TEXT },
  { what: 'large text pairs', min: 3, pairs: LARGE_TEXT },
  { what: 'focus rings, control borders and answer outlines', min: 3, pairs: UI },
];

export type ThemeName = keyof typeof tokens.color;

/** The opaque colour a pair's background resolves to in `theme`. */
export function background(theme: ThemeName, bg: Pair[1]): string {
  const c = tokens.color[theme];
  const [name, pct] = bg.split('@') as [Colour, string | undefined];
  if (pct) return tint(c[name], Number(pct) / 100, c.surface);
  return c[name].startsWith('rgba') ? over(c[name], c.surface) : c[name];
}

/** The contrast ratio of one pair in `theme`. */
export const ratio = (theme: ThemeName, [fg, bg]: Pair) => contrast(tokens.color[theme][fg], background(theme, bg));
