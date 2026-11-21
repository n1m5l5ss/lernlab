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

test('macOS is ad-hoc signed for free, with no paid Apple certificate (docs/CODE_SIGNING.md)', () => {
  // A downloaded Apple-silicon app with a broken signature is reported as "damaged"; an ad-hoc
  // signature gets the normal "Open Anyway" path instead. Hardened runtime would reject Electron's
  // own frameworks under an ad-hoc signature, and it only matters for notarisation.
  const mac: { identity?: string | null; hardenedRuntime?: boolean } = pkg.build.mac;
  assert.equal(mac.identity, '-');
  assert.equal(mac.hardenedRuntime, false);
});

test('Windows is signed by SignPath in CI, not with a certificate inside electron-builder', () => {
  const win: Record<string, unknown> = pkg.build.win;
  for (const key of [
    'certificateFile',
    'certificatePassword',
    'signtoolOptions',
    'azureSignOptions',
    'publisherName',
  ]) {
    assert.equal(win[key], undefined, key);
  }
});
