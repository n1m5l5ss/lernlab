import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffPieces, markDiff } from './diff';

const marked = (a: string, b: string) =>
  diffPieces(a, b)
    .map((p) => (p.same ? p.text : `[${p.text}]`))
    .join('');

test('a wrong letter is marked on both sides', () => {
  assert.equal(marked('der Hunt', 'der Hund'), 'der Hun[t]');
  assert.equal(marked('der Hund', 'der Hunt'), 'der Hun[d]');
});

test('missing and extra letters', () => {
  assert.equal(marked('Hnd', 'Hund'), 'Hnd');
  assert.equal(marked('Hund', 'Hnd'), 'H[u]nd');
  assert.equal(marked('Huund', 'Hund'), 'Hu[u]nd');
});

test('case alone is not a difference, and non-Latin scripts work', () => {
  assert.equal(marked('hund', 'Hund'), 'hund');
  assert.equal(marked('నమస్తే', 'నమస్కారం').includes('['), true);
  assert.equal(marked('', 'Hund'), '');
});

test('answers that barely overlap are marked as a whole', () => {
  assert.deepEqual(markDiff('der Hunt', 'to go'), [{ text: 'der Hunt', same: false }]);
  assert.deepEqual(markDiff('der Hunt', 'der Hund'), diffPieces('der Hunt', 'der Hund'));
});
