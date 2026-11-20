import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, readyUpdate, shouldCheck, updaterOptions } from './update-policy';

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

test('the "Update ready" note carries the release notes from the GitHub Release, as plain items', () => {
  const html =
    '<h3>Added</h3><ul><li>add a picker (<a href="x">2812206</a>)</li></ul><h3>Fixed</h3><ul><li>fix a bug</li></ul>';
  assert.deepEqual(readyUpdate({ version: '0.4.0', releaseNotes: html }), {
    version: '0.4.0',
    notes: { added: ['Add a picker'], fixed: ['Fix a bug'] },
  });
  // electron-updater gives a list when several releases were skipped: newest first, all included.
  const list = [
    { version: '0.5.0', note: '<h3>Added</h3><ul><li>newest</li></ul>' },
    { version: '0.4.0', note: '<h3>Fixed</h3><ul><li>older fix</li></ul>' },
    { version: '0.3.9', note: null },
  ];
  assert.deepEqual(readyUpdate({ version: '0.5.0', releaseNotes: list }).notes, {
    added: ['Newest'],
    fixed: ['Older fix'],
  });
  assert.deepEqual(readyUpdate({ version: '0.5.0', releaseNotes: null }).notes, { added: [], fixed: [] });
});
