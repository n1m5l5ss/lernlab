import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatColumn, heatLevel, heatmapWeeks, levelMix, monthStarts, recallRate } from './progress-logic';

test('heat levels follow session lengths; a studied day is never level 0', () => {
  assert.equal(heatLevel(0, false), 0);
  assert.equal(heatLevel(0, true), 1);
  assert.equal(heatLevel(5, true), 1);
  assert.equal(heatLevel(10, true), 2);
  assert.equal(heatLevel(25, true), 3);
});

test('the calendar is whole weeks from Monday, with future days marked', () => {
  const weeks = heatmapWeeks('2026-11-09', '2026-11-25', [
    { day: '2026-11-10', minutes: 12 },
    { day: '2026-11-25', minutes: 4 },
  ]);
  assert.equal(weeks.length, 3);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[0][0].day, '2026-11-09');
  assert.equal(weeks[0][1].level, 2);
  assert.equal(weeks[2][2].day, '2026-11-25');
  assert.equal(weeks[2][2].level, 1);
  assert.equal(weeks[2][2].future, false);
  assert.equal(weeks[2][3].future, true);
  assert.equal(weeks[2][6].day, '2026-11-29');
});

test('month labels go where the 1st of a month falls', () => {
  const weeks = heatmapWeeks('2026-11-23', '2026-12-08', []);
  assert.deepEqual(monthStarts(weeks), [{ column: 1, day: '2026-12-01' }]);
});

test('a week without reviews has no rate', () => {
  assert.equal(recallRate({ reviews: 0, recalled: 0 }), null);
  assert.equal(recallRate({ reviews: 4, recalled: 3 }), 0.75);
});

test('the study-days calendar runs the way the language reads: right to left puts today on the left', () => {
  assert.equal(heatColumn(0, 52, 'ltr'), 0);
  assert.equal(heatColumn(51, 52, 'ltr'), 51);
  assert.equal(heatColumn(0, 52, 'rtl'), 51);
  assert.equal(heatColumn(51, 52, 'rtl'), 0);
});

test('question levels: shares of the answers, and a gentle hint only when nearly all of them are recall', () => {
  const mix = levelMix({ recall: 6, apply: 3, analyse: 1 });
  assert.deepEqual(mix.shares, [
    { level: 'recall', share: 0.6 },
    { level: 'apply', share: 0.3 },
    { level: 'analyse', share: 0.1 },
  ]);
  assert.equal(mix.mostlyRecall, false);
  assert.equal(levelMix({ recall: 17, apply: 2, analyse: 1 }).mostlyRecall, true);
  assert.equal(levelMix({ recall: 4, apply: 1, analyse: 0 }).mostlyRecall, false, 'too few answers to say');
  assert.deepEqual(
    levelMix({ recall: 0, apply: 0, analyse: 0 }).shares.map((s) => s.share),
    [0, 0, 0],
  );
});
