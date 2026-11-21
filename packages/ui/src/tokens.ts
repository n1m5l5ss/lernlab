// Turns docs/design/tokens.json into CSS variables. Screens use only these variables, never raw colours.
import tokens from '../../../docs/design/tokens.json';

export type Tokens = typeof tokens;
export type Theme = 'system' | 'light' | 'dark';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const block = (selector: string, vars: [string, string | number][], indent = '') =>
  `${indent}${selector} {\n${vars.map(([k, v]) => `${indent}  --${k}: ${v};`).join('\n')}\n${indent}}`;

const colours = (palette: Record<string, string>): [string, string][] =>
  Object.entries(palette).map(([k, v]) => [`color-${kebab(k)}`, v]);

/** The CSS for every token. Light is the default; dark applies when chosen, or when the system is dark and nothing else is chosen. */
export function tokensToCss(t: Tokens = tokens): string {
  const px = (n: number) => `${n}px`;
  const shared: [string, string | number][] = [
    ['font-ui', t.font.ui],
    ['font-reading', t.font.reading],
    ['font-mono', t.font.mono],
    // Text sizes follow the Text size setting through --text-scale (spacing and layout stay put).
    ['text-scale', t.textSize.normal],
    ...Object.entries(t.typeScale).map(([k, v]): [string, string] => [
      `text-${kebab(k)}`,
      `calc(${px(v)} * var(--text-scale))`,
    ]),
    ...Object.entries(t.lineHeight).map(([k, v]): [string, number] => [`line-${kebab(k)}`, v]),
    ...t.space.map((v, i): [string, string] => [`space-${i + 1}`, px(v)]),
    ...Object.entries(t.radius).map(([k, v]): [string, string] => [`radius-${kebab(k)}`, px(v)]),
    ...Object.entries(t.size).map(([k, v]): [string, string] => [`size-${kebab(k)}`, px(v)]),
    ...Object.entries(t.motion).map(([k, v]): [string, string] => [
      `motion-${kebab(k)}`,
      typeof v === 'number' ? `${v}ms` : v,
    ]),
  ];
  const dark = colours(t.color.dark);
  const reducedMotion = Object.entries(t.motionReduced).map(([k, v]): [string, string] => [
    `motion-${kebab(k)}`,
    `${v}ms`,
  ]);
  return [
    '/* Generated from docs/design/tokens.json by `npm run tokens -w @lernlab/ui`. Do not edit by hand. */',
    block(':root', [...colours(t.color.light), ...shared]).replace(/\n}$/, '\n  color-scheme: light;\n}'),
    `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme='light'])", dark, '  ').replace(/\n {2}}$/, '\n    color-scheme: dark;\n  }')}\n}`,
    block(":root[data-theme='dark']", dark).replace(/\n}$/, '\n  color-scheme: dark;\n}'),
    ...Object.entries(t.textSize)
      .filter(([k]) => k !== 'normal')
      .map(([k, v]) => block(`:root[data-text-size='${k}']`, [['text-scale', v]])),
    // Reduced motion, from the computer or the app setting: movement becomes an instant change; fades stay short.
    `@media (prefers-reduced-motion: reduce) {\n${block(':root', reducedMotion, '  ')}\n}`,
    block(":root[data-motion='reduce']", reducedMotion),
    '',
  ].join('\n\n');
}

/** The window background before any CSS loads, so there is no flash of the wrong theme. */
export const windowBackground = (dark: boolean) => (dark ? tokens.color.dark.bg : tokens.color.light.bg);
