// Right-to-left guards: the pseudo-RTL locale, the text direction for each language, and no physical
// left/right CSS that would stay put when the layout flips (Arabic, Hebrew, Urdu…).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../../locales/en.json';
import { PSEUDO_RTL, directionOf } from './direction';
import { pseudoRtlString, pseudoize, withPluralForms } from './pseudo';

const SRC = import.meta.dirname;

const RLO = '‮';
const PDF = '‬';

test('right-to-left languages and the pseudo-RTL locale get dir="rtl"', () => {
  for (const code of ['ar', 'he', 'ur', 'fa', 'ar-EG', 'he-IL', PSEUDO_RTL])
    assert.equal(directionOf(code), 'rtl', code);
  for (const code of ['en', 'de', 'en-XA', 'zh-Hant', '', undefined, null])
    assert.equal(directionOf(code), 'ltr', `${code}`);
});

test('pseudo-RTL text reads right to left but keeps placeholders and tags', () => {
  const p = pseudoRtlString('Mini (~{{minutes}} min) <b>now</b>');
  assert.ok(p.includes('{{minutes}}'));
  assert.ok(p.includes('<b>') && p.includes('</b>'));
  assert.ok(!p.includes(`${RLO}{{`), 'placeholders stay outside the override');
  assert.ok(p.includes(`${RLO}now${PDF}`));
  assert.ok(pseudoRtlString('Know 100 cards').includes(' 100 '), 'numbers are not mirrored');
  // Every override is closed again, so text never leaks its direction into what follows.
  assert.equal(p.split(RLO).length, p.split(PDF).length);
  const tree = pseudoize(en, pseudoRtlString);
  assert.equal(JSON.stringify(Object.keys(tree)), JSON.stringify(Object.keys(en)));
});

test('pseudo-RTL has every Arabic plural form, so counts never fall back to English', () => {
  const tree = withPluralForms({ a: { cards_one: 'one', cards_other: 'many' }, b: 'x' }, 'ar');
  assert.deepEqual(tree, {
    a: {
      cards_one: 'one',
      cards_other: 'many',
      cards_few: 'many',
      cards_many: 'many',
      cards_two: 'many',
      cards_zero: 'many',
    },
    b: 'x',
  });
});

type Finding = { line: number; text: string };

/** CSS that pins things to the left or right instead of the start or end of the line. */
export function findPhysicalCss(css: string): Finding[] {
  const out: Finding[] = [];
  const lines = css.split('\n');
  lines.forEach((raw, i) => {
    const text = raw.trim();
    // `/* rtl-ignore */` on the line keeps a physical value on purpose (e.g. centring with left: 50%).
    if (text.includes('rtl-ignore')) return;
    const physical =
      /^(margin|padding|border)-(left|right)\b/.test(text) ||
      /^border-(top|bottom)-(left|right)-radius\b/.test(text) ||
      /^(left|right)\s*:/.test(text) ||
      /^(text-align|float|clear)\s*:\s*(left|right)\b/.test(text);
    // Shorthands that would look different mirrored: right ≠ left side, or one corner rounder than its mirror.
    const short = /^(margin|padding|inset|border-width|border-radius)\s*:\s*([^;/]+);/.exec(text);
    const v =
      short?.[2]
        .replace(/\([^)]*\)/g, '()')
        .trim()
        .split(/\s+/) ?? [];
    const lopsided =
      short?.[1] === 'border-radius'
        ? v.length > 1 && (v[0] !== v[1] || (v[2] ?? v[0]) !== (v[3] ?? v[1]))
        : v.length === 4 && v[1] !== v[3];
    if (physical || lopsided) out.push({ line: i + 1, text });
  });
  return out;
}

test('styles.css uses logical properties (inline-start/end), not left/right', () => {
  const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
  assert.deepEqual(
    findPhysicalCss(css).map((f) => `styles.css:${f.line} ${f.text}`),
    [],
    'Use margin-inline-start, padding-inline-end, inset-inline, text-align: start… so RTL layouts flip',
  );
});

test('the CSS check catches physical properties and lopsided shorthands', () => {
  const css = [
    'margin-left: 4px;',
    'padding-inline-start: 4px;',
    'left: 0;',
    'left: 50%; /* rtl-ignore */',
    'text-align: left;',
    'text-align: start;',
    'border-radius: 4px 16px 16px 16px;',
    'margin: 0 0 var(--space-3);',
    'padding: 1px 2px 3px 4px;',
    'border-radius: var(--r) var(--r) 0 0;',
    'border-radius: 8px 0;',
  ].join('\n');
  assert.deepEqual(
    findPhysicalCss(css).map((f) => f.line),
    [1, 3, 5, 7, 9, 11],
  );
});

test('screens use logical inline styles, not left/right', () => {
  const files = (readdirSync(SRC, { recursive: true }) as string[]).filter((f) => f.endsWith('.tsx'));
  const found: string[] = [];
  for (const f of files) {
    readFileSync(join(SRC, f), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (line.includes('rtl-ignore')) return;
        if (/\b(margin|padding|border)(Left|Right)\b|textAlign:\s*'(left|right)'|\b(left|right):\s*[\d'`]/.test(line))
          found.push(`${f}:${i + 1} ${line.trim()}`);
      });
  }
  assert.deepEqual(found, []);
});
