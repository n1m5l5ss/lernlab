import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explainKey,
  explainResult,
  explainStart,
  gapKey,
  rateResult,
  resultKey,
  toggle,
  type ExplainState,
} from './explain-logic';
import { recallFor } from './plan';
import type { Item } from '@lernlab/core/types';

const key = (s: ExplainState, k: string, more: { ctrl?: boolean; onButton?: boolean; points?: number } = {}) =>
  explainKey(s, { key: k, ctrl: !!more.ctrl, onButton: !!more.onButton, points: more.points ?? 3 });

test('an explanation starts empty, with nothing ticked and no ratings', () => {
  assert.deepEqual(explainStart(3), {
    step: 'write',
    text: '',
    ticked: [false, false, false],
    before: null,
    after: null,
  });
});

test('Ctrl+Enter checks a written explanation; nothing else reacts while you write', () => {
  const s = explainStart(2);
  assert.equal(key(s, 'Enter', { ctrl: true }), null, 'nothing written yet');
  const written = { ...s, text: 'Because the axis is tilted' };
  assert.equal(key(written, 'Enter', { ctrl: true }), 'check');
  assert.equal(key(written, 'Enter'), null, 'a new line');
  assert.equal(key(written, '1'), null);
  assert.equal(key({ ...s, text: '   ' }, 'Enter', { ctrl: true }), null, 'blank is not an explanation');
});

test('after the reveal: Enter finishes the ticking; without key points 1–3 rate as on a flip card', () => {
  const s: ExplainState = { ...explainStart(2), step: 'check', text: 'x' };
  assert.equal(key(s, 'Enter'), 'done', 'also from a checkbox');
  assert.equal(key(s, 'Enter', { onButton: true }), null, 'a button does its own thing');
  assert.equal(key(s, '3', { onButton: true, points: 0 }), 'yes');
  assert.equal(key(s, '2'), null);
  assert.equal(key(s, '1', { points: 0 }), 'no');
  assert.equal(key(s, '2', { points: 0 }), 'partly');
  assert.equal(key(s, '3', { points: 0 }), 'yes');
  assert.equal(key(s, 'Enter', { points: 0 }), null);
  assert.equal(key({ ...s, step: 'gaveUp' }, 'Enter'), 'next');
  assert.equal(key({ ...s, step: 'gaveUp' }, 'Enter', { onButton: true }), null);
});

test('ticks map to the grade, and the line under the list says which', () => {
  const s: ExplainState = { ...explainStart(3), step: 'check', ticked: [true, false, true] };
  assert.deepEqual(toggle(s, 1).ticked, [true, true, true]);
  assert.deepEqual(explainResult(s), { correct: true, nearMiss: true, easy: false });
  assert.deepEqual(explainResult(toggle(s, 1), true), { correct: true, nearMiss: false, easy: true });
  assert.deepEqual(explainResult({ ...s, ticked: [false, false, false] }), {
    correct: false,
    nearMiss: false,
    easy: false,
  });
  assert.equal(resultKey(s.ticked), 'ex.explain.resultSome');
  assert.equal(resultKey([true, true]), 'ex.explain.resultAll');
  assert.equal(resultKey([false, false]), 'ex.explain.resultNone');
  assert.deepEqual(rateResult(0), { correct: false, nearMiss: false, easy: false });
  assert.deepEqual(rateResult(1), { correct: true, nearMiss: true, easy: false });
  assert.deepEqual(rateResult(2), { correct: true, nearMiss: false, easy: false });
});

test('the understanding gap is told only when both ratings were given', () => {
  assert.equal(gapKey(null, 3), null);
  assert.equal(gapKey(5, null), null);
  assert.equal(gapKey(6, 4), 'ex.explain.gapDown');
  assert.equal(gapKey(3, 5), 'ex.explain.gapUp');
  assert.equal(gapKey(4, 4), 'ex.explain.gapSame');
});

test('boss rounds and relearning ask explain cards and why/how cards as explanations too', () => {
  const card = (over: Partial<Item>): Item =>
    ({
      id: 1,
      kind: 'card',
      lang: null,
      target: 'Why seasons?',
      meaning: 'The tilt of the axis, all year long.',
      extra: {},
      tags: [],
      ...over,
    }) as Item;
  const ex = recallFor(card({ extra: { keyPoints: 'Tilt|Angle' } }));
  assert.ok(ex.type === 'explain' && ex.points.length === 2);
  assert.equal(recallFor(card({ tags: ['why'] })).type, 'explain');
  assert.equal(recallFor(card({ tags: ['why'], meaning: 'tilt' })).type, 'typed', 'a short answer is still typed');
  assert.notEqual(recallFor(card({})).type, 'explain');
});
