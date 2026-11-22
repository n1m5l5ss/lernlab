// The rest of a closely related group (#223): when a session reviews some cards of a tight group (same deck, a
// shared tag and the same start of the question, like "Capital of …"), the cards of the group that are not due
// get a quick recognition question, so practising some does not weaken the others. Recognition never grades.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-family-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { promptPattern, restOfFamilies, FAMILY_MAX } = await import('../src/family');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const COUNTRIES = ['France', 'Spain', 'Italy', 'Norway', 'Poland', 'Greece'];
const deck = createDeck('Geography', null);
upsertCards(deck, [
  ...COUNTRIES.map((c) => ({ front: `Capital of ${c}`, back: `City of ${c}`, tags: ['europe'] })),
  { front: 'Capital of Peru', back: 'Lima', tags: ['america'] },
  { front: 'Longest river in Europe', back: 'Volga', tags: ['europe'] },
  { front: 'Highest mountain in Europe', back: 'Elbrus', tags: ['europe'] },
  { front: 'Largest lake in Europe', back: 'Ladoga', tags: ['europe'] },
]);
const items = allItems(getDb(), deck.id);
const card = (front: string) => items.find((i) => i.target === front)!;
const capitals = COUNTRIES.map((c) => card(`Capital of ${c}`));

test('a family is the cards of one deck that share a tag and the start of the question', () => {
  assert.equal(promptPattern(capitals[0]), 'capital of');
  assert.equal(promptPattern({ ...capitals[0], target: 'Paris' }), null, 'too short to show a pattern');
  const rest = restOfFamilies(capitals.slice(0, 2), items);
  assert.deepEqual(
    rest.sort(),
    capitals
      .slice(2)
      .map((c) => c.id)
      .sort(),
    'not Peru (other tag), not the river',
  );
  assert.deepEqual(restOfFamilies([card('Longest river in Europe')], items), [], 'no group');
  const many = Array.from({ length: FAMILY_MAX + 1 }, (_, i) => ({ ...capitals[0], id: 1000 + i }));
  assert.deepEqual(restOfFamilies(many.slice(0, 1), many), [], 'a big group is not a tight one');
});

test('a session that reviews part of a family asks the rest as recognition, once, and never grades it', () => {
  const d = getDb();
  const day1 = new Date(2027, 0, 4, 10);
  for (const c of items) {
    recordAttempt({ sessionId: 'a', itemId: c.id, format: 'intro', correct: true, responseMs: 1, xp: 0 }, d, day1);
    recordAttempt({ sessionId: 'a', itemId: c.id, format: 'typed', correct: true, responseMs: 9000, xp: 1 }, d, day1);
  }
  const [due, later] = [capitals.slice(0, 3), capitals.slice(3)];
  const set = d.prepare('UPDATE srs SET due = ? WHERE item_id = ?');
  for (const c of items) set.run(new Date(2027, 5, 1).toISOString(), c.id);
  for (const c of due) set.run(new Date(2027, 0, 10).toISOString(), c.id);
  const now = new Date(2027, 0, 11, 10);
  const related = (when = now) => {
    const plan = planSession('standard', d, when, deck.id);
    const block = plan.blocks.find((b) => b.title === 'Related cards');
    const others = plan.blocks.filter((b) => b !== block).flatMap((b) => ('exercises' in b ? b.exercises : []));
    return {
      ids: block && 'exercises' in block ? block.exercises.map((e) => ('itemId' in e ? e.itemId : 0)) : [],
      block,
      others,
    };
  };
  const first = related();
  assert.deepEqual([...first.ids].sort(), later.map((c) => c.id).sort());
  assert.ok(first.block && 'exercises' in first.block && first.block.exercises.every((e) => e.type === 'mc'));
  const recalls = new Set(['typed', 'cloze', 'flip']);
  for (const e of first.others)
    assert.ok(!('itemId' in e && later.some((c) => c.id === e.itemId) && recalls.has(e.type)), 'no early review');
  const before = d.prepare('SELECT due, reps FROM srs WHERE item_id = ?').get(later[0].id);
  for (const c of later)
    recordAttempt({ sessionId: 'b', itemId: c.id, format: 'mc', correct: true, responseMs: 1, xp: 1 }, d, now);
  assert.deepEqual(d.prepare('SELECT due, reps FROM srs WHERE item_id = ?').get(later[0].id), before);
  assert.deepEqual(related().ids, [], 'answered today: not asked again');
  assert.deepEqual(related(new Date(2027, 0, 12, 10)).ids, [], 'nor the next day');
  assert.equal(
    planSession('standard', d, now, deck.id, { practice: true }).blocks.some((b) => b.title === 'Related cards'),
    false,
  );
});
