import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeOf } from './theme';

test('the theme is read from the state and from saved settings', () => {
  assert.equal(themeOf('state.get', { settings: { theme: 'dark' } }), 'dark');
  assert.equal(themeOf('settings.save', { theme: 'light' }), 'light');
});

test('other channels and unknown values are ignored', () => {
  assert.equal(themeOf('decks.list', { theme: 'dark' }), null);
  assert.equal(themeOf('state.get', { settings: { theme: 'purple' } }), null);
  assert.equal(themeOf('state.get', null), null);
});
