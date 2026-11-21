import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast } from './contrast';
import { PAIR_GROUPS, ratio } from './contrast-pairs';

for (const theme of ['light', 'dark'] as const)
  for (const { what, min, pairs } of PAIR_GROUPS)
    test(`${theme}: ${what} reach ${min}:1`, () => {
      const low = pairs
        .map((pair) => ({ pair: `${pair[0]} on ${pair[1]}`, ratio: ratio(theme, pair) }))
        .filter((p) => p.ratio < min)
        .map((p) => `${p.pair} is ${p.ratio.toFixed(2)}:1`);
      assert.deepEqual(low, []);
    });

test('contrast matches the WCAG reference values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.equal(contrast('rgba(0,0,0,0.5)', '#FFFFFF').toFixed(2), contrast('#808080', '#FFFFFF').toFixed(2));
});
