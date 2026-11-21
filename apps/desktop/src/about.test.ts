import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBRARIES, ONLINE_CASES } from './about';
import en from '../../../locales/en.json';

const MODULES = join(import.meta.dirname, '../../../node_modules');

test('the About list names the licence each bundled library really has', () => {
  assert.ok(LIBRARIES.length >= 5);
  for (const lib of LIBRARIES) {
    const pkg = JSON.parse(readFileSync(join(MODULES, lib.pkg, 'package.json'), 'utf8'));
    assert.equal(lib.licence, pkg.license, lib.pkg);
  }
});

test('Settings lists exactly the three cases in which the app goes online', () => {
  assert.deepEqual(ONLINE_CASES, ['updates', 'gallery', 'aiAssistant']);
  const online: Record<string, string> = en.settings.online;
  for (const c of ONLINE_CASES) assert.ok(online[c], c);
});
