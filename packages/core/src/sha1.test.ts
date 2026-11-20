import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha1Hex } from './sha1';

const node = (x: string | Uint8Array) => createHash('sha1').update(x).digest('hex');

test('sha1 matches node:crypto for strings, Unicode and block edges', () => {
  assert.equal(sha1Hex(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  assert.equal(sha1Hex('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  for (const s of [
    'der Hund',
    'Größe · ü',
    '💡 emoji',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'b'.repeat(1000),
  ])
    assert.equal(sha1Hex(s), node(s), s.slice(0, 20));
});

test('sha1 matches node:crypto for bytes', () => {
  const bytes = new Uint8Array(5000).map((_, i) => (i * 31 + 7) & 255);
  assert.equal(sha1Hex(bytes), node(bytes));
});
