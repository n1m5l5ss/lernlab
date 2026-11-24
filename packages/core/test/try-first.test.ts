// Try first (#218): at the start of a new unit in a deck marked maths or science, the learner tries one of the
// unit's problems before its cards are met, then compares with the worked solution. Productive failure helps
// there, g = 0.36 [Sinha & Kapur 2021]. Practice only: nothing is introduced, graded or logged, and no clock.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';
import type { Block, SessionPlan } from '../src/types';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-tryfirst-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { cleanDeckSettings, createDeck, updateDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { guessCard } = await import('../src/guess');
const { isWorked } = await import('../src/worked');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const day = new Date(2026, 10, 23, 10);
const guessOf = (plan: SessionPlan) =>
  plan.blocks.find((b): b is Extract<Block, { kind: 'guess' }> => b.kind === 'guess');
const cards = [
  ...Array.from({ length: 6 }, (_, i) => ({ front: `Equation term ${i}?`, back: `Meaning ${i}`, tags: ['equations'] })),
  {
    front: 'Solve 2x + 3 = 11',
    back: 'x = 4',
    type: 'worked',
    workedSteps: 'Subtract 3 from both sides :: 2x = 8|Divide both sides by 2 :: x = **4**',
    tags: ['equations'],
  },
];
const count = (table: string) => Number(getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);

test('a deck is marked maths or science in its settings; anything else clears the mark', () => {
  assert.deepEqual(cleanDeckSettings({ subject: 'maths' }), { subject: 'maths' });
  assert.deepEqual(cleanDeckSettings({ subject: 'science' }), { subject: 'science' });
  assert.deepEqual(cleanDeckSettings({ subject: 'history' }), { subject: undefined });
  assert.deepEqual(cleanDeckSettings({ subject: '' }), { subject: undefined });
});

test('an unmarked deck keeps the usual guess round; a maths deck opens a new unit with one problem to try', () => {
  const plain = createDeck('Algebra, unmarked');
  upsertCards(plain, cards);
  const usual = guessOf(planSession('standard', getDb(), day, plain.id));
  assert.ok(usual && !usual.tryFirst, 'guess first, as before');

  const maths = updateDeck(createDeck('Algebra').id, { settings: { subject: 'maths' } });
  upsertCards(maths, cards);
  const problem = allItems(getDb(), maths.id).find(isWorked)!;
  const before = [count('attempts'), count('srs')];
  const plan = planSession('standard', getDb(), day, maths.id);
  const round = guessOf(plan)!;
  assert.deepEqual([round.tryFirst, round.itemIds, round.topic], [true, [problem.id], 'equations']);
  assert.equal(round.teacher.key, 'teacher.block.tryFirst');
  const at = (kind: string) => plan.blocks.findIndex((b) => b.kind === kind);
  assert.ok(at('guess') < at('learn'), 'before the teaching cards');
  assert.ok(plan.items[problem.id]);
  assert.deepEqual([count('attempts'), count('srs')], before, 'planning it changes nothing');

  const card = guessCard(problem);
  assert.equal(card.prompt, 'Solve 2x + 3 = 11');
  assert.equal(card.answer, 'x = 4');
  assert.deepEqual(card.steps, [
    { label: 'Subtract 3 from both sides', result: '2x = 8' },
    { label: 'Divide both sides by 2', result: 'x = <b>4</b>' },
  ]);

  assert.equal(guessOf(planSession('standard', getDb(), day, maths.id, { practice: true })), undefined);
  // Once the problem has been worked on (here: its example was studied), it is not offered again.
  recordAttempt(
    { sessionId: 's', itemId: problem.id, format: 'ladder', correct: true, responseMs: 1, xp: 0, practice: true },
    getDb(),
    day,
  );
  assert.ok(!guessOf(planSession('standard', getDb(), day, maths.id))?.tryFirst);
});

test('no worked example in the unit, or a unit already started: no problem to try', () => {
  const sci = updateDeck(createDeck('Physics').id, { settings: { subject: 'science' } });
  upsertCards(sci, cards.slice(0, 6));
  assert.ok(!guessOf(planSession('standard', getDb(), day, sci.id))?.tryFirst, 'nothing to compare with');
  upsertCards(sci, cards.slice(6));
  assert.ok(guessOf(planSession('standard', getDb(), day, sci.id))?.tryFirst);
  const first = allItems(getDb(), sci.id)[0];
  recordAttempt(
    { sessionId: 's', itemId: first.id, format: 'intro', correct: true, responseMs: 1, xp: 0 },
    getDb(),
    day,
  );
  assert.equal(guessOf(planSession('standard', getDb(), day, sci.id)), undefined, 'the unit is under way');
});
