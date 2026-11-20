import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectClick, visibleRange } from './browse-logic';

test('only the rows in view (plus a margin) are drawn', () => {
  assert.deepEqual(visibleRange(0, 440, 44, 10_000, 5), { start: 0, end: 15 });
  assert.deepEqual(visibleRange(44 * 5000, 440, 44, 10_000, 5), { start: 4995, end: 5015 });
  assert.deepEqual(visibleRange(44 * 9999, 440, 44, 10_000, 5), { start: 9994, end: 10_000 });
  assert.deepEqual(visibleRange(0, 440, 44, 3, 5), { start: 0, end: 3 });
});

test('click toggles one card; shift-click selects the run since the last click', () => {
  const ids = [10, 11, 12, 13, 14];
  let sel = selectClick(new Set(), ids, 1, null, false);
  assert.deepEqual([...sel], [11]);
  sel = selectClick(sel, ids, 3, 1, true);
  assert.deepEqual([...sel].sort(), [11, 12, 13]);
  sel = selectClick(sel, ids, 2, 3, false);
  assert.deepEqual([...sel].sort(), [11, 13]);
  sel = selectClick(sel, ids, 0, null, true);
  assert.deepEqual([...sel].sort(), [10, 11, 13], 'shift without an anchor acts like a click');
});
