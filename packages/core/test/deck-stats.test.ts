// Deck list and stats (#130): the per-deck counts come from one grouped query. They must equal what the
// per-deck queries gave before (due queue, new cards left today, cards / fresh / learned, known words).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';
import type { Row } from '../src/host';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-deckstats-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost, openDb } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { createDeck, updateDeck } = await import('../src/library');
const { introduce, endOfDay, deckStats, freshPerDeck, hardestCards, HARDEST_LIMIT, scopeFor, allItems } =
  await import('../src/learn');
const { appState } = await import('../src/progress');
const { dayKey } = await import('../src/game');
const { getDb, setMeta } = await import('../src/db');
after(() => cleanupTempDir(dir));

const d = getDb();
const day = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n, 12);
const NOW = new Date(2026, 5, 10, 12);

// Four decks: two vocabulary decks (one with its own new-card limit), one with grammar cards, one empty.
const csv = (prefix: string, n: number, tags = '') =>
  strToU8(['front,back,tags', ...Array.from({ length: n }, (_, i) => `${prefix}${i},meaning ${i},${tags}`)].join('\n'));
const a = importFile('A.csv', csv('a', 60, 't1')).deck;
const b = importFile('B.csv', csv('b', 45, 't2 extra')).deck;
const g = importFile('G.csv', csv('g', 30, 'grammar')).deck;
createDeck('Empty', null);
updateDeck(b.id, { settings: { newPerDay: 3 } });
setMeta(d, 'settings', { newPerDay: 7 });

// A seeded mix of states: new, introduced on several days (some today), due in the past, today and later,
// graded today, suspended, starred, with lapses, wrong answers and every mastery level.
let seed = 42;
const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const ids = d
  .prepare('SELECT id FROM items ORDER BY id')
  .all()
  .map((r: Row) => Number(r.id));
for (const id of ids) {
  const r = random();
  if (r < 0.1) d.prepare('UPDATE items SET suspended = 1 WHERE id = ?').run(id);
  if (random() < 0.1) d.prepare('UPDATE items SET starred = 1 WHERE id = ?').run(id);
  if (r > 0.65) continue;
  introduce(id, d, day(NOW, -Math.floor(random() * 4)));
  const reps = random() < 0.15 ? 0 : 1 + Math.floor(random() * 5);
  const due = day(NOW, Math.floor(random() * 7) - 3);
  const graded = random() < 0.2 ? dayKey(NOW) : random() < 0.5 ? null : dayKey(day(NOW, -5));
  d.prepare('UPDATE srs SET due = ?, reps = ?, lapses = ?, last_graded_day = ? WHERE item_id = ?').run(
    due.toISOString(),
    reps,
    Math.floor(random() * 3),
    graded,
    id,
  );
  d.prepare('UPDATE item_state SET mastery = ?, wrong = ? WHERE item_id = ?').run(
    Math.floor(random() * 6),
    Math.floor(random() * 3),
    id,
  );
}

// The logic as it was before #130: one set of queries per deck.
function oldPerDeck(now: Date, deckId: number) {
  const cutoff = endOfDay(now).toISOString();
  const today = dayKey(now);
  const due = d
    .prepare(
      `SELECT s.item_id FROM srs s JOIN items i ON i.id = s.item_id
       WHERE i.suspended = 0 AND s.reps > 0 AND s.due <= ? AND (s.last_graded_day IS NULL OR s.last_graded_day != ?)
       AND i.deck_id = ? ORDER BY s.due LIMIT 2000`,
    )
    .all(cutoff, today, deckId).length;
  const settings = JSON.parse(d.prepare('SELECT settings FROM decks WHERE id = ?').get(deckId)!.settings as string);
  const perDay = typeof settings.newPerDay === 'number' ? settings.newPerDay : 7;
  const introducedToday = Number(
    d
      .prepare(
        'SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE s.introduced_day = ? AND i.deck_id = ?',
      )
      .get(today, deckId)!.n,
  );
  const fresh = d
    .prepare(
      `SELECT i.id FROM items i LEFT JOIN srs s ON s.item_id = i.id
       WHERE s.item_id IS NULL AND i.suspended = 0 AND i.kind != 'grammar' AND i.deck_id = ? ORDER BY i.ord LIMIT 1000`,
    )
    .all(deckId).length;
  const counts = d
    .prepare(
      `SELECT COUNT(*) AS cards, SUM(CASE WHEN s.item_id IS NULL THEN 1 ELSE 0 END) AS fresh,
         SUM(CASE WHEN st.mastery >= 3 THEN 1 ELSE 0 END) AS learned
       FROM items i LEFT JOIN srs s ON s.item_id = i.id LEFT JOIN item_state st ON st.item_id = i.id
       WHERE i.suspended = 0 AND i.deck_id = ?`,
    )
    .get(deckId)!;
  return {
    cards: Number(counts.cards),
    fresh: Number(counts.fresh ?? 0),
    learned: Number(counts.learned ?? 0),
    due,
    newToday: Math.min(Math.max(0, perDay - introducedToday), fresh, 1000),
  };
}

const oldWords = (deckId?: number) =>
  Number(
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM item_state st JOIN items i ON i.id = st.item_id WHERE st.mastery >= 3 AND i.kind != 'grammar'${deckId ? ` AND i.deck_id = ${deckId}` : ''}`,
      )
      .get()!.n,
  );
const oldIntroduced = (deckId?: number) =>
  Number(
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id${deckId ? ' WHERE i.deck_id = ?' : ''}`,
      )
      .get(...(deckId ? [deckId] : []))!.n,
  );

