import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromWire, toWire } from './wire';

test('bytes survive the JSON wire, other values stay plain', () => {
  const data = new Uint8Array(70_000).map((_, i) => i & 255);
  const back = fromWire(toWire({ name: 'deck.apkg', data, n: 1, list: [null, 'x'] })) as Record<string, unknown>;
  assert.deepEqual(back.data, data);
  assert.deepEqual({ ...back, data: null }, { name: 'deck.apkg', data: null, n: 1, list: [null, 'x'] });
  assert.equal(fromWire(toWire(undefined)), null);
});
