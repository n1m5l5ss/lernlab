// "Your own numbers" (#215): recall after a gap against repeats on the same day, counted from the learner's answers.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-spacing-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { recordAttempt } = await import('../src/learn');
const { getDb } = await import('../src/db');
const { spacingCounts } = await import('../src/spacing');
const { journey } = await import('../src/progress');
after(() => cleanupTempDir(dir));

const rows = Array.from({ length: 6 }, (_, i) => `Question ${i},answer ${i}`).join('\n');
const { deck } = importFile('Gaps.csv', strToU8(`front,back\n${rows}\n`));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const day = (n: number) => new Date(2026, 9, 1 + n, 10);
const answer = (itemId: number, n: number, correct: boolean, more: object = {}) =>
  recordAttempt(
    { sessionId: `s${n}`, itemId, format: 'typed', correct, responseMs: 3000, xp: 1, ...more },
    getDb(),
    day(n),
  );
// Every card is met first (an intro is not a recall answer, so it starts no gap).
for (const id of ids) answer(id, 0, true, { format: 'intro' });
const count = (key: string, now = day(45)) => spacingCounts(getDb(), now).find((c) => c.key === key);

test('the first answer to a card has no gap; a repeat on the same day is a same-day answer', () => {
  answer(ids[0], 0, false);
  assert.deepEqual(spacingCounts(getDb(), day(0)), []);
  answer(ids[0], 0, true, { practice: true }); // brought back in the session: practice, still a same-day repeat
  assert.deepEqual(count('sameDay'), { key: 'sameDay', answers: 1, right: 1 });
});

test('reviews after a gap are grouped by its length; only real reviews count there', () => {
  answer(ids[0], 3, true); // 3 days
  answer(ids[0], 12, false); // 9 days
  answer(ids[0], 44, true); // 32 days
  answer(ids[1], 0, true);
  answer(ids[1], 40, true, { practice: true }); // practice after a gap is not a review
  assert.deepEqual(count('days'), { key: 'days', answers: 1, right: 1 });
  assert.deepEqual(count('weeks'), { key: 'weeks', answers: 1, right: 0 });
  assert.deepEqual(count('months'), { key: 'months', answers: 1, right: 1 });
  assert.deepEqual(count('sameDay'), { key: 'sameDay', answers: 1, right: 1 });
});

test('games and recognition are not recall and are left out', () => {
  answer(ids[2], 0, true);
  answer(ids[2], 0, true, { format: 'mc' });
  answer(ids[2], 9, true, { format: 'match' });
  assert.equal(count('sameDay')?.answers, 1);
  assert.equal(count('weeks')?.answers, 1);
});

test('only the newest answers are read, so a long history stays quick', () => {
  answer(ids[3], 44, true);
  answer(ids[3], 44, true, { practice: true }); // the newest answer: a same-day repeat
  assert.deepEqual(spacingCounts(getDb(), day(45), 1), [{ key: 'sameDay', answers: 1, right: 1 }]);
  const all = spacingCounts(getDb(), day(45));
  assert.ok(all.reduce((n, c) => n + c.answers, 0) > 1);
  // An answer older than a year is outside the window.
  assert.deepEqual(spacingCounts(getDb(), day(45 + 400)), []);
});

test('the Progress data carries the report, and says nothing until there is enough', () => {
  const s = journey(getDb(), day(45)).spacing;
  assert.equal(s.groups.length, 4);
  assert.equal(s.longest, null);
});
