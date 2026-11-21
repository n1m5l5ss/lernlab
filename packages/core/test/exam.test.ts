// Exam simulator (#43): questions come from the user's own deck, and an exam never touches the schedule.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-exam-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { recordAttempt } = await import('../src/learn');
const { createDeck, updateDeck } = await import('../src/library');
const { buildExam, recordExam } = await import('../src/examplan');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const csv = [
  'front,back,tags,type,choices,correct,explanation',
  'Object storage?,S3,storage,,,,',
  'Block storage?,EBS,storage,,,,',
  'File storage?,EFS,storage,,,,',
  'Users and roles?,IAM,security,,,,',
  'Pick TWO serverless services,,compute,mcq,Lambda|EC2|Fargate|EBS,1|3,Both run code without servers to manage.',
  'Which is a database?,DynamoDB,,,,,',
].join('\n');
const { deck } = importFile('Cloud.csv', strToU8(`${csv}\n`));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const at = new Date(2026, 10, 24, 10);

test('an exam asks multiple-choice questions from the deck, with tags as topics', () => {
  const exam = buildExam(deck.id, getDb());
  assert.equal(exam.questions.length, 6, 'the whole deck when it is smaller than the question count');
  assert.equal(exam.settings.questions, 20);
  for (const q of exam.questions) {
    assert.ok(q.choices.length >= 2 && q.correct.length >= 1);
    assert.ok(q.correct.every((i) => i >= 0 && i < q.choices.length));
  }
  const multi = exam.questions.find((q) => q.correct.length === 2)!;
  assert.deepEqual(multi.correct.map((i) => multi.choices[i]).sort(), ['Fargate', 'Lambda']);
  assert.match(multi.explanation, /without servers/);
  assert.deepEqual(multi.topics, ['compute']);
  const basic = exam.questions.find((q) => q.stem === 'Object storage?')!;
  assert.equal(basic.choices[basic.correct[0]], 'S3');

  updateDeck(deck.id, { settings: { exam: { questions: 3, minutes: 5, passMark: 80 } } });
  const short = buildExam(deck.id, getDb());
  assert.equal(short.questions.length, 3);
  assert.deepEqual(short.settings, { questions: 3, minutes: 5, passMark: 80 });
  assert.equal(new Set(short.questions.map((q) => q.itemId)).size, 3, 'no question twice');
});

test('handing in an exam scores it and logs practice attempts that never change the schedule', () => {
  recordAttempt(
    { sessionId: 's', itemId: ids[0], format: 'intro', correct: true, responseMs: 1000, xp: 0 },
    getDb(),
    at,
  );
  const before = getDb().prepare('SELECT card, due, last_graded_day FROM srs').all();
  const exam = buildExam(deck.id, getDb());
  const [first, second] = exam.questions;
  const score = recordExam(
    exam.id,
    exam.questions,
    [
      { itemId: first.itemId, chosen: first.correct, ms: 4000 },
      { itemId: second.itemId, chosen: [], ms: 1000 },
    ],
    exam.settings.passMark,
    getDb(),
    at,
  );
  assert.equal(score.total, 3);
  assert.equal(score.correct, 1);
  assert.equal(score.unanswered, 2);
  assert.equal(score.passed, false);
  assert.deepEqual(getDb().prepare('SELECT card, due, last_graded_day FROM srs').all(), before, 'FSRS untouched');
  const logged = getDb().prepare('SELECT practice, grade, correct FROM attempts WHERE session_id = ?').all(exam.id);
  assert.equal(logged.length, 3, 'every question is logged, answered or not');
  assert.ok(logged.every((r) => r.practice === 1 && r.grade === null));
});

test('an empty deck gives an empty exam', () => {
  assert.equal(buildExam(createDeck('Empty').id, getDb()).questions.length, 0);
});
