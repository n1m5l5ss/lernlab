import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../../../docs/design/tokens.json';
import { contrast, over } from './contrast';

type Colour = keyof typeof tokens.color.light;
type Pair = [fg: Colour, bg: Colour | `${Colour}@${number}`];

/** A translucent token tint over `base`, like `color-mix(in srgb, var(--color-x) N%, var(--color-base))`. */
const tint = (hex: string, alpha: number, base: string) =>
  over(`rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${alpha})`, base);

/** Text and its background: at least 4.5:1 (WCAG 1.4.3). `x@N` is token x at N% over the surface. */
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

for (const theme of ['light', 'dark'] as const) {
  const c = tokens.color[theme];
  const background = (bg: Pair[1]) => {
    const [name, pct] = bg.split('@') as [Colour, string | undefined];
    if (pct) return tint(c[name], Number(pct) / 100, c.surface);
    return c[name].startsWith('rgba') ? over(c[name], c.surface) : c[name];
  };
  const check = (pairs: Pair[], min: number, what: string) =>
    test(`${theme}: ${what} reach ${min}:1`, () => {
      const low = pairs
        .map(([fg, bg]) => ({ pair: `${fg} on ${bg}`, ratio: contrast(c[fg], background(bg)) }))
        .filter((p) => p.ratio < min)
        .map((p) => `${p.pair} is ${p.ratio.toFixed(2)}:1`);
      assert.deepEqual(low, []);
    });
  check(TEXT, 4.5, 'text pairs');
  check(LARGE_TEXT, 3, 'large text pairs');
  check(UI, 3, 'focus rings, control borders and answer outlines');
}

test('contrast matches the WCAG reference values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.equal(contrast('rgba(0,0,0,0.5)', '#FFFFFF').toFixed(2), contrast('#808080', '#FFFFFF').toFixed(2));
});
