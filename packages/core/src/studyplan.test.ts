// The if-then study plan (#204): cleaning what the learner types, and the usual-hour suggestion.
process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPlanMinutes, cleanPlanText, PLAN_MINUTES, PLAN_TEXT_MAX, studyPlanOf, usualStudyTime } from './studyplan';

const at = (d: number, h: number, mi = 0) => new Date(2026, 10, d, h, mi);

test('plan text is plain text: trimmed, one line, length-capped, never markup', () => {
  assert.equal(cleanPlanText('  finish   dinner '), 'finish dinner');
  assert.equal(cleanPlanText('finish\ndinner\t now'), 'finish dinner now');
  assert.equal(cleanPlanText('finish dinner.'), 'finish dinner', 'the sentence adds its own punctuation');
  assert.equal(cleanPlanText('<b>finish</b> dinner'), 'bfinish/b dinner');
  assert.equal(cleanPlanText('<script>alert(1)</script>'), 'scriptalert(1)/script');
  assert.equal(cleanPlanText('a\u0000b‮c'), 'abc', 'control and direction-override characters go');
  assert.equal(cleanPlanText('x'.repeat(500)).length, PLAN_TEXT_MAX);
  assert.equal([...cleanPlanText('😀'.repeat(200))].length, PLAN_TEXT_MAX, 'capped by characters, not halves');
  for (const bad of [undefined, null, 42, {}, ['a']]) assert.equal(cleanPlanText(bad), '');
});

test('plan minutes are one of the session lengths', () => {
  assert.deepEqual([...PLAN_MINUTES], [5, 10, 20]);
  assert.equal(cleanPlanMinutes(10), 10);
  assert.equal(cleanPlanMinutes('20'), 20);
  for (const bad of [0, 7, -5, 'ten', null, undefined, 1e9]) assert.equal(cleanPlanMinutes(bad), 5);
});

test('a plan exists only when the "after I" part is filled in', () => {
  assert.equal(studyPlanOf({ planAfter: '', planMinutes: 10, planBackup: 'tired' }), null);
  assert.deepEqual(studyPlanOf({ planAfter: ' finish dinner ', planMinutes: 10, planBackup: '' }), {
    after: 'finish dinner',
    minutes: 10,
    backup: '',
  });
  assert.deepEqual(studyPlanOf({ planAfter: 'lunch', planMinutes: 99, planBackup: "I'm tired" }), {
    after: 'lunch',
    minutes: 5,
    backup: "I'm tired",
  });
  assert.equal(studyPlanOf({}), null);
});

test('the usual study time is the hour you most often start, rounded to the nearest hour', () => {
  const starts = [at(2, 18, 50), at(3, 19, 10), at(4, 19, 20), at(5, 7, 0), at(6, 12, 0)];
  assert.equal(usualStudyTime(starts), '19:00');
  assert.equal(usualStudyTime([at(2, 23, 40), at(3, 23, 50), at(4, 0, 10)]), '00:00', 'wraps past midnight');
  assert.equal(usualStudyTime([at(2, 8), at(3, 8), at(4, 20), at(5, 20)]), '08:00', 'a tie goes to the earlier hour');
});

test('no suggestion without enough of a pattern', () => {
  assert.equal(usualStudyTime([]), null);
  assert.equal(usualStudyTime([at(2, 19), at(3, 19)]), null, 'fewer than 3 sessions');
  assert.equal(usualStudyTime([at(2, 7), at(3, 10), at(4, 13), at(5, 16), at(6, 19)]), null, 'no hour stands out');
  const spread = Array.from({ length: 12 }, (_, i) => at(1 + i, 6 + i));
  assert.equal(usualStudyTime([...spread, at(20, 9), at(21, 9)]), null, 'top hour holds too few');
  assert.equal(usualStudyTime([new Date('nonsense'), at(2, 19), at(3, 19), at(4, 19)]), '19:00');
});
