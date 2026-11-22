import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAction, markActOut } from './actout';
import type { Block, Exercise } from './types';

test('an action card is tagged as one, or is a verb in a language deck', () => {
  assert.equal(isAction({ tags: ['Action'], kind: 'card', lang: null }), true);
  assert.equal(isAction({ tags: ['cpr', ' actions '], kind: 'order', lang: null }), true);
  assert.equal(isAction({ tags: [], kind: 'verb', lang: 'de' }), true);
  assert.equal(isAction({ tags: [], kind: 'noun', lang: 'de' }), false);
  assert.equal(isAction({ tags: ['reaction'], kind: 'card', lang: null }), false);
  assert.equal(isAction({ tags: [], kind: 'verb', lang: null }), false);
});

const teacher = { key: 'x' } as unknown as Block['teacher'];
const intro = (itemId: number): Exercise => ({ type: 'intro', itemId });
const flip = (itemId: number, sayAloud = false): Exercise => ({
  type: 'flip',
  itemId,
  prompt: 'q',
  answer: 'a',
  reverse: false,
  ...(sayAloud && { sayAloud }),
});
const typed = (itemId: number): Exercise => ({
  type: 'typed',
  itemId,
  prompt: 'q',
  accepted: ['a'],
  requireArticle: false,
  hint: '',
});
const drill = (exercises: Exercise[]): Block => ({
  id: 'b',
  kind: 'drill',
  format: 'typed',
  title: '',
  teacher,
  exercises,
});
const marked = (blocks: Block[]) =>
  blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])).map((e) => ('actOut' in e && e.actOut ? 1 : 0));

test('a minority of the cards, action cards only, each on its first showing', () => {
  const blocks = [drill([intro(1), intro(2), typed(1), typed(2), typed(3), flip(4), flip(5)])];
  markActOut(blocks, (id) => id === 2 || id === 4);
  assert.deepEqual(marked(blocks), [0, 1, 0, 0, 0, 0, 0], 'five cards: one prompt');
  const many = [drill(Array.from({ length: 20 }, (_, i) => typed(i + 1)))];
  markActOut(many, () => true);
  assert.equal(marked(many).filter(Boolean).length, 4, 'every card an action: still 1 in 5');
  const one = [drill([typed(1)])];
  markActOut(one, () => true);
  assert.deepEqual(marked(one), [0], 'never the only card');
});

test('a card that is said aloud is not acted out too; games and choices never ask', () => {
  const mc: Exercise = { type: 'mc', itemId: 9, direction: 'de2en', prompt: 'q', options: ['a', 'b'], answerIndex: 0 };
  const blocks = [drill([mc, flip(1, true), flip(2), flip(3)])];
  markActOut(blocks, () => true);
  assert.deepEqual(marked(blocks), [0, 0, 1, 0]);
});
