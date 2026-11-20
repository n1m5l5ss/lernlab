import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseVersion } from './release-version';

test('a stable tag must match the version in package.json', () => {
  assert.deepEqual(releaseVersion('v1.2.3', '1.2.3'), { ok: true, version: '1.2.3' });
  const r = releaseVersion('v1.2.4', '1.2.3');
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /1\.2\.3/);
});

test('a beta tag leads up to a newer version than package.json', () => {
  assert.deepEqual(releaseVersion('v1.3.0-beta.2', '1.2.3'), { ok: true, version: '1.3.0-beta.2' });
  assert.deepEqual(releaseVersion('v1.2.4-beta.1', '1.2.3'), { ok: true, version: '1.2.4-beta.1' });
  assert.deepEqual(releaseVersion('v2.0.0-rc.1', '1.9.9'), { ok: true, version: '2.0.0-rc.1' });
  // A pre-release of the version already released (or an older one) would sort before it.
  assert.equal(releaseVersion('v1.2.3-beta.1', '1.2.3').ok, false);
  assert.equal(releaseVersion('v1.2.2-beta.1', '1.2.3').ok, false);
});

test('versions compare as numbers, not text', () => {
  assert.equal(releaseVersion('v1.10.0-beta.1', '1.9.0').ok, true);
  assert.equal(releaseVersion('v1.9.0-beta.1', '1.10.0').ok, false);
});

test('tags that are not vX.Y.Z or vX.Y.Z-pre are refused', () => {
  for (const tag of [
    '1.2.3',
    'v1.2',
    'v1.2.3.4',
    'v01.2.3',
    'version-1',
    'v1.2.3-',
    'v1.2.3+build',
    'refs/tags/v1.2.3',
  ])
    assert.equal(releaseVersion(tag, '1.2.3').ok, false, tag);
});