test('the fixture covers every kind of card state', () => {
  const n = (sql: string, ...args: string[]) => Number(d.prepare(sql).get(...args)!.n);
  assert.ok(n('SELECT COUNT(*) AS n FROM items WHERE suspended = 1') > 0);
  assert.ok(n('SELECT COUNT(*) AS n FROM srs WHERE introduced_day = ?', dayKey(NOW)) > 0);
  assert.ok(n('SELECT COUNT(*) AS n FROM srs WHERE last_graded_day = ?', dayKey(NOW)) > 0);
  assert.ok(n('SELECT COUNT(*) AS n FROM srs WHERE reps = 0') > 0);
  assert.ok(n('SELECT COUNT(*) AS n FROM item_state WHERE mastery >= 3') > 0);
  assert.ok(n('SELECT COUNT(*) AS n FROM items i LEFT JOIN srs s ON s.item_id = i.id WHERE s.item_id IS NULL') > 0);
  assert.ok(n("SELECT COUNT(*) AS n FROM items WHERE kind = 'grammar'") > 0);
});

test('every deck in the deck list has the same counts as the per-deck queries, on several days', () => {
  for (const offset of [-4, -1, 0, 1, 3]) {
    const now = day(NOW, offset);
    const st = appState(d, now);
    assert.equal(st.decks.length, 4);
    for (const dk of st.decks) {
      const { cards, fresh, learned, due, newToday } = dk;
      assert.deepEqual({ cards, fresh, learned, due, newToday }, oldPerDeck(now, dk.id), `${dk.name} day ${offset}`);
    }
    const stats = deckStats(d, now);
    for (const id of [a.id, b.id, g.id]) {
      assert.equal(stats.get(id)!.words, oldWords(id));
      assert.equal(stats.get(id)!.introduced, oldIntroduced(id));
    }
  }
});

test('the totals for the next session match the old queries for every study source', () => {
  const sources = [
    { kind: 'all' },
    { kind: 'deck', deckId: a.id },
    { kind: 'deck', deckId: b.id },
    { kind: 'decks', deckIds: [a.id, g.id] },
    { kind: 'tag', tag: 'extra' },
    { kind: 'starred' },
    { kind: 'hardest' },
  ] as const;
  for (const source of sources) {
    setMeta(d, 'studySource', source);
    setMeta(d, 'activeDeck', source.kind === 'deck' ? source.deckId : null);
    for (const offset of [0, 2]) {
      const now = day(NOW, offset);
      const st = appState(d, now);
      const deckId = source.kind === 'deck' ? source.deckId : undefined;
      assert.equal(st.wordsProducible, oldWords(deckId), `${source.kind} words`);
      assert.equal(st.introduced, oldIntroduced(deckId), `${source.kind} introduced`);
      assert.equal(st.hardestCount, allItems(d, scopeFor({ kind: 'hardest' }, d)).length);
      assert.equal(st.hardestCount, Math.min(HARDEST_LIMIT, hardestCards(1000, d).length));
      if (source.kind === 'deck') {
        const old = oldPerDeck(now, source.deckId);
        assert.equal(st.due, old.due, 'due for one deck');
        assert.equal(st.newLeftToday, old.newToday, 'new for one deck');
      }
      if (source.kind === 'all') {
        assert.equal(
          st.due,
          Math.min(
            2000,
            st.decks.reduce((s, dk) => s + dk.due, 0),
          ),
          'due for all decks',
        );
        const deckOf = (id: number) => Number(d.prepare('SELECT deck_id FROM items WHERE id = ?').get(id)!.deck_id);
        assert.deepEqual(freshPerDeck(d, now, null, 1000), freshPerDeck(d, now, null, 1000, deckOf));
        assert.equal(st.newLeftToday, freshPerDeck(d, now, null, 1000, deckOf).length, 'new for all decks');
      }
    }
  }
  setMeta(d, 'studySource', null);
  setMeta(d, 'activeDeck', null);
});

test('the counts are kept between calls only while no data changes', () => {
  const counts = (now: Date) => {
    const { cards, fresh, learned, due, newToday } = appState(d, now).decks.find((dk) => dk.id === a.id)!;
    return { cards, fresh, learned, due, newToday };
  };
  const first = counts(NOW);
  assert.deepEqual(counts(NOW), first, 'reading the state twice gives the same counts');

  // A write on this connection: one of deck A's due cards is graded.
  const due = d
    .prepare(
      `SELECT s.item_id FROM srs s JOIN items i ON i.id = s.item_id WHERE i.deck_id = ? AND i.suspended = 0
       AND s.reps > 0 AND s.due <= ? AND (s.last_graded_day IS NULL OR s.last_graded_day != ?) LIMIT 1`,
    )
    .get(a.id, endOfDay(NOW).toISOString(), dayKey(NOW))!;
  d.prepare('UPDATE srs SET last_graded_day = ? WHERE item_id = ?').run(dayKey(NOW), Number(due.item_id));
  assert.equal(counts(NOW).due, first.due - 1);
  assert.deepEqual(counts(NOW), oldPerDeck(NOW, a.id));

  // A commit from another connection to the same file.
  const other = openDb(String(d.prepare('PRAGMA database_list').get()!.file));
  const card = d.prepare('SELECT id FROM items WHERE deck_id = ? AND suspended = 0 LIMIT 1').get(a.id)!;
  other.prepare('UPDATE items SET suspended = 1 WHERE id = ?').run(Number(card.id));
  other.close();
  assert.equal(counts(NOW).cards, first.cards - 1);
  assert.deepEqual(counts(NOW), oldPerDeck(NOW, a.id));

  // The next learning day.
  assert.deepEqual(counts(day(NOW, 1)), oldPerDeck(day(NOW, 1), a.id));
});
