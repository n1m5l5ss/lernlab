import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../../locales/en.json';
import { GUESS_START, guessKey, guessStep, type GuessState } from './guess-logic';

const run = (total: number, ...actions: Parameters<typeof guessStep>[1][]) =>
  actions.reduce<GuessState | 'done'>((s, a) => (s === 'done' ? s : guessStep(s, a, total)), GUESS_START);

test('guess, see the answer, then go on; the last question ends the round', () => {
  const typed = run(3, { type: 'type', text: 'mitochondria?' });
  assert.deepEqual(typed, { i: 0, revealed: false, guess: 'mitochondria?', picked: null });
  const shown = run(3, { type: 'type', text: 'x' }, { type: 'reveal' });
  assert.ok(shown !== 'done' && shown.revealed, 'the answer follows the guess');
  assert.deepEqual(run(3, { type: 'reveal' }, { type: 'next' }), { ...GUESS_START, i: 1 });
  assert.equal(run(2, { type: 'reveal' }, { type: 'next' }, { type: 'reveal' }, { type: 'next' }), 'done');
});

test('a guess is optional: the answer can be shown without one', () => {
  const s = run(5, { type: 'reveal' });
  assert.ok(s !== 'done' && s.revealed && s.guess === '');
});

test('on a multiple-choice question, picking a choice is the guess and shows the answer', () => {
  const s = run(5, { type: 'pick', choice: 2 });
  assert.ok(s !== 'done');
  assert.equal(s.picked, 2);
  assert.ok(s.revealed);
  const again = guessStep(s, { type: 'pick', choice: 0 }, 5);
  assert.ok(again !== 'done' && again.picked === 2, 'the guess stays once the answer is shown');
  assert.ok(run(5, { type: 'reveal' }, { type: 'type', text: 'late' }) !== 'done');
  const late = run(5, { type: 'reveal' }, { type: 'type', text: 'late' }) as GuessState;
  assert.equal(late.guess, '', 'no changing the guess after the answer');
});

test('next before the answer is shown does nothing: every guess gets its feedback', () => {
  assert.deepEqual(run(5, { type: 'next' }), GUESS_START);
});

test('keys: Enter shows the answer, then moves on; number keys pick a choice', () => {
  assert.deepEqual(guessKey('Enter', GUESS_START, 0), { type: 'reveal' });
  assert.deepEqual(guessKey('Enter', { ...GUESS_START, revealed: true }, 0), { type: 'next' });
  assert.deepEqual(guessKey('2', GUESS_START, 4), { type: 'pick', choice: 1 });
  assert.equal(guessKey('5', GUESS_START, 4), null);
  assert.equal(guessKey('2', GUESS_START, 0), null, 'digits are typed into the guess on other cards');
  assert.equal(guessKey('2', { ...GUESS_START, revealed: true }, 4), null);
});

test('the guess round is practice only: it never sends an answer, a grade or an override', () => {
  const src = readFileSync(join(import.meta.dirname, 'modes/Guess.tsx'), 'utf8');
  for (const call of ['ctx.answer', 'ctx.override', 'sendAttempt', 'sendOverride', 'api.', 'missed'])
    assert.ok(!src.includes(call), `Guess.tsx must not use ${call}`);
  assert.ok(!/QuestionTimer|seconds/.test(src), 'no timer on new cards');
});

test('the wording is kind: wrong guesses are expected and help', () => {
  assert.match(en.session.guess.kind, /Wrong guesses are expected and help you learn/);
  assert.ok(en.session.guess.skip);
  assert.ok(en.session.blocks['guess-first']);
  assert.ok(en.teacher.block.guess.includes('{{topic}}'));
});
