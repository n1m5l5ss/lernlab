import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../../locales/en.json';
import { blockKey, blockProgress, needsRescue, playableOnly, requeue } from './session-logic';

test('a missed card comes back after three other exercises', () => {
  const q = requeue(['a', 'b', 'c', 'd', 'e', 'f'], 1, 'b again');
  assert.deepEqual(q, ['a', 'b', 'c', 'd', 'e', 'b again', 'f']);
});

test('near the end of a block it comes back last', () => {
  assert.deepEqual(requeue(['a', 'b', 'c'], 1, 'b again'), ['a', 'b', 'c', 'b again']);
});

test('the rescue round starts under 60% with at least 3 answers', () => {
  assert.equal(needsRescue({ correct: 1, total: 3 }), true);
  assert.equal(needsRescue({ correct: 3, total: 5 }), false);
  assert.equal(needsRescue({ correct: 0, total: 2 }), false);
});

test('block progress stays between 0 and 1', () => {
  assert.equal(blockProgress(5, 12), 5 / 12);
  assert.equal(blockProgress(3, 0), 0);
  assert.equal(blockProgress(14, 12), 1);
});

test('every block the planner and runner make has a translated title', () => {
  const sources = ['../../../packages/core/src/session.ts', './Session.tsx'].map((f) =>
    readFileSync(join(import.meta.dirname, f), 'utf8'),
  );
  const titles = sources.flatMap((src) => [...src.matchAll(/title: '([^']+)'/g)].map((m) => m[1]));
  assert.ok(titles.length >= 15);
  const blocks = en.session.blocks as Record<string, string>;
  for (const title of titles) assert.ok(blocks[blockKey(title)], `session.blocks.${blockKey(title)} for "${title}"`);
});

test('listening and dictation are skipped when the card cannot be played', () => {
  const exs = [
    { type: 'listen', itemId: 1 },
    { type: 'dictation', itemId: 2 },
    { type: 'typed', itemId: 2 },
    { type: 'listen', itemId: 3 },
  ];
  const kept = playableOnly(exs, (id) => id === 3);
  assert.deepEqual(kept, [
    { type: 'typed', itemId: 2 },
    { type: 'listen', itemId: 3 },
  ]);
});
