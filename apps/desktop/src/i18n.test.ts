// Guards for the translation system: no hard-coded visible text in screens, every t('key') exists in
// locales/en.json, and the pseudo-locale keeps placeholders intact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import en from '../../../locales/en.json';
import { pseudoString, pseudoize } from './pseudo';

const SRC = import.meta.dirname;

/** Screens whose text has not moved to locales/en.json yet (issue #10). Remove a file once it is converted. */
const NOT_YET_TRANSLATED = new Set([
  'Browse.tsx',
  'Decks.tsx',
  'Home.tsx',
  'Progress.tsx',
  'Session.tsx',
  'Stats.tsx',
  'Summary.tsx',
]);

/** JSX attributes a person reads or hears. */
const VISIBLE_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'label']);
/** Strings that look like words but are code: key names and the like. */
const CODE_WORDS = new Set(['Enter', 'Escape', 'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
/** A literal that starts like a sentence or a label: "Saved", "Delete this card?". */
const LOOKS_LIKE_TEXT = /^[A-Z][a-z']+(\b|$)/;

type Finding = { file: string; line: number; text: string };

export function findHardCodedText(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Finding[] = [];
  const add = (node: ts.Node, text: string) =>
    out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: text.trim() });
  const lines = source.split('\n');
  // `// i18n-ignore` on the same line or the line above skips a literal (brand names, sample data).
  const ignored = (node: ts.Node) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line;
    return /i18n-ignore/.test(lines[line]) || /i18n-ignore/.test(lines[line - 1] ?? '');
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
    if (ts.isJsxText(node)) {
      if (/\p{L}/u.test(node.text)) add(node, node.text);
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      const init = node.initializer;
      if (VISIBLE_ATTRS.has(name) && init && ts.isStringLiteral(init) && /\p{L}/u.test(init.text) && !ignored(init))
        add(init, init.text);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const isTKey = ts.isCallExpression(parent) && /^(t|i18next\.t)$/.test(parent.expression.getText(sf));
      const isPropName = ts.isPropertyAssignment(parent) && parent.name === node;
      const isAttr = ts.isJsxAttribute(parent); // handled above
      if (
        !isTKey &&
        !isPropName &&
        !isAttr &&
        !CODE_WORDS.has(node.text) &&
        LOOKS_LIKE_TEXT.test(node.text) &&
        !ignored(node)
      )
        add(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const screens = readdirSync(SRC).filter((f) => f.endsWith('.tsx'));

test('screens have no hard-coded visible text (use t() and locales/en.json)', () => {
  const findings = screens
    .filter((f) => !NOT_YET_TRANSLATED.has(f))
    .flatMap((f) => findHardCodedText(f, readFileSync(join(SRC, f), 'utf8')));
  assert.deepEqual(
    findings.map((f) => `${f.file}:${f.line} "${f.text}"`),
    [],
    'Move these strings to locales/en.json and show them with t()',
  );
});

test('the check catches JSX text, visible attributes and label-like literals', () => {
  const src = `
    const L = ['Off', 'Relaxed'];
    const ok = { key: 'Enter' };
    export const A = () => <div className="row big">Hello <input placeholder="Search cards…" />{t('a.b')}{msg('Saved ✓')}</div>;
    // i18n-ignore
    const brand = 'Anki';`;
  assert.deepEqual(
    findHardCodedText('x.tsx', src).map((f) => f.text),
    ['Off', 'Relaxed', 'Hello', 'Search cards…', 'Saved ✓'],
  );
});

test('the not-yet-translated list only names files that exist', () => {
  for (const f of NOT_YET_TRANSLATED) assert.ok(screens.includes(f), `${f} is gone: remove it from the list`);
});

const flatKeys = (tree: object, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : flatKeys(v, `${prefix}${k}.`)));

test('every t() key used in the screens exists in locales/en.json', () => {
  const keys = new Set(flatKeys(en));
  const missing: string[] = [];
  for (const f of readdirSync(SRC).filter((x) => /\.tsx?$/.test(x) && !x.endsWith('.test.ts'))) {
    const src = readFileSync(join(SRC, f), 'utf8');
    // Static keys: t('a.b'). Template keys: t(`a.${x}`) must match at least one key with that prefix.
    for (const m of src.matchAll(/\bt\('([\w.]+)'/g))
      if (!keys.has(m[1]) && !keys.has(`${m[1]}_other`)) missing.push(`${f}: ${m[1]}`);
    for (const m of src.matchAll(/\bt\(`([\w.]+)\.\$\{/g))
      if (![...keys].some((k) => k.startsWith(`${m[1]}.`))) missing.push(`${f}: ${m[1]}.*`);
  }
  assert.deepEqual(missing, []);
});

test('pseudo-locale accents text but keeps placeholders and tags', () => {
  const p = pseudoString('Mini (~{{minutes}} min) <b>now</b>');
  assert.match(p, /^\[!! /);
  assert.match(p, / !!\]$/);
  assert.ok(p.includes('{{minutes}}'));
  assert.ok(p.includes('<b>') && p.includes('</b>'));
  assert.ok(!/Mini/.test(p));
  assert.deepEqual(flatKeys(pseudoize(en)), flatKeys(en));
});
