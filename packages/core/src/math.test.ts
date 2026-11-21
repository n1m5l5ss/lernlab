import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMath, mathKey, splitMath } from './math';
import { acceptedAnswers, checkAnswer } from './text';
import { markdownLite } from './cards';

test('finds inline and display math, never a single dollar', () => {
  assert.deepEqual(splitMath('Area \\(\\pi r^2\\) and $$E=mc^2$$ or \\[a\\]'), [
    { text: 'Area ' },
    { tex: '\\pi r^2', display: false },
    { text: ' and ' },
    { tex: 'E=mc^2', display: true },
    { text: ' or ' },
    { tex: 'a', display: true },
  ]);
  assert.equal(hasMath('It costs $5 and $10'), false);
  assert.equal(hasMath('\\(x\\)'), true);
  assert.equal(hasMath('\\(x\\)'), true, 'no state left between calls');
});

test('math answers compare the source: spaces, delimiters, braces and spacing commands do not matter', () => {
  const key = mathKey('\\(\\frac{1}{2} x^{2}\\)');
  assert.equal(mathKey('\\frac12x^2'), key);
  assert.equal(mathKey('\\frac{1}{2}x^2'), key);
  assert.equal(mathKey('\\dfrac{1}{2} \\, x^{2}'), key);
  assert.equal(mathKey('\\left( a \\right)'), mathKey('(a)'));
  assert.equal(mathKey('2 \\cdot x'), mathKey('2*x'));
  assert.equal(mathKey('2 × x'), mathKey('2\\times x'));
  assert.equal(mathKey('x²'), mathKey('x^2'));
  assert.equal(mathKey('−x'), mathKey('-x'));
  assert.equal(mathKey('\\sqrt{a}'), mathKey('\\sqrt a'));
  assert.notEqual(mathKey('\\leftarrow'), mathKey('arrow'), '\\left only as a whole command');
  assert.notEqual(mathKey('2x'), mathKey('2*x'), 'a written sign is not the same as none');
  assert.notEqual(mathKey('X'), mathKey('x'), 'case matters in math');
  assert.notEqual(mathKey('\\frac{ab}{c}'), mathKey('\\frac{a}{bc}'));
});

test('typed math answers: same source is right, a one-letter slip is wrong (no typo forgiveness)', () => {
  const accepted = acceptedAnswers('\\(x^{2}+1\\)');
  assert.deepEqual(accepted, ['\\(x^{2}+1\\)'], 'math is never split on / or ;');
  assert.equal(checkAnswer('x^2 + 1', accepted).correct, true);
  assert.equal(checkAnswer('x^2 + 1', accepted).nearMiss, false);
  assert.equal(checkAnswer('x^3 + 1', accepted).correct, false);
  assert.deepEqual(acceptedAnswers('\\(a/b\\)'), ['\\(a/b\\)']);
  assert.equal(checkAnswer('a/b', ['\\(a/b\\)']).correct, true);
});

test('light Markdown leaves math alone', () => {
  assert.equal(markdownLite('*hi* \\(z^* w^*\\)'), '<i>hi</i> \\(z^* w^*\\)');
});
