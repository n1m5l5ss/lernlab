// Exam simulator (#43): questions come from the user's own deck. Timed exams never touch the schedule;
// tutor-mode answers count like normal study (owner's decision, Nov 21 2026).
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
const { createDeck, updateDeck, upsertCards } = await import('../src/library');
const { buildExam, recordExam } = await import('../src/examplan');
const { getDb } = await import('../src/db');
const { dayKey } = await import('../src/game');
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
    'timed',
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
  assert.equal(score.reviewed, 0);
});

test('a card with question variants is asked in one of its wordings, with its level, and logged with it', () => {
  const pharma = createDeck('Pharma', null);
  upsertCards(pharma, [
    { front: 'Beta blocker', back: 'propranolol', variants: 'apply: Angina & asthma? | analyse: Dose doubles?' },
    { front: 'Statin', back: 'atorvastatin' },
    { front: 'ACE inhibitor', back: 'ramipril' },
  ]);
  const beta = Number(getDb().prepare("SELECT id FROM items WHERE target = 'Beta blocker'").get()!.id);
  const stems = new Set<string>();
  for (let i = 0; i < 40 && stems.size < 3; i++) {
    const q = buildExam(pharma.id, getDb()).questions.find((x) => x.itemId === beta)!;
    stems.add(`${q.level ?? 'own'}:${q.stem}`);
    assert.equal(q.choices[q.correct[0]], 'propranolol', 'the answer stays the same');
  }
  assert.deepEqual([...stems].sort(), ['analyse:Dose doubles?', 'apply:Angina &amp; asthma?', 'own:Beta blocker']);
  const exam = buildExam(pharma.id, getDb());
  const asked = exam.questions.map((q) => ({ ...q, level: 'apply' as const }));
  recordExam(exam.id, asked, [], 70, 'timed', getDb(), at);
  const levels = getDb().prepare('SELECT level FROM attempts WHERE session_id = ?').all(exam.id);
  assert.ok(levels.length === 3 && levels.every((r) => r.level === 'apply'));
});

test('an empty deck gives an empty exam', () => {
  assert.equal(buildExam(createDeck('Empty').id, getDb()).questions.length, 0);
});

/* ── Tutor mode counts like normal study; timed mode stays practice ── */

const tutorCsv = [
  'front,back,tags,type,choices,correct,explanation',
  'Which is object storage?,,storage,mcq,S3|EBS|EFS,1,',
  'Which runs containers?,,compute,mcq,ECS|S3|IAM,1,',
  'Which is serverless?,,compute,mcq,Lambda|EC2|EBS,1,',
  'Users and roles?,IAM,security,,,,',
  'Content delivery?,CloudFront,network,,,,',
].join('\n');
const tutor = importFile('Tutor.csv', strToU8(`${tutorCsv}\n`)).deck;
const [s3, ecs, lambda, iam] = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY ord')
  .all(tutor.id)
  .map((r) => Number(r.id));
const day1 = new Date(2026, 10, 25, 10);
const srsOf = (id: number) =>
  getDb().prepare('SELECT card, due, reps, last_graded_day FROM srs WHERE item_id = ?').get(id);
const takeExam = (mode: 'tutor' | 'timed', pick: Record<number, 'right' | 'wrong'>, now: Date) => {
  const exam = buildExam(tutor.id, getDb());
  const answers = exam.questions
    .filter((q) => pick[q.itemId])
    .map((q) => ({
      itemId: q.itemId,
      chosen: pick[q.itemId] === 'right' ? q.correct : [q.correct[0] === 0 ? 1 : 0],
      ms: 3000,
    }));
  const score = recordExam(exam.id, exam.questions, answers, exam.settings.passMark, mode, getDb(), now);
  const logged = getDb()
    .prepare('SELECT item_id, format, grade, practice FROM attempts WHERE session_id = ?')
    .all(exam.id)
    .map((r) => ({ item: Number(r.item_id), format: r.format, grade: r.grade, practice: Number(r.practice) }));
  return { score, log: (id: number) => logged.find((r) => r.item === id)! };
};

test('a timed exam never grades a card, even a question card', () => {
  const { score, log } = takeExam('timed', { [s3]: 'right', [ecs]: 'right' }, day1);
  assert.equal(score.reviewed, 0);
  assert.equal(srsOf(s3), undefined, 'not introduced');
  assert.deepEqual(log(s3), { item: s3, format: 'mcq', grade: null, practice: 1 });
});

test('a tutor answer on a question card schedules it, like a normal session', () => {
  recordAttempt(
    { sessionId: 's', itemId: iam, format: 'intro', correct: true, responseMs: 1000, xp: 0 },
    getDb(),
    day1,
  );
  const iamBefore = srsOf(iam);
  const { score, log } = takeExam('tutor', { [s3]: 'right', [ecs]: 'wrong', [iam]: 'right' }, day1);
  assert.equal(score.reviewed, 2);
  assert.deepEqual(log(s3), { item: s3, format: 'mcq', grade: 3, practice: 0 }, 'right = Good');
  assert.deepEqual(log(ecs), { item: ecs, format: 'mcq', grade: 1, practice: 0 }, 'wrong = Again');
  const s3Srs = srsOf(s3)!;
  assert.equal(Number(s3Srs.reps), 1);
  assert.equal(s3Srs.last_graded_day, dayKey(day1));
  assert.ok(new Date(s3Srs.due as string) > day1, 'comes back later');
  assert.deepEqual(log(lambda), { item: lambda, format: 'mcq', grade: null, practice: 1 }, 'skipped is no attempt');
  assert.equal(srsOf(lambda), undefined);
  assert.deepEqual(log(iam), { item: iam, format: 'mc', grade: null, practice: 0 }, 'recognition never grades');
  assert.deepEqual(srsOf(iam), iamBefore);
});

test('a second tutor answer the same day does not grade the card again', () => {
  const before = srsOf(s3);
  const { score, log } = takeExam('tutor', { [s3]: 'wrong' }, new Date(day1.getTime() + 3600_000));
  assert.equal(score.reviewed, 0);
  assert.deepEqual(log(s3), { item: s3, format: 'mcq', grade: null, practice: 0 });
  assert.deepEqual(srsOf(s3), before, 'once per card per day');
});

test("a tutor exam never introduces more new cards than the deck's limit for today", () => {
  updateDeck(tutor.id, { settings: { newPerDay: 2 } });
  const { log } = takeExam('tutor', { [lambda]: 'right' }, new Date(day1.getTime() + 7200_000));
  assert.equal(log(lambda).practice, 1, 'two new cards were already introduced today');
  assert.equal(srsOf(lambda), undefined);
  const next = takeExam('tutor', { [lambda]: 'right' }, new Date(day1.getTime() + 86_400_000));
  assert.equal(next.log(lambda).grade, 3, 'the next day it counts');
});
