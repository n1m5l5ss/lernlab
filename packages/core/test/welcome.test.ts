// First-run welcome: shown once to a brand-new user, never to someone who already has decks or study days.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-welcome-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { getDb } = await import('../src/db');
const { createDeck, deleteDeck } = await import('../src/library');
const { needsWelcome, finishWelcome, welcomeChoice } = await import('../src/welcome');
after(() => cleanupTempDir(dir));

test('a brand-new data folder shows the welcome', () => {
  assert.equal(needsWelcome(getDb()), true);
  assert.equal(welcomeChoice(getDb()), null);
});

test('someone who already has a deck never sees it', () => {
  const deck = createDeck('Existing', null);
  assert.equal(needsWelcome(getDb()), false);
  deleteDeck(deck.id);
  assert.equal(needsWelcome(getDb()), true);
});

test('someone who has studied before (but deleted every deck) never sees it', () => {
  const d = getDb();
  d.prepare("INSERT INTO days(day, xp, sessions, seconds, goal_met) VALUES('2026-01-02', 10, 1, 60, 0)").run();
  assert.equal(needsWelcome(d), false);
  d.prepare("DELETE FROM days WHERE day = '2026-01-02'").run();
  assert.equal(needsWelcome(d), true);
});

test('finishing or skipping it hides it for good', () => {
  finishWelcome('skip', getDb(), new Date('2026-11-20T10:00:00Z'));
  assert.equal(needsWelcome(getDb()), false);
  assert.equal(welcomeChoice(getDb()), 'skip');
});
