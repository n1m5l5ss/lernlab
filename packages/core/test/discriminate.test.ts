// Telling look-alike categories apart (#211): the sorting round asks "Which one is this?" about the categories
// (or category-like tags) the learner mixes up most, as practice only. New vocabulary does the opposite: it is
// met in themed groups and mixed only later, in review.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-discriminate-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { categoryLabels, confusableLabels, labelMisses, themedFirst, ROUND_MAX } = await import('../src/discriminate');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const STYLES = ['Impressionism', 'Cubism', 'Baroque', 'Rococo', 'Fauvism', 'Realism'];
const art = createDeck('Paintings', null);
upsertCards(
  art,
  STYLES.flatMap((style, s) =>
    [1, 2, 3, 4].map((n) => ({ front: `Painting ${s}-${n}`, back: `Painter ${s}-${n}`, tags: ['art', style] })),
  ),
);
const paintings = allItems(getDb(), art.id);
const labels = categoryLabels(paintings);
const of = (style: string) => paintings.filter((p) => p.tags.includes(style));

test('tags that split a deck into groups are its categories; a tag on every card, topic tags and word lists are not', () => {
  assert.equal(labels.size, 24);
  assert.equal(labels.get(of('Baroque')[0].id), 'Baroque');
  const item = (id: number, tags: string[], o: object = {}) => ({ ...paintings[0], id, tags, category: null, ...o });
  const topics = [1, 2, 3, 4, 5, 6].map((id) =>
    item(
      id,
      ['a', 'b', 'c'].filter((_, k) => (id + k) % 3 !== 0),
    ),
  );
  assert.equal(categoryLabels(topics).size, 0, 'cards with several of the tags: topics, not categories');
  const words = [1, 2, 3, 4, 5, 6].map((id) => item(id, [id % 2 ? 'food' : 'travel'], { lang: 'de' }));
  assert.equal(categoryLabels(words).size, 0, 'vocabulary is never mixed by theme');
  const cats = [1, 2, 3].map((id) =>
    item(id, ['x'], { category: id % 2 ? 'IaaS' : 'SaaS', lang: id === 3 ? 'de' : null }),
  );
  assert.deepEqual([...categoryLabels(cats).values()], ['IaaS', 'SaaS', 'IaaS'], 'a category always counts');
});

test('the round takes the categories mixed up most: wrong picks in earlier rounds and mixed-up cards', () => {
  assert.equal(confusableLabels(labels, new Map(), []).length, 4, 'nothing known yet: any four');
  const [b, r] = [of('Baroque')[0], of('Rococo')[0]];
  const wrong = { sessionId: 's', format: 'gender' as const, genderOnly: true, correct: false, responseMs: 1, xp: 0 };
  const now = new Date(2026, 10, 2, 10);
  recordAttempt({ ...wrong, itemId: b.id, given: 'Rococo' }, getDb(), now);
  recordAttempt({ ...wrong, itemId: b.id, given: 'Rococo', correct: true }, getDb(), now);
  recordAttempt({ ...wrong, itemId: r.id, given: 'Fauvism' }, getDb(), new Date(2026, 5, 1)); // long ago
  assert.deepEqual(labelMisses(getDb(), now), [{ itemId: b.id, picked: 'Rococo', n: 1 }]);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM srs').get()!.n, 0, 'practice only: nothing is scheduled');
  const mixups = new Map([[of('Cubism')[0].id, [of('Fauvism')[0].id]]]);
  for (let k = 0; k < 10; k++) {
    const picked = confusableLabels(labels, mixups, labelMisses(getDb(), now));
    assert.deepEqual(picked.slice(0, 2).sort(), ['Baroque', 'Rococo'], 'wrong picks weigh most');
    assert.deepEqual(picked.slice(2).sort(), ['Cubism', 'Fauvism'], 'then the styles of mixed-up cards');
  }
});

test('a deck of tagged categories gets an untimed "Which one is this?" round on the confusable ones', () => {
  const plan = planSession('standard', getDb(), new Date(2026, 10, 2, 11), art.id);
  const round = plan.blocks.find((b) => b.kind === 'gender');
  assert.ok(round?.kind === 'gender' && round.labels && round.choices);
  assert.equal(round.seconds, 0, 'no clock');
  assert.equal(round.teacher.key, 'teacher.block.tellApart');
  assert.ok(round.choices.includes('Baroque') && round.choices.includes('Rococo') && round.choices.length === 4);
  assert.ok(round.itemIds.length >= 4 && round.itemIds.length <= ROUND_MAX);
  for (const id of round.itemIds) assert.ok(round.choices.includes(round.labels[id]));
  assert.ok(new Set(round.itemIds.map((id) => round.labels![id])).size >= 2, 'mixed');
});

test('new vocabulary is met in themed groups: the next new word sets the theme', () => {
  const vocab = createDeck('Deutsch', 'de');
  const themes = ['food', 'travel', 'home'];
  upsertCards(
    vocab,
    Array.from({ length: 18 }, (_, i) => ({
      front: `Wort${i}`,
      back: `word${i}`,
      tags: ['a1', themes[i % 3]],
      rank: i + 1,
    })),
  );
  const words = allItems(getDb(), vocab.id);
  assert.deepEqual(
    themedFirst(words)
      .slice(0, 5)
      .map((id) => words.find((w) => w.id === id)!.target),
    ['Wort0', 'Wort3', 'Wort6', 'Wort9', 'Wort12'],
  );
  assert.deepEqual(
    themedFirst(paintings).slice(0, 3),
    paintings.slice(0, 3).map((p) => p.id),
    'other subjects keep their order',
  );
  const plan = planSession('standard', getDb(), new Date(2026, 10, 2, 12), vocab.id);
  const met = plan.blocks
    .flatMap((b) => (b.kind === 'learn' ? b.exercises : []))
    .flatMap((e) => (e.type === 'intro' ? [plan.items[e.itemId].tags[1]] : []));
  assert.deepEqual(met, ['food', 'food', 'food', 'food', 'food']);
  assert.equal(themedFirst(words).length, words.length, 'every new card stays in the list');
});
