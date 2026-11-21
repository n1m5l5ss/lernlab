// Electron security checklist items that live in config, not code (docs/SECURITY-PRACTICES.md):
// a Content Security Policy for the app page, and fuses baked into the packaged app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json';

const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1] ?? '';
const directive = (name: string) =>
  csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? [];

test('the app page has a Content Security Policy that denies by default', () => {
  assert.deepEqual(directive('default-src'), ["'none'"]);
  assert.deepEqual(directive('object-src'), ["'none'"]);
  assert.deepEqual(directive('base-uri'), ["'none'"]);
});

test('only the app’s own scripts run: no inline script, no eval, nothing remote', () => {
  assert.deepEqual(directive('script-src'), ["'self'"]);
  assert.ok(!csp.includes('unsafe-eval'));
});

test('the page talks only to itself: no fetch to the internet from a card', () => {
  assert.deepEqual(directive('connect-src'), ["'self'"]);
  assert.deepEqual(directive('frame-src'), ["'none'"]);
});

test('packaged app fuses: no Node mode, no NODE_OPTIONS or --inspect, only the signed-off app.asar', () => {
  assert.deepEqual(pkg.build.electronFuses, {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
  });
});
