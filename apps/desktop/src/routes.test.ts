import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashFor, isStartHash, routeFromHash, ROUTES } from './routes';

test('every screen has an address that leads back to it', () => {
  for (const r of ROUTES) assert.equal(routeFromHash(hashFor(r)), r);
});

test('empty and unknown addresses open Home', () => {
  assert.equal(routeFromHash(''), 'home');
  assert.equal(routeFromHash('#/'), 'home');
  assert.equal(routeFromHash('#/nowhere'), 'home');
  assert.equal(routeFromHash('#decks'), 'decks');
  assert.equal(routeFromHash('#/cards?deck=2'), 'cards');
});

test('the start shortcut is recognised', () => {
  assert.ok(isStartHash('#start'));
  assert.ok(isStartHash('#/start'));
  assert.ok(!isStartHash('#/decks'));
});
