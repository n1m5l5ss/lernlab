// "Say it aloud" (#222): a planned session marks a few of its flip cards, the starred or recently missed
// ones, and none when the setting is off.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-sayaloud-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { allItems, getSettings, recordAttempt } = await import('../src/learn');
const { planSession } = await import('../src/session');
const { sayAloudCap, sayAloudCards } = await import('../src/sayaloud');
const { getDb, setMeta } = await import('../src/db');
after(() => cleanupTempDir(dir));

// Long fronts and backs are asked as flip cards.
const long = (s: string) => `${s} ${'and some more words to make it long '.repeat(3)}`.trim();
const deck = createDeck('History', null);
upsertCards(
  deck,
  Array.from({ length: 12 }, (_, i) => ({
    sourceId: `c${i}`,
    front: long(`Question ${i}`),
    back: long(`Answer ${i}`),
  })),
);
const items = allItems();
const now = new Date('2026-12-10T12:00:00');
const flipsOf = () =>
  planSession('standard', getDb(), now, deck.id, { practice: true })
    .blocks.flatMap((b) => ('exercises' in b ? b.exercises : []))
    .filter((e) => e.type === 'flip');

test('no starred or missed cards: nothing is said aloud', () => {
  const flips = flipsOf();
  assert.ok(flips.length >= 2, 'the deck is asked as flip cards');
  assert.equal(flips.filter((e) => e.sayAloud).length, 0);
});

test('starred and recently missed cards are found; an old miss is not recent', () => {
  const d = getDb();
  d.prepare('UPDATE items SET starred = 1').run();
  const miss = (itemId: number, at: Date) =>
    recordAttempt(
      { sessionId: 's', itemId, format: 'flip', correct: false, responseMs: 1, xp: 0, practice: true },
      d,
      at,
    );
  miss(items[0].id, new Date('2026-12-09T12:00:00'));
  miss(items[1].id, new Date('2026-11-01T12:00:00'));
  const found = sayAloudCards(
    items.map((i) => i.id),
    '2026-12-03',
    d,
  );
  assert.deepEqual([...found.missed], [items[0].id]);
  assert.equal(found.starred.size, items.length);
});

test('every card starred: still only a minority of the flip cards asks, each card once', () => {
  const flips = flipsOf();
  const cards = new Set(flips.map((e) => e.itemId)).size;
  const asked = flips.filter((e) => e.sayAloud);
  assert.ok(asked.length >= 1);
  assert.equal(asked.length, Math.min(sayAloudCap(cards), asked.length));
  assert.ok(asked.length <= sayAloudCap(cards) && asked.length < cards / 2);
  assert.equal(new Set(asked.map((e) => e.itemId)).size, asked.length);
});

test('the setting turns it off', () => {
  assert.equal(getSettings().sayAloud, true, 'on by default');
  setMeta(getDb(), 'settings', { ...getSettings(), sayAloud: false });
  assert.equal(flipsOf().filter((e) => e.sayAloud).length, 0);
});
