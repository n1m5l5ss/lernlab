import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flip, typed } from '@lernlab/core/exercises';
import type { Block, Exercise, Item } from '@lernlab/core/types';
import { answerKind } from './session-logic';
import { SWAP_QUIZ_MAX, canSwap, swapBlock } from './swap-logic';

const card = (id: number, over: Partial<Item> = {}) =>
  ({
    id,
    deckId: 1,
    kind: 'basic',
    target: `question ${id}`,
    meaning: `answer ${id}`,
    word: '',
    extra: {},
    ...over,
  }) as Item;
const cards = Array.from({ length: 12 }, (_, i) => card(i + 1));
const item = (id: number) => cards.find((c) => c.id === id);
const teacher = { key: 'teacher.block.review', de: '' } as unknown as Block['teacher'];
const drill = (exercises: Exercise[]): Block => ({
  id: 'b1',
  kind: 'drill',
  format: 'typed',
  title: 'Review',
  teacher,
  exercises,
});
const ids = (b: Block) => ('exercises' in b ? b.exercises.map((e) => ('itemId' in e ? e.itemId : 0)) : []);

test('a typed review becomes flip cards: the same cards, still real recall', () => {
  const b = drill([typed(cards[0]), typed(cards[1])]);
  const s = swapBlock(b, item, cards)!;
  assert.equal(s.kind, 'drill');
  assert.notEqual(s.id, b.id, 'a new id, so the round starts fresh');
  assert.deepEqual(ids(s), [1, 2]);
  assert.ok('exercises' in s && s.exercises.every((e) => e.type === 'flip' && answerKind(e.type) === 'recall'));
  const f = 'exercises' in s ? (s.exercises[0] as Extract<Exercise, { type: 'flip' }>) : null;
  assert.equal(f?.prompt, 'question 1');
  assert.equal(f?.answer, 'answer 1');
});

test('flip cards with a short answer become typed; long ones stay as they are', () => {
  const long = card(20, { target: 'q '.repeat(60), meaning: 'a '.repeat(60) });
  const all = [...cards, long];
  const get = (id: number) => all.find((c) => c.id === id);
  const s = swapBlock(drill([flip(cards[0]), flip(long)]), get, all)!;
  assert.deepEqual('exercises' in s && s.exercises.map((e) => e.type), ['typed', 'flip']);
  assert.equal(swapBlock(drill([flip(long)]), get, all), null, 'nothing to change: no swap');
});

test('a question asked another way keeps its wording and level', () => {
  const v = card(30, { extra: { variants: 'apply: A patient has X. Which drug?' } });
  const all = [...cards, v];
  const s = swapBlock(drill([typed(v, 1)]), (id) => all.find((c) => c.id === id), all)!;
  const f = 'exercises' in s ? (s.exercises[0] as Extract<Exercise, { type: 'flip' }>) : null;
  assert.equal(f?.type, 'flip');
  assert.equal(f?.level, 'apply');
  assert.equal(f?.prompt, 'A patient has X. Which drug?');
});

test('card types with their own way of asking are never changed', () => {
  const occ = card(40, { kind: 'occlusion' as Item['kind'] });
  const all = [...cards, occ];
  const get = (id: number) => all.find((c) => c.id === id);
  const own: Exercise[] = [
    typed(occ),
    { type: 'myth', itemId: 1, statement: 's', why: 'w' },
    { type: 'explain', itemId: 2, prompt: 'p', answer: 'a', points: [] },
    { type: 'typed', itemId: 3, prompt: 'p', accepted: ['x'], requireArticle: false, hint: '', code: 'print(1)' },
  ];
  assert.equal(swapBlock(drill(own), get, all), null);
});

test('games become an untimed quiz on the same cards, and a quiz becomes match pairs', () => {
  for (const b of [
    { id: 'g', kind: 'match', title: 'Match pairs', teacher, itemIds: [1, 2, 3, 4, 4] },
    { id: 'g', kind: 'rain', title: 'Word rain', teacher, itemIds: [1, 2, 3, 4], seconds: 60 },
    { id: 'g', kind: 'gender', title: 'Category sprint', teacher, itemIds: [1, 2, 3, 4], seconds: 30 },
  ] as Block[]) {
    const s = swapBlock(b, item, cards)!;
    assert.equal(s.kind, 'drill', b.kind);
    assert.deepEqual(ids(s), [1, 2, 3, 4]);
    assert.ok('exercises' in s && s.exercises.every((e) => e.type === 'mc' && answerKind(e.type) === 'other'));
  }
  const many: Block = {
    id: 'g',
    kind: 'rain',
    title: 'Word rain',
    teacher,
    itemIds: cards.map((c) => c.id),
    seconds: 60,
  };
  assert.equal(ids(swapBlock(many, item, cards)!).length, SWAP_QUIZ_MAX);
  const quiz = swapBlock(many, item, cards)!;
  const back = swapBlock(quiz, item, cards)!;
  assert.equal(back.kind, 'match');
  assert.deepEqual('itemIds' in back && back.itemIds, ids(quiz).slice(0, 5));
});

test('a blitz round becomes the same questions without the clock', () => {
  const quiz = swapBlock(
    { id: 'g', kind: 'rain', title: 'r', teacher, itemIds: [1, 2, 3, 4], seconds: 9 },
    item,
    cards,
  )!;
  const exercises = 'exercises' in quiz ? quiz.exercises : [];
  const s = swapBlock(
    { id: 'z', kind: 'blitz', title: 'Blitz', teacher, exercises, secondsPerQuestion: 8 },
    item,
    cards,
  )!;
  assert.equal(s.kind, 'drill');
  assert.deepEqual('exercises' in s && s.exercises, exercises);
});

test('new cards, guesses, lessons and the boss are never swapped; nor a quiz with too few cards', () => {
  for (const kind of ['learn', 'ignition'] as const)
    assert.equal(swapBlock({ id: 'x', kind, title: 't', teacher, exercises: [typed(cards[0])] }, item, cards), null);
  assert.equal(swapBlock({ id: 'x', kind: 'boss', title: 't', teacher, itemIds: [1, 2], lives: 3 }, item, cards), null);
  assert.equal(
    swapBlock({ id: 'x', kind: 'guess', title: 't', teacher, topic: 'a', itemIds: [1, 2] }, item, cards),
    null,
  );
  assert.equal(
    swapBlock({ id: 'x', kind: 'match', title: 't', teacher, itemIds: [1, 2, 3, 4] }, item, cards.slice(0, 3)),
    null,
    'a quiz needs 4 cards to choose from',
  );
});

test('a swap is offered once per session, at the start of a round that has another format', () => {
  const b = drill([typed(cards[0])]);
  assert.equal(canSwap({ used: false, started: false, block: b, item, pool: cards }), true);
  assert.equal(canSwap({ used: true, started: false, block: b, item, pool: cards }), false);
  assert.equal(canSwap({ used: false, started: true, block: b, item, pool: cards }), false);
  const boss: Block = { id: 'x', kind: 'boss', title: 't', teacher, itemIds: [1], lives: 3 };
  assert.equal(canSwap({ used: false, started: false, block: boss, item, pool: cards }), false);
});
