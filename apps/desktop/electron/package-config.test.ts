// Installer settings that auto-update depends on (electron/updates.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pkg from '../package.json';

test('installer names have no spaces, so latest*.yml matches the files on GitHub', () => {
  // GitHub turns spaces in asset names into dots, but latest.yml names the file with dashes.
  // electron-builder's default, "${productName} Setup ${version}.${ext}", has spaces.
  assert.match(pkg.build.nsis.artifactName ?? '', /^\S+\.\$\{ext\}$/);
});

test('updates come from this repository, and beta builds publish latest*.yml too', () => {
  assert.deepEqual(pkg.build.publish, [{ provider: 'github', owner: 'n1m5l5ss', repo: 'lernlab' }]);
  assert.equal(pkg.build.detectUpdateChannel, false);
});
