// Pattern feedback (#213): what the session's own answers say about how it went, read from the database.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-patterns-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { recordAttempt } = await import('../src/learn');
const { rateConfidence } = await import('../src/confidence');
const { getDb } = await import('../src/db');
const { patternsOf } = await import('../src/patterns');
after(() => cleanupTempDir(dir));

const csv = [
  'front,back,tags',
  'Capital of Austria,Vienna,Geography',
  'Capital of Australia,Canberra,Geography',
  'Capital of Slovakia,Bratislava,Geography',
  'Capital of Slovenia,Ljubljana,Geography',
  'Year of the French Revolution,1789,History',
  'Year the Berlin Wall fell,1989,History',
].join('\n');
const { deck } = importFile('Mixed.csv', strToU8(csv));
const id = (front: string) =>
  Number(getDb().prepare('SELECT id FROM items WHERE deck_id = ? AND target = ?').get(deck.id, front)!.id);
const now = new Date(2026, 10, 24, 10);
const answer = (sessionId: string, front: string, given: string, correct: boolean, more: object = {}) =>
  recordAttempt(
    { sessionId, itemId: id(front), format: 'typed', correct, given, responseMs: 4000, xp: 1, ...more },
    getDb(),
    now,
  );

test('a session’s answers become its patterns: mix-ups, the tag with the misses, confident misses', () => {
  answer('p1', 'Capital of Austria', 'Canberra', false);
  answer('p1', 'Capital of Slovakia', 'Ljubljana', false);
  answer('p1', 'Capital of Slovenia', 'Zagreb', false);
  answer('p1', 'Year of the French Revolution', '1789', true);
  answer('p1', 'Year the Berlin Wall fell', '1989', true);
  rateConfidence('p1', id('Capital of Austria'), 5);
  rateConfidence('p1', id('Capital of Slovakia'), 4);
  const p = patternsOf('p1');
  assert.deepEqual(p.lines, [
    { kind: 'mixups', count: 2 },
    { kind: 'tag', tag: 'Geography', missed: 3, cards: 3 },
    { kind: 'confident', count: 2 },
  ]);
  assert.equal(p.next, 'mixups');
});

test('another session’s answers are not counted, and an unknown session has no patterns', () => {
  answer('p2', 'Capital of Austria', 'Vienna', true);
  assert.deepEqual(patternsOf('p2'), { lines: [], next: null });
  assert.deepEqual(patternsOf('nope'), { lines: [], next: null });
});

test('reading the patterns changes nothing: no schedule, no mix-up count', () => {
  const snap = () =>
    JSON.stringify([
      getDb().prepare('SELECT * FROM item_state ORDER BY item_id').all(),
      getDb().prepare('SELECT * FROM confusions ORDER BY a, b').all(),
    ]);
  const before = snap();
  patternsOf('p1');
  assert.equal(snap(), before);
});
