import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashFor, isStartHash, isTextField, mayStartFromShortcut, routeFromHash, ROUTES } from './routes';

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

test('the start shortcut never replaces a running session, a mock exam or a teach-back', () => {
  // Ctrl/Cmd+Enter is also "Check my explanation" (explain cards) and "Show the worked solution" (Try first).
  for (const open of ['play', 'together', 'exam', 'teach', 'map', 'a-screen-added-later'])
    assert.equal(mayStartFromShortcut(open, null), false, open);
  assert.equal(mayStartFromShortcut(null, null), true);
  assert.equal(mayStartFromShortcut('summary', null), true, 'a finished session can be followed by a new one');
});

test('the start shortcut does nothing while you type in a text field', () => {
  const textarea = { tagName: 'TEXTAREA' };
  assert.equal(mayStartFromShortcut(null, textarea), false);
  assert.equal(mayStartFromShortcut('teach', textarea), false);
  assert.equal(isTextField({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isTextField({ tagName: 'INPUT', type: 'search' }), true);
  assert.equal(isTextField({ tagName: 'INPUT' }), true);
  assert.equal(isTextField({ tagName: 'DIV', isContentEditable: true }), true);
  for (const type of ['checkbox', 'radio', 'button', 'range', 'file'])
    assert.equal(isTextField({ tagName: 'INPUT', type }), false, type);
  assert.equal(isTextField({ tagName: 'BUTTON' }), false);
  assert.equal(isTextField({ tagName: 'BODY' }), false);
  assert.equal(isTextField(null), false);
});
