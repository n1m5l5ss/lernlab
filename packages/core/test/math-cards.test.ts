// Math and numeric cards (#45): imported from CSV and .lernpack, studied as typed answers, exported unchanged.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-math-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { cardToItem } = await import('../src/library');
const { recall } = await import('../src/exercises');
const { numericOf, checkNumeric } = await import('../src/numeric');
const { checkAnswer } = await import('../src/text');
const { getDb } = await import('../src/db');
const { rowToItem } = await import('../src/learn');
after(() => cleanupTempDir(dir));

const CSV = `front,back,type,tolerance
"Free-fall acceleration \\(g\\) on Earth?",9.81 m/s^2,numeric,0.05
Speed of light?,300 000 km/s,numeric,1%
Derivative of \\(x^2\\)?,\\(2x\\),,
Area of a circle?,\\(\\pi r^2\\),,
"Not a number",about ten,numeric,
`;
const enc = (s: string) => new TextEncoder().encode(s);
const items = (deckId: number) =>
  getDb()
    .prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((r) => rowToItem(r));

test('a numeric card keeps its number, unit and tolerance; a numeric type without a number stays basic', () => {
  const r = importFile('physics.csv', enc(CSV), { deckName: 'Physics' });
  assert.equal(r.added, 5);
  const [g, c, , , notNum] = items(r.deck.id);
  assert.equal(g.kind, 'numeric');
  assert.equal(g.extra.tolerance, '0.05');
  assert.deepEqual(numericOf(g), { value: 9.81, tolerance: { abs: 0.05 }, unit: 'm/s^2', text: '9.81 m/s^2' });
  assert.deepEqual(numericOf(c)?.tolerance, { rel: 0.01 });
  assert.equal(notNum.kind, 'card');
  assert.equal(notNum.extra.tolerance, undefined, 'a tolerance only lives on a numeric card');
});

test('numeric and math cards are asked as typed answers and checked by their own rules', () => {
  const [g, , d, area] = items(importFile('p.csv', enc(CSV), { deckName: 'Physics 2' }).deck.id);
  const ex = recall(g);
  assert.equal(ex.type, 'typed');
  assert.equal(checkNumeric('9.8 m/s²', numericOf(g)!).correct, true);
  const dx = recall(d);
  assert.ok(dx.type === 'typed');
  assert.equal(checkAnswer('2x', dx.accepted).correct, true);
  assert.equal(checkAnswer('2y', dx.accepted).correct, false);
  const ax = recall(area);
  assert.ok(ax.type === 'typed');
  assert.equal(checkAnswer('\\pi r^{2}', ax.accepted).correct, true);
  assert.ok(!ax.hint.includes('\\('), 'the hint does not give away the delimiters');
});

test('math survives saving: Markdown and the sanitiser leave the formula alone', () => {
  const item = cardToItem(
    { id: 1, name: 'M', language: null },
    { front: 'Conjugate *of* \\(z^* w^*\\)', back: '\\(\\overline{z}\\)' },
  )!;
  assert.equal(item.target, 'Conjugate of \\(z^* w^*\\)');
  assert.equal(item.meaning, '\\(\\overline{z}\\)');
});

test('CSV and .lernpack exports keep the type and the tolerance, and import back the same', () => {
  const r = importFile('physics.csv', enc(CSV), { deckName: 'Physics export' });
  const csv = strFromU8(exportDeck(r.deck.id, 'csv').data);
  assert.ok(csv.split('\n')[0].split(',').includes('tolerance'));
  const back = importFile('again.csv', enc(csv), { deckName: 'Physics from CSV' });
  const pack = exportDeck(r.deck.id, 'lernpack');
  const jsonl = strFromU8(unzipSync(pack.data)['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  assert.equal(jsonl[0].type, 'numeric');
  assert.equal(jsonl[0].tolerance, '0.05');
  assert.ok(!('tolerance' in (jsonl[0].extra ?? {})));
  const fromPack = importFile(pack.name, pack.data, { deckName: 'Physics from pack' });
  const strip = (i: ReturnType<typeof rowToItem>) => ({ ...i, id: 0, deckId: 0, deck: '' });
  assert.deepEqual(items(back.deck.id).map(strip), items(r.deck.id).map(strip));
  assert.deepEqual(items(fromPack.deck.id).map(strip), items(r.deck.id).map(strip));
});
