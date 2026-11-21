import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSystem, recommendedDownloads } from './detect';

const UA = {
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  ubuntuFirefox: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromebook:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

test('desktop systems from the user agent', () => {
  assert.deepEqual(detectSystem({ userAgent: UA.windowsChrome }), { system: 'windows' });
  assert.deepEqual(detectSystem({ userAgent: UA.windowsFirefox, platform: 'Win32' }), { system: 'windows' });
  assert.deepEqual(detectSystem({ userAgent: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 0 }), {
    system: 'mac',
  });
  assert.deepEqual(detectSystem({ userAgent: UA.linuxFirefox }), { system: 'linux' });
  assert.deepEqual(detectSystem({ userAgent: UA.ubuntuFirefox, platform: 'Linux x86_64' }), { system: 'linux' });
});

test("Chromium's client hints tell a Mac's chip", () => {
  const mac = { userAgent: UA.macChrome, platform: 'macOS', mobile: false };
  assert.deepEqual(detectSystem({ ...mac, architecture: 'arm' }), { system: 'mac', arch: 'arm64' });
  assert.deepEqual(detectSystem({ ...mac, architecture: 'x86' }), { system: 'mac', arch: 'x64' });
  // Client hints say "Windows" even when the user agent is frozen or reduced.
  assert.deepEqual(detectSystem({ userAgent: 'Mozilla/5.0', platform: 'Windows' }), { system: 'windows' });
});

test('phones, tablets and Chromebooks get no installer', () => {
  assert.equal(detectSystem({ userAgent: UA.android }).system, 'mobile');
  assert.equal(detectSystem({ userAgent: UA.iphone }).system, 'mobile');
  assert.equal(detectSystem({ userAgent: UA.android, platform: 'Android', mobile: true }).system, 'mobile');
  // iPadOS Safari says it is a Mac; the touch screen gives it away.
  assert.equal(detectSystem({ userAgent: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 5 }).system, 'mobile');
  assert.equal(detectSystem({ userAgent: UA.chromebook }).system, 'other');
  assert.equal(detectSystem({ userAgent: '' }).system, 'other');
});

test('a Darwin user agent is a Mac, not Windows', () => {
  assert.equal(detectSystem({ userAgent: 'CFNetwork/1490 Darwin/23.0.0' }).system, 'mac');
});

test('which downloads to highlight', () => {
  assert.deepEqual(recommendedDownloads({ system: 'windows' }), ['windows']);
  assert.deepEqual(recommendedDownloads({ system: 'mac', arch: 'arm64' }), ['mac-arm64']);
  assert.deepEqual(recommendedDownloads({ system: 'mac', arch: 'x64' }), ['mac-x64']);
  assert.deepEqual(recommendedDownloads({ system: 'mac' }), ['mac-arm64', 'mac-x64']);
  assert.deepEqual(recommendedDownloads({ system: 'linux' }), ['linux-appimage', 'linux-deb']);
  assert.deepEqual(recommendedDownloads({ system: 'mobile' }), []);
  assert.deepEqual(recommendedDownloads({ system: 'other' }), []);
});
