// Teach-back (#208): mastered tags are offered, their key points come from the tag's cards, and the cards
// behind missed points can be practised without touching the schedule.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-teachback-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { allItems, recordAttempt } = await import('../src/learn');
const { planSession } = await import('../src/session');
const { TEACH_POINTS_MAX, isMastered, missedCards, teachBackPoints, teachBackTopics } =
  await import('../src/teachback');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const bio = createDeck('Biology', null);
upsertCards(bio, [
  { sourceId: 'a', front: 'What makes ATP?', back: 'The <b>mitochondrion</b>', tags: ['Cells'] },
  { sourceId: 'b', front: 'The {{c1::ribosome}} builds proteins', back: '', tags: ['cells'] },
  {
    sourceId: 'c',
    front: 'Why do cells divide?',
    back: 'To grow and repair',
    type: 'explain',
    keyPoints: 'Growth|Repair',
    tags: ['cells', 'why'],
  },
  {
    sourceId: 'd',
    front: 'Which is an organelle?',
    back: '',
    type: 'mcq',
    choices: 'Heart|Nucleus',
    correct: '2',
    tags: ['cells'],
  },
  {
    sourceId: 'e',
    front: 'Order mitosis',
    back: '',
    type: 'order',
    steps: 'Prophase|Metaphase|Anaphase',
    tags: ['cells'],
  },
  { sourceId: 'f', front: 'Largest organ?', back: 'Skin', tags: ['organs'] },
  { sourceId: 'g', front: 'Pumps blood?', back: 'Heart', tags: ['organs'] },
]);
const german = createDeck('German', 'de');
upsertCards(
  german,
  ['der Hund', 'die Katze', 'das Haus'].map((front, i) => ({ sourceId: `v${i}`, front, back: 'x', tags: ['animals'] })),
);
const items = allItems();
const id = (front: string) => items.find((i) => i.target.startsWith(front))!.id;
const know = (itemId: number) => {
  const d = getDb();
  d.prepare('INSERT OR IGNORE INTO item_state(item_id) VALUES (?)').run(itemId);
  d.prepare('UPDATE item_state SET mastery = 3 WHERE item_id = ?').run(itemId);
};

test('a tag is mastered with at least 3 cards and 80% of them known', () => {
  assert.equal(isMastered(2, 2), false);
  assert.equal(isMastered(3, 2), false);
  assert.equal(isMastered(5, 4), true);
});

test('only mastered tags of subject decks are offered; why/how are not topics', () => {
  assert.deepEqual(teachBackTopics(), []);
  for (const i of items) know(i.id);
  assert.deepEqual(teachBackTopics(), [{ tag: 'Cells', cards: 5 }], 'not organs (2 cards), not vocabulary, not why');
});

test("the key points are the tag's explain-card points and plain answers, each with its card", () => {
  const points = teachBackPoints('CELLS');
  assert.deepEqual(
    points.map((p) => [p.about, p.text]),
    [
      ['What makes ATP?', 'The mitochondrion'],
      ['', 'The ribosome builds proteins'],
      ['Why do cells divide?', 'Growth'],
      ['Why do cells divide?', 'Repair'],
      ['Which is an organelle?', 'Nucleus'],
    ],
  );
  assert.deepEqual(teachBackPoints('nothing'), []);
  assert.deepEqual(teachBackPoints(' '), []);
  assert.deepEqual(missedCards(points, [false, true, true, true, false]), [id('The {{c1'), id('Why do cells')]);
  assert.deepEqual(missedCards(points, []), []);
});

test('a big topic is checked against a few points, in card order', () => {
  const big = createDeck('Big', null);
  upsertCards(
    big,
    Array.from({ length: 30 }, (_, i) => ({ sourceId: `n${i}`, front: `Q${i}?`, back: `Answer ${i}`, tags: ['big'] })),
  );
  const points = teachBackPoints('big');
  assert.equal(points.length, TEACH_POINTS_MAX);
  const order = points.map((p) => Number(p.text.split(' ')[1]));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
});

test('practising the missed cards is a practice session over just those cards: no grades', () => {
  const ids = [id('What makes ATP'), id('Why do cells')];
  const plan = planSession('mini', getDb(), new Date(), undefined, { practice: true, cards: ids });
  assert.equal(plan.practice, true);
  const asked = new Set(
    plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises.map((e) => ('itemId' in e ? e.itemId : 0)) : b.itemIds)),
  );
  asked.delete(0);
  assert.ok(asked.size > 0);
  for (const a of asked) assert.ok(ids.includes(a), 'only the missed cards are asked');
  const before = getDb().prepare('SELECT COUNT(*) AS n FROM srs').get()!.n;
  recordAttempt(
    { sessionId: plan.id, itemId: ids[0], format: 'typed', correct: false, responseMs: 1, xp: 0, practice: true },
    getDb(),
  );
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM srs').get()!.n, before);
});
