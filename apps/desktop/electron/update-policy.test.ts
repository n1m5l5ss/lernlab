import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, shouldCheck, updaterOptions } from './update-policy';

const on = { autoUpdate: true, betaUpdates: false };
const now = Date.UTC(2026, 10, 20, 12);

test('checks at most once a day, and never when updates are off', () => {
  assert.equal(shouldCheck(on, undefined, now), true);
  assert.equal(shouldCheck(on, now - DAY_MS + 60_000, now), false);
  assert.equal(shouldCheck(on, now - DAY_MS, now), true);
  assert.equal(shouldCheck({ ...on, autoUpdate: false }, undefined, now), false);
});

test('a last check in the future (clock moved back) does not block checking', () => {
  assert.equal(shouldCheck(on, now + 3 * DAY_MS, now), true);
});

test('beta testers also get pre-releases; nobody is downgraded', () => {
  assert.deepEqual(updaterOptions(on), {
    allowPrerelease: false,
    allowDowngrade: false,
    autoDownload: true,
    autoInstallOnAppQuit: true,
  });
  const beta = updaterOptions({ ...on, betaUpdates: true });
  assert.equal('channel' in beta, false);
  assert.equal(beta.allowPrerelease, true);
  assert.equal(beta.allowDowngrade, false);
});
