import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEEK_GOAL, weekCardTarget, weekSessionTarget } from './weekgoal';

const base = { left: 100, done: 0, examDate: null, week: '2026-11-23', perWeek: 0, newPerDay: 10 };

test('with an exam date, the cards left are spread over the weeks until the exam', () => {
  // Monday 23 November to Sunday 20 December: 4 weeks.
  assert.equal(weekCardTarget({ ...base, examDate: '2026-12-20' }), 25);
  assert.equal(weekCardTarget({ ...base, examDate: '2026-12-21' }), 20, 'a 5th week has started');
  assert.equal(weekCardTarget({ ...base, left: 30, examDate: '2026-11-27' }), 30, 'exam this week: all of it');
});

test('the goal is fixed for the week: cards learned since Monday count toward it, not against it', () => {
  const monday = weekCardTarget({ ...base, examDate: '2026-12-20' });
  assert.equal(weekCardTarget({ ...base, left: 88, done: 12, examDate: '2026-12-20' }), monday);
});

test('a missed week is not owed: what is left is simply spread over the weeks that remain', () => {
  // Nothing learned last week: the same 100 cards, now over 3 weeks.
  assert.equal(weekCardTarget({ ...base, week: '2026-11-30', examDate: '2026-12-20' }), 34);
});

test('the goal never asks for more than the new cards per day allow', () => {
  assert.equal(weekCardTarget({ ...base, left: 900, examDate: '2026-12-20' }), 70);
  assert.equal(weekCardTarget({ ...base, newPerDay: 0, examDate: '2026-12-20' }), 0, 'no new cards: no card goal');
});

test('without an exam date the goal follows your own pace, with a small floor', () => {
  assert.equal(weekCardTarget(base), WEEK_GOAL.minCards);
  assert.equal(weekCardTarget({ ...base, perWeek: 22.5 }), 23);
  assert.equal(weekCardTarget({ ...base, left: 4 }), 4, 'never more than what is left');
  assert.equal(weekCardTarget({ ...base, left: 0, done: 0 }), 0, 'all learned: nothing to ask');
  assert.equal(weekCardTarget({ ...base, examDate: '2026-11-01', perWeek: 12 }), 12, 'a past exam date is ignored');
  assert.equal(weekCardTarget({ ...base, examDate: 'soon' }), WEEK_GOAL.minCards, 'so is a broken one');
});

test('sessions: one more than your recent average, between 3 and 7', () => {
  assert.equal(weekSessionTarget([]), 3);
  assert.equal(weekSessionTarget([0, 0, 0, 0]), 3);
  assert.equal(weekSessionTarget([4, 4, 5, 3]), 5);
  assert.equal(weekSessionTarget([2, 0, 0, 0]), 3, 'a quiet month lowers the goal; nothing is owed');
  assert.equal(weekSessionTarget([9, 12, 7, 10]), 7);
});
