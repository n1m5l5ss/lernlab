import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { basename, extname } from './paths';

test('basename and extname match node:path for forward-slash paths', () => {
  for (const p of [
    'a/b/c.png',
    'c.png',
    'deck/media/',
    '.hidden',
    'x/.hidden',
    'a.b.c',
    'noext',
    '',
    'dir/file.tar.gz',
  ]) {
    assert.equal(basename(p), posix.basename(p), p);
    assert.equal(extname(p), posix.extname(p), p);
  }
  assert.equal(basename('cards.csv', '.csv'), posix.basename('cards.csv', '.csv'));
  assert.equal(basename('.csv', '.csv'), posix.basename('.csv', '.csv'));
});

test('backslash paths from Windows deck files keep only the file name', () => {
  assert.equal(basename('media\\images\\rot.png'), 'rot.png');
  assert.equal(basename('..\\..\\evil.png'), 'evil.png');
});
