import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanExamSettings, EXAM_DEFAULTS, examSettings, isRight, scoreExam, type ExamQuestion } from './exam';

const q = (itemId: number, correct: number[], topics: string[]): ExamQuestion => ({
  itemId,
  stem: `Q${itemId}`,
  choices: ['a', 'b', 'c', 'd'],
  correct,
  explanation: '',
  topics,
});

test('exam settings fall back to defaults and stay in range', () => {
  assert.deepEqual(examSettings(undefined), EXAM_DEFAULTS);
  assert.deepEqual(examSettings({ questions: 0, minutes: 9999, passMark: 150 }), {
    questions: 1,
    minutes: 300,
    passMark: 100,
  });
  assert.deepEqual(cleanExamSettings({ questions: '12', minutes: 'x', passMark: 65.4, other: 1 }), {
    questions: 12,
    passMark: 65,
  });
  assert.equal(cleanExamSettings(null), undefined);
});

test('a multi-select answer is right only when every correct choice and nothing else is picked', () => {
  assert.equal(isRight(q(1, [0, 2], []), [2, 0]), true);
  assert.equal(isRight(q(1, [0, 2], []), [0]), false);
  assert.equal(isRight(q(1, [0, 2], []), [0, 1, 2]), false);
  assert.equal(isRight(q(1, [3], []), []), false);
});

test('the score is split by topic (tag) and weak areas are the topics under the pass mark', () => {
  const questions = [q(1, [0], ['s3', 'storage']), q(2, [1], ['s3']), q(3, [2], ['iam']), q(4, [3], [])];
  const s = scoreExam(questions, { 1: [0], 2: [0], 3: [2] }, 70);
  assert.equal(s.correct, 2);
  assert.equal(s.total, 4);
  assert.equal(s.unanswered, 1);
  assert.equal(s.percent, 50);
  assert.equal(s.passed, false);
  assert.deepEqual(
    s.topics.map((t) => [t.topic, t.correct, t.total, t.percent]),
    [
      ['', 0, 1, 0],
      ['s3', 1, 2, 50],
      ['iam', 1, 1, 100],
      ['storage', 1, 1, 100],
    ],
  );
  assert.deepEqual(s.weak, ['', 's3']);
  assert.equal(scoreExam(questions, { 1: [0], 2: [1], 3: [2] }, 70).passed, true);
  assert.equal(scoreExam([], {}, 70).percent, 0);
});
