import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_SELECTOR, isSmokeTest, waitFor } from './smoke';

test('smoke mode is on only with the --smoke-test flag', () => {
  assert.equal(isSmokeTest(['/opt/LernLab/lernlab', '--smoke-test']), true);
  assert.equal(isSmokeTest(['/opt/LernLab/lernlab']), false);
  assert.equal(isSmokeTest(['/opt/LernLab/lernlab', 'deck-smoke-test.csv']), false);
});

test('Home is recognised by its session panel', () => {
  assert.equal(HOME_SELECTOR, '.home .home-session');
});

test('waitFor resolves true as soon as the check passes', async () => {
  let calls = 0;
  const ok = await waitFor(async () => ++calls === 3, { timeoutMs: 1000, intervalMs: 1 });
  assert.equal(ok, true);
  assert.equal(calls, 3);
});

test('waitFor gives up after the timeout, and a throwing check counts as not yet', async () => {
  const start = Date.now();
  const ok = await waitFor(
    async () => {
      throw new Error('page not ready');
    },
    { timeoutMs: 30, intervalMs: 5 },
  );
  assert.equal(ok, false);
  assert.ok(Date.now() - start >= 30);
});
