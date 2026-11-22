import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPOKEN_MAX,
  addSpoken,
  canCheck,
  speechGone,
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

test('what you say is added to the explanation, after what is already there', () => {
  assert.equal(addSpoken('', '  the earth is tilted '), 'the earth is tilted');
  assert.equal(
    addSpoken('The earth is tilted.', 'so the sun is higher in summer'),
    'The earth is tilted. so the sun is higher in summer',
  );
  assert.equal(addSpoken('First line\n', 'second'), 'First line\nsecond');
  assert.equal(addSpoken('typed', '   '), 'typed');
});

test('a spoken explanation is capped like a typed one and cannot carry markup into the page', () => {
  const long = addSpoken('a'.repeat(SPOKEN_MAX - 3), 'bcdefgh');
  assert.equal(long.length, SPOKEN_MAX);
  assert.equal(addSpoken('', 'x\u0000y\u0007z'), 'xyz');
  // It stays plain text: the screen shows it as text, so tags are kept as characters and never parsed.
  assert.equal(addSpoken('', '<b>hi</b>'), '<b>hi</b>');
});

test('speech that cannot work switches to typing; a pause or a cough does not', () => {
  for (const e of ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'])
    assert.equal(speechGone(e), true, e);
  for (const e of ['no-speech', 'aborted', undefined]) assert.equal(speechGone(e), false, String(e));
});

test('saying the explanation enables the same Check as typing it, and the grade comes from the ticks alone', () => {
  const said = { ...explainStart(2), text: addSpoken('', 'because of the tilt') };
  assert.equal(canCheck(said), true);
  assert.equal(key(said, 'Enter', { ctrl: true }), 'check');
  assert.deepEqual(explainResult({ ...said, step: 'check' }), explainResult({ ...explainStart(2), step: 'check' }));
});
