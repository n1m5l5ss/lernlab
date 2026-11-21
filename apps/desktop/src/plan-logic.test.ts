// The if-then study plan fields (#204) on Welcome and in Settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDraftOf, planPatch, planPreview, timeOfDay } from './plan-logic';

test('the fields start from the saved settings', () => {
  assert.deepEqual(planDraftOf({ planAfter: 'finish dinner', planMinutes: 10, planBackup: '' }), {
    after: 'finish dinner',
    minutes: 10,
    backup: '',
  });
});

test('the preview shows the cleaned words, and nothing until "After I…" is filled in', () => {
  assert.equal(planPreview({ after: '  ', minutes: 5, backup: 'tired' }), null);
  assert.deepEqual(planPreview({ after: ' finish  dinner. ', minutes: 20, backup: " I'm tired " }), {
    after: 'finish dinner',
    count: 20,
    backup: "I'm tired",
  });
  assert.equal(planPreview({ after: '<i>lunch</i>', minutes: 5, backup: '' })?.after, 'ilunch/i');
});

test('the patch saves the cleaned plan; Welcome saves only a plan that was filled in', () => {
  assert.deepEqual(planPatch({ after: ' lunch ', minutes: 10, backup: '' }), {
    planAfter: 'lunch',
    planMinutes: 10,
    planBackup: '',
  });
  assert.deepEqual(planPatch({ after: '', minutes: 10, backup: 'x' }), {
    planAfter: '',
    planMinutes: 10,
    planBackup: 'x',
  });
  assert.equal(planPatch({ after: '', minutes: 10, backup: 'x' }, { onlyIfFilled: true }), null);
});

test('a suggested "HH:00" becomes a local time to show', () => {
  const d = timeOfDay('19:00', new Date(2026, 10, 21, 8, 30));
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 10, 21, 19, 0]);
});
