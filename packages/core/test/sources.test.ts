// What a session covers: one deck, several decks, everything, a tag, starred cards or the hardest cards.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-sources-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { createDeck } = await import('../src/library');
const { planSession } = await import('../src/session');
const { recordAttempt, scopeFor, asStudySource, currentSource } = await import('../src/learn');
const { getDb, setMeta } = await import('../src/db');
after(() => cleanupTempDir(dir));

const csv = (prefix: string, n: number, tag: (i: number) => string) =>
  strToU8(
    'front,back,tags\n' +
      Array.from({ length: n }, (_, i) => `${prefix} ${i},${prefix.toLowerCase()} answer ${i},${tag(i)}`).join('\n'),
  );
const a = createDeck('Alpha', null, { newPerDay: 2 });
const b = createDeck('Beta', null, { newPerDay: 3 });
const c = createDeck('Gamma');
importFile(
  'a.csv',
  csv('Alpha', 12, (i) => (i < 4 ? 'exam' : 'misc')),
  { deckId: a.id },
);
importFile(
  'b.csv',
  csv('Beta', 12, (i) => (i < 2 ? 'Exam' : '')),
  { deckId: b.id },
);
importFile(
  'c.csv',
  csv('Gamma', 12, () => 'misc'),
  { deckId: c.id },
);

const day = new Date(2026, 10, 23, 10);
const rows = (where: string) =>
  getDb()
    .prepare(`SELECT id, deck_id FROM items WHERE ${where} ORDER BY id`)
    .all()
    .map((r) => ({ id: Number(r.id), deck: Number(r.deck_id) }));
const planned = (plan: ReturnType<typeof planSession>) =>
  [...Object.values(plan.items), ...Object.values(plan.extras)].map((i) => i.id);
const decksOf = (ids: number[]) => new Set(ids.map((id) => rows(`id = ${id}`)[0].deck));

test('several decks: only their cards, and each deck keeps its own new-card limit', () => {
  const plan = planSession('long', getDb(), day, { kind: 'decks', deckIds: [a.id, b.id] });
  assert.deepEqual(decksOf(planned(plan)), new Set([a.id, b.id]));
  const fresh = plan.blocks
    .flatMap((x) => ('exercises' in x ? x.exercises : []))
    .filter((e) => e.type === 'intro')
    .map((e) => ('itemId' in e ? e.itemId : 0));
  const perDeck = (deck: number) => new Set(fresh.filter((id) => rows(`id = ${id}`)[0].deck === deck)).size;
  assert.equal(perDeck(a.id), 2, 'Alpha allows 2 new cards a day');
  assert.equal(perDeck(b.id), 3, 'Beta allows 3');
  assert.equal(plan.counts.fresh, 5);
});

test('everything: all decks, with limits still per deck', () => {
  const plan = planSession('long', getDb(), day, { kind: 'all' });
  assert.deepEqual(decksOf(planned(plan)), new Set([a.id, b.id, c.id]));
  assert.ok(plan.counts.fresh <= 8, 'never more than the long-session cap');
});

test('a tag (any case) covers only the tagged cards, across decks', () => {
  const tagged = rows("tags LIKE '%xam%'").map((r) => r.id);
  assert.equal(tagged.length, 6);
  const plan = planSession('long', getDb(), day, { kind: 'tag', tag: 'EXAM' });
  assert.ok(planned(plan).length > 0);
  assert.ok(
    planned(plan).every((id) => tagged.includes(id)),
    'no untagged cards',
  );
});

test('starred cards only', () => {
  const starred = rows(`deck_id = ${c.id}`)
    .slice(0, 5)
    .map((r) => r.id);
  getDb().exec(`UPDATE items SET starred = 1 WHERE id IN (${starred.join(',')})`);
  const plan = planSession('long', getDb(), day, { kind: 'starred' });
  assert.ok(planned(plan).length > 0);
  assert.ok(planned(plan).every((id) => starred.includes(id)));
});

test('hardest cards: the ones you lapse on, and no new cards', () => {
  const ids = rows(`deck_id = ${b.id}`).map((r) => r.id);
  const t = new Date(2026, 10, 20, 10);
  for (const id of ids.slice(0, 6)) {
    recordAttempt({ sessionId: 's', itemId: id, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), t);
    recordAttempt(
      { sessionId: 's', itemId: id, format: 'typed', correct: ids.indexOf(id) >= 4, responseMs: 2000, xp: 1 },
      getDb(),
      t,
    );
  }
  const hard = ids.slice(0, 4);
  const plan = planSession('long', getDb(), day, { kind: 'hardest' });
  assert.equal(plan.counts.fresh, 0);
  assert.ok(planned(plan).length > 0);
  assert.ok(
    planned(plan).every((id) => hard.includes(id)),
    'only cards with lapses or wrong answers',
  );
});

test('the chosen source is remembered, falls back to the active deck, and bad values are ignored', () => {
  setMeta(getDb(), 'activeDeck', b.id);
  setMeta(getDb(), 'studySource', null);
  assert.deepEqual(currentSource(), { kind: 'deck', deckId: b.id });
  setMeta(getDb(), 'studySource', { kind: 'tag', tag: 'exam' });
  assert.deepEqual(currentSource(), { kind: 'tag', tag: 'exam' });
  setMeta(getDb(), 'studySource', { kind: 'decks', deckIds: ['1; DROP TABLE items'] });
  assert.deepEqual(currentSource(), { kind: 'deck', deckId: b.id });
  assert.equal(asStudySource({ kind: 'tag', tag: '  ' }), null);
  assert.equal(asStudySource({ kind: 'nope' }), null);
  const scope = scopeFor({ kind: 'tag', tag: "x' OR 1=1 --" });
  assert.ok(scope && typeof scope === 'object' && scope.where === ' AND 0', 'tags never reach SQL');
});

test("a session carries each deck's reading voice and speed, so cards are read the way their deck asks", async () => {
  const { updateDeck } = await import('../src/library');
  updateDeck(a.id, { settings: { voice: 'uri:Anna', rate: 0.8 } });
  updateDeck(b.id, { settings: { rate: 1.2 } });
  const plan = planSession('long', getDb(), day, { kind: 'decks', deckIds: [a.id, b.id] });
  assert.deepEqual(plan.speech, { [a.id]: { voice: 'uri:Anna', rate: 0.8 }, [b.id]: { rate: 1.2 } });
  const one = planSession('long', getDb(), day, { kind: 'deck', deckId: c.id });
  assert.deepEqual(one.speech, { [c.id]: {} });
});
