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

test('Windows installs per user without admin rights (NSIS one-click, not per machine)', () => {
  assert.deepEqual(pkg.build.win.target, ['nsis']);
  const nsis: { oneClick?: boolean; perMachine?: boolean } = pkg.build.nsis;
  assert.notEqual(nsis.oneClick, false);
  assert.notEqual(nsis.perMachine, true);
});

test('macOS gets one dmg each for Apple Silicon and Intel; Linux gets an AppImage and a deb', () => {
  assert.deepEqual(pkg.build.mac.target, [{ target: 'dmg', arch: ['arm64', 'x64'] }]);
  const mac: { artifactName?: string } = pkg.build.mac;
  assert.match(mac.artifactName ?? '', /\$\{arch\}/);
  assert.deepEqual(pkg.build.linux.target, ['AppImage', 'deb']);
});
