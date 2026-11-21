// The creator's credit must stay in the licence, the README, AUTHORS.md and the app's About screen
// (GOVERNANCE.md: a fork may keep the LernLab name only with this credit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

test('the licence copyright line names the creator', () => {
  assert.match(read('LICENSE'), /^Copyright \(c\) .*kandru \(aka n1m5l5ss\)/m);
});

test('the README and AUTHORS.md credit the creator', () => {
  assert.match(read('README.md'), /originally created by kandru \(aka \[@n1m5l5ss\]/i);
  assert.match(read('AUTHORS.md'), /created by kandru/);
});

test("the app's About screen credits the creator", () => {
  const en = JSON.parse(read('locales/en.json')) as { settings: { about: { createdBy: string } } };
  assert.match(en.settings.about.createdBy, /Originally created by kandru \(aka n1m5l5ss\)/);
  assert.match(read('apps/desktop/src/Settings.tsx'), /t\('settings\.about\.createdBy'\)/);
});
