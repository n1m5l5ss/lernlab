// No raw colours in stylesheets (docs/TESTING.md, "A new button must not break other buttons"): every
// colour is a design token from tokens.css, so a theme change reaches every screen and the contrast test
// covers it. TypeScript has the same rule in eslint.config.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCAN = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', 'storybook-static', 'e2e-results', 'release']);
/** Generated from docs/design/tokens.json: the one place colours are written down. */
const GENERATED = new Set(['packages/ui/tokens.css']);

/**
 * Raw colours left in the v0.2 game styles (issue #16 leftovers), each to become a token when its game
 * is restyled. This list only shrinks.
 */
const ALLOWED: { file: string; text: string }[] = [
  { file: 'apps/desktop/src/styles.css', text: 'linear-gradient(90deg, #2ec27e, #9be15d)' }, // .bar.green
  { file: 'apps/desktop/src/styles.css', text: 'linear-gradient(135deg, #7b6cff, #ff5c7a)' }, // .avatar
  { file: 'apps/desktop/src/styles.css', text: 'border-bottom: 6px solid #0006' }, // .gbtn, .tf button
  { file: 'apps/desktop/src/styles.css', text: 'linear-gradient(135deg, #2b3060, #3a2350)' }, // .lesson
];

const RAW = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : cssFiles(join(dir, e.name));
    return e.name.endsWith('.css') ? [join(dir, e.name)] : [];
  });
}

/** Each line with a raw colour, as "file:line text", comments removed. */
export function rawColours(file: string, css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  return code
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => RAW.test(line))
    .filter(({ line }) => !ALLOWED.some((a) => a.file === file && line.includes(a.text)))
    .map(({ line, n }) => `${file}:${n} ${line}`);
}

test('finds hex, rgb() and hsl() colours but not ids, tokens or comments', () => {
  const css = '.a { color: #fff; }\n.b { color: var(--color-text); }\n/* #000 */\n#main { background: rgb(0 0 0); }';
  assert.deepEqual(rawColours('x.css', css), [
    'x.css:1 .a { color: #fff; }',
    'x.css:4 #main { background: rgb(0 0 0); }',
  ]);
});

test('stylesheets use design tokens, not raw colours', () => {
  const files = SCAN.flatMap((d) => cssFiles(join(ROOT, d)))
    .map((f) => relative(ROOT, f).split('\\').join('/'))
    .filter((f) => !GENERATED.has(f));
  assert.ok(files.includes('apps/desktop/src/styles.css'), 'the scan must reach the app stylesheet');
  const found = files.flatMap((f) => rawColours(f, readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(found, [], 'Use a token from packages/ui/tokens.css, e.g. var(--color-accent)');
});

test('every allowed raw colour is still there (remove it from the list once fixed)', () => {
  const stale = ALLOWED.filter((a) => !readFileSync(join(ROOT, a.file), 'utf8').includes(a.text));
  assert.deepEqual(stale, []);
});
