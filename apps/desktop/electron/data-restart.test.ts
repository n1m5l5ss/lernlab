import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RESTARTS, planRestart, STABLE_MS } from './data-restart';

test('a crash loop backs off and then gives up', () => {
  const delays: number[] = [];
  let crashes = 0;
  for (;;) {
    const next = planRestart(crashes, 100);
    if (!next) break;
    delays.push(next.delayMs);
    crashes = next.crashes;
  }
  assert.deepEqual(delays, [500, 1000, 2000, 4000, 8000]);
  assert.equal(delays.length, MAX_RESTARTS);
});

test('a process that ran for a while starts the count again', () => {
  assert.deepEqual(planRestart(MAX_RESTARTS, STABLE_MS), { delayMs: 500, crashes: 1 });
  assert.equal(planRestart(MAX_RESTARTS, STABLE_MS - 1), null);
});
