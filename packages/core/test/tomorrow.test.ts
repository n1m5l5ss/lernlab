// "Will you know this tomorrow?" (#205): a judgement from the question alone at the end of a session with new
// cards, checked against the next review. Stored locally; it never changes the schedule (FSRS).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-tomorrow-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { recordAttempt } = await import('../src/learn');
const { planSession } = await import('../src/session');
const { getDb } = await import('../src/db');
const { reportTomorrowCheck, saveTomorrowCheck, tomorrowUnsure } = await import('../src/tomorrow');
after(() => cleanupTempDir(dir));

const rows = Array.from({ length: 12 }, (_, i) => `Question ${i},answer ${i}`).join('\n');
const { deck } = importFile('Tomorrow.csv', strToU8(`front,back\n${rows}\n`));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const day1 = new Date(2026, 10, 24, 18);
const day2 = new Date(2026, 10, 25, 9);
const day3 = new Date(2026, 10, 26, 9);
const answer = (itemId: number, format: 'intro' | 'typed', correct: boolean, at: Date, practice = false) =>
  recordAttempt({ sessionId: 's', itemId, format, correct, responseMs: 900, xp: 1, practice }, getDb(), at);
const srs = () => getDb().prepare('SELECT * FROM srs ORDER BY item_id').all();

const [yes1, yes2, unsure1, unsure2, no1] = ids;
for (const id of [yes1, yes2, unsure1, unsure2, no1]) {
  answer(id, 'intro', true, day1);
  answer(id, 'typed', true, day1);
}

test('the check is saved with its day, only known cards and answers, and changes no schedule', () => {
  const before = srs();
  const saved = saveTomorrowCheck(
    [
      { itemId: yes1, answer: 'yes' },
      { itemId: yes2, answer: 'yes' },
      { itemId: unsure1, answer: 'unsure' },
      { itemId: unsure2, answer: 'unsure' },
      { itemId: no1, answer: 'no' },
      { itemId: 999_999, answer: 'yes' }, // not a card: dropped
    ],
    getDb(),
    day1,
  );
  assert.equal(saved.cards, 5);
  // Changing an answer the same evening replaces it.
  saveTomorrowCheck([{ itemId: no1, answer: 'no' }], getDb(), day1);
  assert.equal(saveTomorrowCheck([{ itemId: yes2, answer: 'yes' }], getDb(), day1).cards, 5);
  assert.throws(() => saveTomorrowCheck([{ itemId: yes1, answer: 'maybe' as 'yes' }], getDb(), day1), {
    code: 'invalid_input',
  });
  assert.deepEqual(srs(), before);
});

test('nothing to report the same day, and "unsure" cards wait for the next day', () => {
  assert.equal(reportTomorrowCheck(getDb(), day1), null);
  assert.deepEqual(tomorrowUnsure(getDb(), day1), []);
  assert.deepEqual(tomorrowUnsure(getDb(), day2).sort(), [unsure1, unsure2].sort());
});

test('the next day, "unsure" cards come first in the warm-up', () => {
  const plan = planSession('standard', getDb(), day2, deck.id);
  const warm = plan.blocks.find((b) => b.kind === 'ignition');
  assert.ok(warm && 'exercises' in warm);
  const warmIds = warm.exercises.map((e) => ('itemId' in e ? e.itemId : 0));
  assert.deepEqual(warmIds.slice(0, 2).sort(), [unsure1, unsure2].sort());
});

test('the next session reports how the guesses held up, once that day', () => {
  assert.equal(reportTomorrowCheck(getDb(), day2), null, 'no card reviewed yet');
  const before = srs();
  answer(yes1, 'typed', true, day2, true); // practice is not a review
  assert.equal(reportTomorrowCheck(getDb(), day2), null);
  assert.deepEqual(srs(), before, 'reading or reporting changes no schedule');
  answer(yes1, 'typed', true, day2);
  answer(yes2, 'typed', false, day2);
  answer(unsure1, 'typed', true, day2);
  answer(no1, 'typed', false, day2);
  const r = reportTomorrowCheck(getDb(), day2)!;
  assert.equal(r.day, '2026-11-24');
  assert.deepEqual(r.groups, {
    yes: { cards: 2, reviewed: 2, right: 1 },
    unsure: { cards: 2, reviewed: 1, right: 1 },
    no: { cards: 1, reviewed: 1, right: 0 },
  });
  assert.deepEqual(tomorrowUnsure(getDb(), day2), [unsure2], 'a reviewed card is no longer put first');
  assert.ok(reportTomorrowCheck(getDb(), day2), 'still shown later that day');
  assert.equal(reportTomorrowCheck(getDb(), day3), null, 'not again on another day');
});
