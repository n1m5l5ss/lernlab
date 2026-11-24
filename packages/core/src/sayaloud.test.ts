import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markSayAloud, pickSayAloud, sayAloudCap } from './sayaloud';
import type { Block, Exercise } from './types';

const set = (...ids: number[]) => new Set(ids);
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test('a minority of the flip cards: about 1 in 5, at least one of two, never the only card', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10, 23].map(sayAloudCap), [0, 0, 1, 1, 1, 1, 2, 4]);
  for (let n = 2; n < 200; n++) assert.ok(sayAloudCap(n) <= n / 2, `never most of ${n} cards`);
});

test('only starred or recently missed cards are asked, missed first, up to the cap', () => {
  assert.deepEqual(pickSayAloud(range(10), set(), set()), set());
  assert.deepEqual(pickSayAloud(range(10), set(7), set(2)), set(7, 2));
  assert.deepEqual(pickSayAloud(range(10), set(7, 8, 9), set(1, 2)), set(7, 8));
  assert.deepEqual(pickSayAloud(range(4), set(), set(1, 2, 3, 4)), set(1), 'every card starred: still one');
  assert.deepEqual(pickSayAloud([5], set(5), set(5)), set());
  assert.deepEqual(pickSayAloud([5, 5, 5, 6], set(5), set()), set(5), 'a card asked twice counts once');
});

test('the chosen flip exercises of a plan are marked once; other exercises never are', () => {
  const flip = (itemId: number): Exercise => ({ type: 'flip', itemId, prompt: 'q', answer: 'a', reverse: false });
  const typed = (itemId: number): Exercise => ({
    type: 'typed',
    itemId,
    prompt: 'q',
    accepted: ['a'],
    requireArticle: false,
    hint: '',
  });
  const teacher = { key: 'x' } as unknown as Block['teacher'];
  const blocks: Block[] = [
    { id: 'a', kind: 'drill', format: 'flip', title: '', teacher, exercises: [flip(1), flip(2), typed(3), flip(1)] },
    { id: 'b', kind: 'match', title: '', teacher, itemIds: [1, 2] },
    { id: 'c', kind: 'drill', format: 'flip', title: '', teacher, exercises: [flip(4), flip(5), flip(6)] },
  ];
  markSayAloud(blocks, set(1, 3), set(4, 5, 6));
  const marked = blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])).map((e) => ('sayAloud' in e ? 1 : 0));
  assert.deepEqual(marked, [1, 0, 0, 0, 0, 0, 0], 'five flip cards: one, the missed one, on its first showing');
});
