import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markOnce, MARKS } from './perf';

test('a startup mark is set once, however often the screen renders', () => {
  markOnce(MARKS.homeInteractive);
  markOnce(MARKS.homeInteractive);
  assert.equal(performance.getEntriesByName(MARKS.homeInteractive, 'mark').length, 1);
});
