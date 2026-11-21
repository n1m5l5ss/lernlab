import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import tokens from '../../../docs/design/tokens.json';

const ui = join(import.meta.dirname, '..');
const css = readFileSync(join(ui, 'fonts.css'), 'utf8');
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
  family: /font-family:\s*'([^']+)'/.exec(body)?.[1] ?? '',
  urls: [...body.matchAll(/url\('?([^')]+)'?\)/g)].map((m) => m[1]),
  body,
}));

test('fonts.css bundles Atkinson Hyperlegible Next and Noto Telugu, Devanagari and Arabic', () => {
  const families = new Set(faces.map((f) => f.family));
  assert.deepEqual([...families].sort(), [
    'Atkinson Hyperlegible Next',
    'Noto Sans Arabic',
    'Noto Sans Devanagari',
    'Noto Sans Telugu',
  ]);
});

test('every font file in fonts.css exists, is woff2 and has a licence beside it', () => {
  for (const f of faces) {
    assert.ok(f.urls.length > 0, `${f.family} has a src`);
    for (const url of f.urls) {
      assert.match(url, /^\.\/fonts\/[a-z-]+\/[a-z-]+\.woff2$/, url);
      const file = join(ui, url);
      assert.ok(existsSync(file), `${url} exists`);
      assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', `${url} is woff2`);
      const licence = join(dirname(file), 'OFL.txt');
      assert.ok(existsSync(licence), `${url} has OFL.txt beside it`);
      assert.match(readFileSync(licence, 'utf8'), /SIL Open Font License, Version 1\.1/);
    }
  }
});

test('every bundled file is used, so nothing ships that never loads', () => {
  const used = new Set(faces.flatMap((f) => f.urls.map((u) => join(ui, u))));
  const fontsDir = join(ui, 'fonts');
  for (const dir of readdirSync(fontsDir).filter((d) => statSync(join(fontsDir, d)).isDirectory()))
    for (const file of readdirSync(join(fontsDir, dir)).filter((n) => n.endsWith('.woff2')))
      assert.ok(used.has(join(fontsDir, dir, file)), `${dir}/${file} is referenced`);
});

test('each face swaps in, loads by script, and keeps a variable weight range', () => {
  for (const f of faces) {
    assert.match(f.body, /font-display:\s*swap;/, f.family);
    assert.match(f.body, /unicode-range:\s*U\+/, f.family);
    assert.match(f.body, /font-weight:\s*\d+ \d+;/, f.family);
  }
});

test('the UI font stack names the bundled families first and leaves CJK to the system', () => {
  const stack = tokens.font.ui.split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.equal(stack[0], 'Atkinson Hyperlegible Next');
  for (const name of ['Noto Sans Telugu', 'Noto Sans Devanagari', 'Noto Sans Arabic'])
    assert.ok(stack.includes(name), name);
  assert.ok(stack.some((s) => /CJK|Hiragino|PingFang|YaHei|Gothic/.test(s)));
  assert.ok(!faces.some((f) => /CJK|JP|SC|KR/.test(f.family)), 'CJK is not bundled');
});
