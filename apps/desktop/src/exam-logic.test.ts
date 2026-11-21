import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clock, reviewRows, secondsLeft, toggleChoice } from './exam-logic';

test('the exam clock counts the whole exam down and never goes below zero', () => {
  const start = 1_000_000;
  assert.equal(secondsLeft(start, 30, start), 1800);
  assert.equal(secondsLeft(start, 30, start + 61_500), 1739);
  assert.equal(secondsLeft(start, 1, start + 120_000), 0);
  assert.equal(clock(1739), '28:59');
  assert.equal(clock(5), '0:05');
  assert.equal(clock(3725), '1:02:05');
});

test('one answer replaces the choice; several answers toggle', () => {
  assert.deepEqual(toggleChoice([1], 2, false), [2]);
  assert.deepEqual(toggleChoice([1], 2, true), [1, 2]);
  assert.deepEqual(toggleChoice([1, 2], 1, true), [2]);
});

test('the review lists each question as answered, open or flagged, and filters them', () => {
  const qs = [{ itemId: 1 }, { itemId: 2 }, { itemId: 3 }];
  const answers = { 1: [0], 2: [] };
  const flags = new Set([3]);
  assert.deepEqual(reviewRows(qs, answers, flags, 'all'), [
    { index: 0, answered: true, flagged: false },
    { index: 1, answered: false, flagged: false },
    { index: 2, answered: false, flagged: true },
  ]);
  assert.deepEqual(
    reviewRows(qs, answers, flags, 'flagged').map((r) => r.index),
    [2],
  );
  assert.deepEqual(
    reviewRows(qs, answers, flags, 'open').map((r) => r.index),
    [1, 2],
  );
});
