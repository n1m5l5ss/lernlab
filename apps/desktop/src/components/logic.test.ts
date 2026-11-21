import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cx, fieldIds, progressFraction } from './logic';
import { tabStop } from './SegmentedControl';

test('cx joins class names and skips empty ones', () => {
  assert.equal(cx('btn', false, undefined, 'primary', null, ''), 'btn primary');
  assert.equal(cx(), '');
});

test('progressFraction stays between 0 and 1 and copes with an empty range', () => {
  assert.equal(progressFraction(5, 10), 0.5);
  assert.equal(progressFraction(15, 10), 1);
  assert.equal(progressFraction(-3, 10), 0);
  assert.equal(progressFraction(3, 0), 0);
  assert.equal(progressFraction(Number.NaN, 10), 0);
  assert.equal(progressFraction(15, 20, 10), 0.5);
});

test('fieldIds names the hint and error only when they are there', () => {
  assert.deepEqual(fieldIds('x', '', null), { hintId: undefined, errorId: undefined, describedBy: undefined });
  assert.deepEqual(fieldIds('x', 'hint', null), { hintId: 'x-hint', errorId: undefined, describedBy: 'x-hint' });
  assert.equal(fieldIds('x', 'hint', 'bad').describedBy, 'x-hint x-error');
});

test('a segmented control keeps one tab stop: the chosen option, else the first', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ] as const;
  assert.equal(tabStop(options, 'b'), 'b');
  assert.equal(tabStop(options, null), 'a');
  assert.equal(tabStop([], null), undefined);
});
