import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeFor, levelFor, xpFor, settleStreak, recordSession, NEW_STREAK, dayKey } from './game';

test('recognition formats never produce an SRS grade', () => {
  assert.equal(gradeFor({ format: 'mc', correct: true, responseMs: 900, answerLength: 4, reps: 0 }), null);
  assert.equal(gradeFor({ format: 'match', correct: true, responseMs: 900, answerLength: 4, reps: 0 }), null);
});

test('grade mapping', () => {
  const base = { format: 'typed' as const, responseMs: 8000, answerLength: 8, reps: 0 };
  assert.equal(gradeFor({ ...base, correct: false }), 1);
  assert.equal(gradeFor({ ...base, correct: true, usedHint: true }), 2);
  assert.equal(gradeFor({ ...base, correct: true, nearMiss: true }), 2);
  assert.equal(gradeFor({ ...base, correct: false, articleError: true }), 2);
  assert.equal(gradeFor({ ...base, correct: true }), 3);
  assert.equal(gradeFor({ ...base, correct: true, responseMs: 1500, reps: 3 }), 4);
  assert.equal(gradeFor({ ...base, correct: true, responseMs: 1500, reps: 0 }), 3, 'new items are never Easy');
});

test('levels grow', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(100).level, 2);
  assert.ok(levelFor(5000).level > 10);
});

test('xp: errors give a token point, combos add up to +10', () => {
  assert.equal(xpFor('typed', false, 0), 1);
  assert.equal(xpFor('typed', true, 1), 15);
  assert.equal(xpFor('typed', true, 20), 25);
  assert.equal(xpFor('gender', true, 50), 3, 'arcade rounds get no combo bonus');
});

test('streak: counting, freezes, break and repair', () => {
  let s = { ...NEW_STREAK };
  s = settleStreak(s, '2026-11-20', new Set());
  s = recordSession(s, '2026-11-20', true);
  assert.equal(s.current, 1);
  s = recordSession(s, '2026-11-20', true);
  assert.equal(s.current, 1, 'a day counts once');

  // miss 21st, study 22nd: one freeze used
  s = settleStreak(s, '2026-11-22', new Set(['2026-11-20']));
  assert.equal(s.current, 1);
  assert.equal(s.freezes, 1);
  s = recordSession(s, '2026-11-22', true);
  assert.equal(s.current, 2);

  // miss 23,24,25: two freezes needed, only one left → break on the 24th, repair window to the 26th
  s = settleStreak(s, '2026-11-26', new Set(['2026-11-20', '2026-11-22']));
  assert.equal(s.current, 0);
  assert.equal(s.freezes, 0);
  assert.ok(s.repair);
  s = recordSession(s, '2026-11-26', true);
  s = recordSession(s, '2026-11-26', true);
  assert.equal(s.repair, null);
  assert.equal(s.current, 3, 'repaired streak (2) + today (1)');
});

test('day starts at 4am', () => {
  assert.equal(dayKey(new Date(2026, 10, 21, 2, 0)), '2026-11-20');
  assert.equal(dayKey(new Date(2026, 10, 21, 5, 0)), '2026-11-21');
});
