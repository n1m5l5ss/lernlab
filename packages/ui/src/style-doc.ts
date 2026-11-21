// Writes the generated parts of docs/design/style.md (the colour table and the measured contrast) from
// docs/design/tokens.json, so the page never guesses a value. `npm run tokens -w @lernlab/ui` runs it.
import tokens from '../../../docs/design/tokens.json';
import { PAIR_GROUPS, ratio, type Colour, type Pair } from './contrast-pairs';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** What each colour is for, in contributors' words. */
const USE: Record<Colour, string> = {
  bg: 'Window background',
  surface: 'Cards, panels, inputs',
  subtle: 'Quiet fills: chips, table headers, hover',
  border: 'Hairline dividers and card edges (decorative)',
  borderStrong: 'Form-control borders, unselected outlines',
  text: 'Body text and headings',
  textMuted: 'Secondary text, hints, captions',
  accent: 'Primary buttons, links, focus ring, current place',
  onAccent: 'Text and icons on `accent`',
  accentTint: 'Selected or current background',
  correct: 'Right-answer text, icon and outline',
  correctFill: 'Right-answer fills (tints, the large der/die/das button)',
  incorrect: 'Wrong-answer text, icon and outline',
  incorrectFill: 'Wrong-answer fills (tints, the large button)',
};

export function colourTable(): string {
  const rows = (Object.keys(tokens.color.light) as Colour[]).map(
    (k) =>
      `| \`${k}\` | \`--color-${kebab(k)}\` | \`${tokens.color.light[k]}\` | \`${tokens.color.dark[k]}\` | ${USE[k]} |`,
  );
  return ['| Token | CSS variable | Light | Dark | Used for |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}

const bgName = (bg: Pair[1]) => {
  const [name, pct] = bg.split('@');
  return pct ? `\`${name}\` ${pct}% over \`surface\`` : `\`${name}\``;
};

export function contrastTables(): string {
  return PAIR_GROUPS.map(({ what, min, pairs }) => {
    const rows = pairs.map((pair) => {
      const [light, dark] = (['light', 'dark'] as const).map((theme) => `${ratio(theme, pair).toFixed(2)}:1`);
      return `| \`${pair[0]}\` on ${bgName(pair[1])} | ${light} | ${dark} |`;
    });
    const lowest = Math.min(...pairs.flatMap((p) => [ratio('light', p), ratio('dark', p)]));
    return [
      `**${what[0].toUpperCase()}${what.slice(1)}**: at least ${min}:1. Lowest: ${lowest.toFixed(2)}:1.`,
      '',
      '| Pair | Light | Dark |',
      '| --- | --- | --- |',
      ...rows,
    ].join('\n');
  }).join('\n\n');
}

const SECTIONS: Record<string, () => string> = { colours: colourTable, contrast: contrastTables };

/** `doc` with every `<!-- generated:NAME -->` … `<!-- /generated:NAME -->` block filled in again. */
export function fillStyleDoc(doc: string): string {
  return doc.replace(
    /(<!-- generated:(\w+) -->)[\s\S]*?(<!-- \/generated:\2 -->)/g,
    (_all: string, open: string, name: string, close: string) => {
      const make = SECTIONS[name];
      if (!make) throw new Error(`Unknown generated section: ${name}`);
      return `${open}\n${make()}\n${close}`;
    },
  );
}
