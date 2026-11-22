import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardToItem } from '@lernlab/core/library';
import { worked } from '@lernlab/core/exercises';
import {
  countRight,
  currentStep,
  isDone,
  modeOf,
  skipStep,
  stepView,
  submitStep,
  workedAnswer,
  workedKey,
  workedStart,
} from './worked-logic';

const item = cardToItem(
  { id: 1, name: 'D', language: null },
  {
    front: 'Solve 2x + 3 = 11',
    back: 'x = 4',
    type: 'worked',
    workedSteps: 'Subtract 3 :: 2x = 8|Divide by 2 :: x = 4|Check :: 11',
  },
)!;
const ex = (rung: number) => worked({ ...item, rung });

test('the full example is only studied: every step shows, and finishing is practice that counts as done', () => {
  const s = workedStart();
  assert.equal(modeOf(ex(0)), 'study');
  assert.ok(isDone(ex(0), s));
  assert.deepEqual(
    [0, 1, 2].map((i) => stepView(ex(0), s, i)),
    ['given', 'given', 'given'],
  );
  assert.deepEqual(workedAnswer(ex(0), s), {
    format: 'ladder',
    practice: true,
    correct: true,
    nearMiss: false,
    given: '',
  });
});

test('a faded rung shows the first steps and asks the last ones in order; it is practice', () => {
  let s = workedStart();
  assert.equal(modeOf(ex(2)), 'fade');
  assert.equal(currentStep(ex(2), s), 1);
  assert.deepEqual(
    [0, 1, 2].map((i) => stepView(ex(2), s, i)),
    ['given', 'ask', 'later'],
  );
  assert.deepEqual(submitStep(ex(2), { ...s, input: '  ' }).results, [], 'nothing typed: nothing happens');
  s = submitStep(ex(2), { ...s, input: 'x=4' });
  assert.deepEqual([stepView(ex(2), s, 1), stepView(ex(2), s, 2), s.input], ['right', 'ask', '']);
  s = submitStep(ex(2), { ...s, input: '12' });
  assert.equal(stepView(ex(2), s, 2), 'wrong');
  assert.ok(isDone(ex(2), s));
  assert.deepEqual(workedAnswer(ex(2), s), {
    format: 'ladder',
    practice: true,
    correct: false,
    nearMiss: false,
    given: 'x=4 | 12',
  });
  assert.equal(submitStep(ex(2), { ...s, input: '11' }).results.length, 2, 'no step left');
});

test('the whole problem is the real recall; "I don\'t know" and "I was right" change one step', () => {
  let s = workedStart();
  assert.equal(modeOf(ex(3)), 'whole');
  s = submitStep(ex(3), { ...s, input: '2x = 8' });
  s = skipStep(ex(3), s);
  assert.equal(stepView(ex(3), s, 1), 'wrong');
  s = submitStep(ex(3), { ...s, input: '11.0' });
  assert.equal(workedAnswer(ex(3), s).correct, false);
  s = countRight(s, 1);
  assert.equal(stepView(ex(3), s, 1), 'right');
  assert.deepEqual(workedAnswer(ex(3), s), {
    format: 'worked',
    practice: false,
    correct: true,
    nearMiss: false,
    given: '2x = 8 |  | 11.0',
  });
});

test('keys: Enter checks a step from its box and continues at the end, but never on a button', () => {
  const s = workedStart();
  assert.equal(workedKey(ex(3), s, { key: 'Enter', onButton: false }), 'check');
  assert.equal(workedKey(ex(3), s, { key: 'Enter', onButton: true }), null);
  assert.equal(workedKey(ex(0), s, { key: 'Enter', onButton: false }), 'finish');
  assert.equal(workedKey(ex(0), s, { key: 'a', onButton: false }), null);
});
