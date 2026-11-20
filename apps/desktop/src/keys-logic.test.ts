import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlOwnsKey, rovingIndex } from './keys-logic';

const el = (tagName: string, role: string | null = null) => ({ tagName, getAttribute: () => role });

test('arrows move through a radio group or tab list and wrap around', () => {
  assert.equal(rovingIndex(0, 3, 'ArrowRight'), 1);
  assert.equal(rovingIndex(2, 3, 'ArrowRight'), 0);
  assert.equal(rovingIndex(0, 3, 'ArrowLeft'), 2);
  assert.equal(rovingIndex(1, 3, 'ArrowDown'), 2);
  assert.equal(rovingIndex(1, 3, 'ArrowUp'), 0);
  assert.equal(rovingIndex(1, 3, 'Home'), 0);
  assert.equal(rovingIndex(0, 3, 'End'), 2);
});

test('right to left, the left arrow moves forward', () => {
  assert.equal(rovingIndex(0, 3, 'ArrowLeft', true), 1);
  assert.equal(rovingIndex(0, 3, 'ArrowRight', true), 2);
  assert.equal(rovingIndex(0, 3, 'ArrowDown', true), 1);
});

test('other keys are left alone', () => {
  assert.equal(rovingIndex(0, 3, 'Enter'), null);
  assert.equal(rovingIndex(0, 3, 'a'), null);
  assert.equal(rovingIndex(0, 0, 'ArrowRight'), null);
});

test('a focused button or link keeps Enter and Space for itself', () => {
  assert.equal(controlOwnsKey('Enter', el('BUTTON')), true);
  assert.equal(controlOwnsKey(' ', el('BUTTON')), true);
  assert.equal(controlOwnsKey('Enter', el('A')), true);
  assert.equal(controlOwnsKey(' ', el('INPUT')), true);
  assert.equal(controlOwnsKey('Enter', el('DIV', 'button')), true);
  assert.equal(controlOwnsKey(' ', el('SPAN', 'switch')), true);
});

test('screen shortcuts still work from the page itself and for other keys', () => {
  assert.equal(controlOwnsKey('Enter', el('BODY')), false);
  assert.equal(controlOwnsKey('Enter', el('H1')), false);
  assert.equal(controlOwnsKey('Enter', null), false);
  assert.equal(controlOwnsKey('1', el('BUTTON')), false);
  assert.equal(controlOwnsKey('Escape', el('BUTTON')), false);
});
