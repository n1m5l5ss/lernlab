// Import requests: every import answers with the same report, and bad files come back as error codes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-import-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
after(() => cleanupTempDir(dir));

type Report = { added: number; skipped: { row: number; code: string }[]; missingMedia: string[]; warnings: unknown[] };
const ok = async (channel: string, input?: unknown) => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as Report;
};

test('file and pasted imports answer with the import report', async () => {
  const file = await ok('import.file', {
    name: 'list.csv',
    data: strToU8('front,back,image\nHund,dog,hund.png\n,no front\n'),
  });
  assert.equal(file.added, 1);
  assert.deepEqual(file.skipped, [{ row: 3, code: 'row_no_front' }]);
  assert.deepEqual(file.missingMedia, ['hund.png']);
  assert.deepEqual(file.warnings, []);
  const pasted = await ok('import.text', { text: 'Haus\thouse\nBaum\ttree' });
  assert.equal(pasted.added, 2);
  assert.deepEqual(pasted.skipped, []);
});

test('an unsafe zip comes back as an error code, never as a crash', async () => {
  const zip = zipSync({ 'cards.csv': strToU8('front,back\na,b\n'), '../../escape.png': strToU8('x') });
  const r = await handle('import.file', { name: 'evil.zip', data: zip });
  assert.equal(!r.ok && r.error.code, 'zip_unsafe_path');
  const empty = await handle('import.text', { text: '   ' });
  assert.equal(!empty.ok && empty.error.code, 'no_cards');
});
