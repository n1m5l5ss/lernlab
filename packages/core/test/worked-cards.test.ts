// Worked examples that fade (#206): a solved problem in steps. The learner studies it, then fills in the last
// step, the last two, and so on. Only the whole problem is a real recall (one FSRS grade per card per day);
// the other rungs are practice and never introduce or grade the card. Games, guess rounds and exams leave
// worked examples out.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-worked-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt, withRungs } = await import('../src/learn');
const { isWorked } = await import('../src/worked');
const { guessable } = await import('../src/guess');
const { buildExam } = await import('../src/examplan');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const STEPS = 'Subtract 3 from both sides :: 2x = 8|Divide both sides by 2 :: x = 4|Check: 2·4 + 3 :: 11';
const SOLVE = { front: 'Solve 2x + 3 = 11', back: 'x = 4', workedSteps: STEPS };

const deck = createDeck('Algebra', null);
upsertCards(deck, [
  { ...SOLVE, type: 'worked', tags: ['equations'] },
  { front: 'Variable', back: 'a letter that stands for a number', tags: ['equations'], category: 'terms' },
  { front: 'Coefficient', back: 'the number in front of a variable', tags: ['equations'], category: 'terms' },
  { front: 'Constant', back: 'a number on its own', tags: ['equations'], category: 'terms' },
  { front: 'Equation', back: 'two expressions set equal', tags: ['equations'], category: 'ideas' },
  { front: 'Solution', back: 'a value that makes it true', tags: ['equations'], category: 'ideas' },
]);
const solve = allItems(getDb(), deck.id).find(isWorked)!;
const rung = () => withRungs(allItems(getDb(), deck.id)).find(isWorked)!.rung;
const srs = () => getDb().prepare('SELECT reps, introduced_day FROM srs WHERE item_id = ?').get(solve.id);
let clock = new Date(2026, 10, 2, 10).getTime();
const answer = (format: 'worked' | 'ladder', correct: boolean, practice = format === 'ladder') =>
  recordAttempt(
    { sessionId: 'w', itemId: solve.id, format, correct, responseMs: 20_000, xp: 1, practice },
    getDb(),
    new Date((clock += 60_000)),
  );
const workedIn = (plan: ReturnType<typeof planSession>) =>
  plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])).filter((e) => e.type === 'worked');

test('a new worked example is studied first, then asks its last step: no games, guess rounds or exams', () => {
  assert.equal(guessable(solve), false);
  for (let k = 0; k < 5; k++) {
    const plan = planSession('standard', getDb(), new Date(clock), deck.id);
    assert.equal(plan.items[solve.id].rung, 0, 'the session knows the rung');
    for (const b of plan.blocks) {
      if ('itemIds' in b) assert.ok(!b.itemIds.includes(solve.id), b.title);
      if ('exercises' in b)
        for (const e of b.exercises)
          if ('itemId' in e && e.itemId === solve.id) assert.equal(e.type, 'worked', `${b.title}: ${e.type}`);
    }
    assert.deepEqual(
      workedIn(plan).map((e) => e.blanks),
      [0, 1],
      'study the full example, then fill in the last step',
    );
    for (const e of plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])))
      if (e.type === 'mc' || e.type === 'truefalse') assert.ok(!JSON.stringify(e).includes('x = 4'), 'no distractor');
  }
  const exam = buildExam(deck.id, getDb());
  assert.ok(exam.questions.length > 0 && exam.questions.every((q) => q.itemId !== solve.id));
});

test('the rungs are practice: they move the ladder but never introduce or grade the card', () => {
  assert.equal(answer('ladder', true).grade, null); // studied
  assert.equal(rung(), 1);
  assert.equal(answer('ladder', false).grade, null);
  assert.equal(rung(), 0, 'a miss goes one rung down');
  answer('ladder', true);
  answer('ladder', true);
  assert.equal(answer('ladder', true, false).grade, null, 'not even when it is not sent as practice');
  assert.equal(rung(), 3);
  assert.equal(srs(), undefined, 'still a new card: it comes back in the next session');
  const plan = planSession('standard', getDb(), new Date(clock), deck.id);
  assert.deepEqual(
    workedIn(plan).map((e) => e.blanks),
    [3],
    'now the whole problem, once',
  );
});

test('solving the whole problem is the real recall: it introduces the card and grades it once per day', () => {
  assert.equal(answer('worked', true).grade, 3);
  assert.equal(Number(srs()?.reps), 1);
  assert.equal(answer('worked', false).grade, null, 'a second answer the same day does not grade');
  assert.equal(rung(), 2, 'but a miss still fades the example back in by one step');
  clock = new Date(2026, 10, 5, 10).getTime();
  const plan = planSession('standard', getDb(), new Date(clock), deck.id);
  assert.deepEqual(
    workedIn(plan).map((e) => e.blanks),
    [2],
    'a due card is asked on its rung',
  );
  assert.equal(answer('ladder', true).grade, null);
  assert.equal(answer('worked', false).grade, 1, 'the whole problem, wrong: Again');
  assert.equal(answer('worked', true, true).grade, null, 'a practice session never grades');
});

test('.lernpack, CSV and JSON carry the worked type and its steps; older readers get a basic card', () => {
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const cards = strFromU8(pack['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const s = cards.find((c) => c.front === SOLVE.front);
  assert.deepEqual([s.type, s.workedSteps, s.back], ['worked', STEPS, 'x = 4']);
  assert.ok(!s.extra?.workedSteps, 'a field, not an extra');
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /,worked_steps,/);
  const again = importFile('Again.csv', strToU8(csv));
  const back = allItems(getDb(), again.deck.id).filter(isWorked);
  assert.deepEqual(
    back.map((i) => i.extra.workedSteps),
    [STEPS],
  );
  const json = importFile('j.json', strToU8(JSON.stringify([{ front: 'Add', workedSteps: '2 + 2 :: 4|4 + 1 :: 5' }])));
  const added = allItems(getDb(), json.deck.id)[0];
  assert.ok(isWorked(added), 'from the steps alone');
  assert.equal(added.meaning, '5', 'no back: the last result');
  assert.ok(exportDeck(deck.id, 'apkg').data.length > 0);
});
