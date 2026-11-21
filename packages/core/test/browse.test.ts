// Card browser: search, filters and bulk actions over every deck.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-browse-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { createDeck } = await import('../src/library');
const { recordAttempt } = await import('../src/learn');
const { findCards, bulkCards } = await import('../src/browse');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const csv = [
  'front,back,tags',
  'Paris,capital of France,geo eu',
  'Berlin,capital of Germany,geo eu',
  'Nile,longest river,geo africa',
  '<b>Photosynthesis</b>,plants make sugar,bio',
].join('\n');
const { deck } = importFile('World.csv', strToU8(`${csv}\n`));
const other = createDeck('Other', null);
const all = () => findCards({}).rows;
const byFront = (f: string) => all().find((r) => r.front === f)!;

test('search covers front, back and tags; filters narrow by deck and tag', () => {
  assert.equal(findCards({ q: 'berlin' }).total, 1);
  assert.equal(findCards({ q: 'river' }).rows[0].front, 'Nile');
  assert.equal(findCards({ q: 'africa' }).rows[0].front, 'Nile');
  assert.equal(findCards({ tag: 'EU' }).total, 2, 'tags match whole and ignore case');
  assert.equal(findCards({ tag: 'e' }).total, 0);
  assert.equal(findCards({ deckId: other.id }).total, 0);
  assert.equal(findCards({ deckId: deck.id }).total, 4);
  assert.equal(byFront('Photosynthesis').front, 'Photosynthesis', 'rows show plain text');
});

test('state filter: new, learning, known, suspended, starred', () => {
  const nile = byFront('Nile').id;
  const paris = byFront('Paris').id;
  const at = new Date(2026, 10, 24, 10);
  recordAttempt({ sessionId: 's', itemId: nile, format: 'intro', correct: true, responseMs: 900, xp: 1 }, getDb(), at);
  recordAttempt({ sessionId: 's', itemId: paris, format: 'intro', correct: true, responseMs: 900, xp: 1 }, getDb(), at);
  getDb().prepare('UPDATE item_state SET mastery = 4 WHERE item_id = ?').run(paris);
  assert.deepEqual(
    findCards({ state: 'new' })
      .rows.map((r) => r.front)
      .sort(),
    ['Berlin', 'Photosynthesis'],
  );
  assert.deepEqual(
    findCards({ state: 'learning' }).rows.map((r) => r.front),
    ['Nile'],
  );
  assert.deepEqual(
    findCards({ state: 'known' }).rows.map((r) => r.front),
    ['Paris'],
  );
  assert.equal(byFront('Paris').state, 'known');
  bulkCards([nile], { kind: 'suspend' });
  bulkCards([paris], { kind: 'star' });
  assert.deepEqual(
    findCards({ state: 'suspended' }).rows.map((r) => r.front),
    ['Nile'],
  );
  assert.deepEqual(
    findCards({ state: 'starred' }).rows.map((r) => r.front),
    ['Paris'],
  );
  assert.equal(bulkCards([nile], { kind: 'unsuspend' }), 1);
  assert.equal(findCards({ state: 'suspended' }).total, 0);
});

test('bulk tag, untag and move keep each card and its progress', () => {
  const ids = [byFront('Paris').id, byFront('Berlin').id];
  assert.equal(bulkCards(ids, { kind: 'tag', tag: 'capital' }), 2);
  bulkCards(ids, { kind: 'tag', tag: 'Capital' });
  assert.deepEqual(byFront('Paris').tags, ['geo', 'eu', 'capital'], 'no duplicate tags');
  bulkCards(ids, { kind: 'untag', tag: 'EU' });
  assert.deepEqual(byFront('Berlin').tags, ['geo', 'capital']);
  assert.equal(bulkCards(ids, { kind: 'move', deckId: other.id }), 2);
  assert.equal(findCards({ deckId: other.id }).total, 2);
  assert.equal(byFront('Paris').state, 'known', 'moving keeps progress');
  assert.throws(() => bulkCards(ids, { kind: 'move', deckId: 99999 }));
});

test('bulk delete removes the cards and their schedule', () => {
  const nile = byFront('Nile').id;
  assert.equal(bulkCards([nile, 123456789], { kind: 'delete' }), 1);
  assert.equal(findCards({ q: 'Nile' }).total, 0);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM srs WHERE item_id = ?').get(nile)!.n, 0);
});

test('10,000 cards list quickly', () => {
  const rows = Array.from({ length: 10_000 }, (_, i) => `Word ${i},meaning ${i},bulk`).join('\n');
  importFile('Big.csv', strToU8(`front,back,tags\n${rows}\n`));
  const t0 = performance.now();
  const res = findCards({ tag: 'bulk' });
  const ms = performance.now() - t0;
  assert.equal(res.total, 10_000);
  assert.equal(res.rows.length, 10_000);
  assert.ok(ms < 1500, `took ${ms.toFixed(0)} ms`);
});

test('a page is read with LIMIT/OFFSET, so pages past the first 20,000 cards still come back', () => {
  const rows = Array.from({ length: 10_500 }, (_, i) => `Extra ${i},more ${i},bulk`).join('\n');
  importFile('Bigger.csv', strToU8(`front,back,tags\n${rows}\n`));
  assert.equal(findCards({ tag: 'bulk' }).total, 20_500);
  const last = findCards({ tag: 'bulk' }, getDb(), { limit: 50, offset: 20_490 });
  assert.equal(last.total, 20_500);
  assert.equal(last.rows.length, 10);
  assert.equal(last.rows.at(-1)!.front, 'Extra 10499');
  const page = findCards({ tag: 'bulk' }, getDb(), { limit: 2, offset: 1 });
  assert.deepEqual(
    page.rows.map((r) => r.front),
    ['Word 1', 'Word 2'],
  );
});
