import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudySource } from '@lernlab/core/learn';
import { parseSourceValue, sourceValue } from './sources';

test('every study source survives the picker round trip, including tags with colons', () => {
  const all: StudySource[] = [
    { kind: 'deck', deckId: 3 },
    { kind: 'decks', deckIds: [1, 2] },
    { kind: 'all' },
    { kind: 'tag', tag: 'aws:saa' },
    { kind: 'starred' },
    { kind: 'hardest' },
  ];
  for (const s of all) assert.deepEqual(parseSourceValue(sourceValue(s)), s);
});

test('values the picker never makes are rejected', () => {
  for (const v of ['', 'deck:x', 'deck:-1', 'decks:', 'tag: ', 'everything'])
    assert.equal(parseSourceValue(v), null, v);
});
