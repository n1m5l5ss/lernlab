import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPACING, spacingGroup, spacingReport } from './spacing';

test('answers are grouped by how long the card was away', () => {
  assert.deepEqual([0, 1, 6, 7, 29, 30, 400].map(spacingGroup), [
    'sameDay',
    'days',
    'days',
    'weeks',
    'weeks',
    'months',
    'months',
  ]);
});

test('a group shows its share only with enough answers behind it', () => {
  const r = spacingReport([
    { key: 'sameDay', answers: 40, right: 38 },
    { key: 'weeks', answers: SPACING.minAnswers, right: 17 },
    { key: 'months', answers: SPACING.minAnswers - 1, right: 19 },
  ]);
  assert.deepEqual(
    r.groups.map((g) => [g.key, g.answers, g.rate]),
    [
      ['sameDay', 40, 0.95],
      ['days', 0, null],
      ['weeks', 20, 0.85],
      ['months', 19, null],
    ],
  );
  assert.deepEqual(r.longest, { key: 'weeks', answers: 20, right: 17, rate: 0.85 });
  assert.equal(r.sameDay?.rate, 0.95);
});

test('nothing is claimed before there are reviews after a real gap', () => {
  const none = spacingReport([]);
  assert.equal(none.longest, null);
  assert.equal(none.sameDay, null);
  // Plenty of same-day repeats alone say nothing about what lasts.
  assert.equal(spacingReport([{ key: 'sameDay', answers: 500, right: 480 }]).longest, null);
  assert.equal(spacingReport([{ key: 'days', answers: 19, right: 19 }]).longest, null);
  assert.equal(spacingReport([{ key: 'months', answers: 30, right: 24 }]).longest?.key, 'months');
});
