// The README and the user guide name the version that is out, and release-please keeps it current:
// each version line carries an `x-release-please-version` marker, and both files are in the
// release-please config, so the release PR bumps them together with package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const { version } = JSON.parse(read('package.json')) as { version: string };
const DOCS = ['README.md', 'docs/USER-GUIDE.md'];

for (const file of DOCS) {
  test(`${file} names the current version (${version}) on a line release-please updates`, () => {
    const lines = read(file)
      .split('\n')
      .filter((l) => l.includes('x-release-please-version'));
    assert.ok(lines.length > 0, `${file} has no line marked x-release-please-version`);
    for (const line of lines) assert.ok(line.includes(version), `${file}: "${line.trim()}" should say ${version}`);
  });
}

test('no doc still calls the app a 0.x prototype once 1.0 is out', () => {
  for (const file of [...DOCS, 'CLAUDE.md']) {
    assert.doesNotMatch(read(file), /\b(prototype \(v0\.|version 0\.|v0\.\d prototype)/i, file);
  }
});

test('release-please bumps the version lines in the README and the user guide', () => {
  const config = JSON.parse(read('release-please-config.json')) as {
    packages: Record<string, { 'extra-files'?: (string | { type: string; path: string })[] }>;
  };
  const extra = config.packages['.']['extra-files'] ?? [];
  for (const file of DOCS) {
    assert.ok(
      extra.some((e) => typeof e === 'object' && e.type === 'generic' && e.path === file),
      `${file} missing from extra-files`,
    );
  }
});
