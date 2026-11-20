import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidInput, v } from './validate';

test('object keeps known fields, drops unknown ones and checks types', () => {
  const check = v.object({ name: v.string(10), language: v.optional(v.nullable(v.string(5))) });
  assert.deepEqual(check({ name: 'Deck', language: null, evil: '<script>' }), { name: 'Deck', language: null });
  assert.deepEqual(check({ name: 'Deck' }), { name: 'Deck' });
  assert.throws(() => check({ name: 42 }), InvalidInput);
  assert.throws(() => check({ name: 'x'.repeat(11) }), /name must be text/);
  assert.throws(() => check('Deck'), InvalidInput);
});

test('ids, numbers, bytes and choices', () => {
  assert.equal(v.id(7), 7);
  for (const bad of [0, -1, 1.5, '7', NaN, null]) assert.throws(() => v.id(bad), InvalidInput);
  assert.throws(() => v.number(Infinity), InvalidInput);
  assert.equal(v.bytes(4)(new Uint8Array(4)).length, 4);
  assert.throws(() => v.bytes(4)(new Uint8Array(5)), InvalidInput);
  assert.throws(() => v.bytes(4)('AAAA'), InvalidInput);
  assert.equal(v.oneOf('csv', 'lernpack')('csv'), 'csv');
  assert.throws(() => v.oneOf('csv', 'lernpack')('exe'), InvalidInput);
  assert.throws(() => v.array(v.number, 2)([1, 2, 3]), InvalidInput);
});
