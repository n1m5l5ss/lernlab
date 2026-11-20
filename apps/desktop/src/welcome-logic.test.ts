import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welcomeStep } from './welcome-logic';

test('continue brings in the sample deck for a language or subject, and opens the import for own cards', () => {
  assert.deepEqual(welcomeStep('continue', 'language'), { choice: 'language', next: 'home' });
  assert.deepEqual(welcomeStep('continue', 'subject'), { choice: 'subject', next: 'home' });
  assert.deepEqual(welcomeStep('continue', 'own'), { choice: 'own', next: 'decks' });
});

test('the 2-minute sample always starts a session on a sample deck', () => {
  assert.deepEqual(welcomeStep('sample', 'language'), { choice: 'language', next: 'session' });
  assert.deepEqual(welcomeStep('sample', 'subject'), { choice: 'subject', next: 'session' });
  assert.deepEqual(welcomeStep('sample', 'own'), { choice: 'language', next: 'session' });
});

test('skip imports nothing and goes home', () => {
  assert.deepEqual(welcomeStep('skip', 'subject'), { choice: 'skip', next: 'home' });
});
