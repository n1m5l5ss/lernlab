import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInstalled, licenceUrl, sizeParts, SUBMIT_DECK_URL } from './gallery-logic';

test('share your deck opens the deck submission form', () => {
  assert.equal(SUBMIT_DECK_URL, 'https://github.com/n1m5l5ss/lernlab/issues/new?template=deck_submission.yml');
});

test('a single SPDX id links to its licence page; expressions do not', () => {
  assert.equal(licenceUrl('CC-BY-4.0'), 'https://spdx.org/licenses/CC-BY-4.0.html');
  assert.equal(licenceUrl('MIT OR CC0-1.0'), null);
  assert.equal(licenceUrl('LicenseRef-mine'), null);
});

test('installed means a deck with the same title, ignoring case and spaces', () => {
  assert.equal(isInstalled('German colours', [{ name: ' german Colours' }]), true);
  assert.equal(isInstalled('German colours', [{ name: 'German' }]), false);
});

test('sizes are rounded to kB or MB', () => {
  assert.deepEqual(sizeParts(100), { unit: 'kilobyte', value: 1 });
  assert.deepEqual(sizeParts(24_353), { unit: 'kilobyte', value: 24 });
  assert.deepEqual(sizeParts(3.25 * 1024 * 1024), { unit: 'megabyte', value: 3.3 });
});
