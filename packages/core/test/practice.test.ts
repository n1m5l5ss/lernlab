// Practice mode: cram before a test without touching spaced repetition.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-practice-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { planSession } = await import('../src/session');
const { recordAttempt } = await import('../src/learn');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const rows = Array.from({ length: 10 }, (_, i) => `Question ${i},answer ${i}`).join('\n');
const { deck } = importFile('Exam.csv', strToU8(`front,back\n${rows}\n`));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const state = (id: number) => ({
  srs: getDb().prepare('SELECT card, due, reps, lapses, last_graded_day FROM srs WHERE item_id = ?').get(id),
  item: getDb().prepare('SELECT mastery, seen, right, wrong FROM item_state WHERE item_id = ?').get(id),
});
const at = new Date(2026, 10, 24, 10);
const attempt = (itemId: number, format: 'intro' | 'typed', correct: boolean, practice = false) =>
  recordAttempt({ sessionId: 's', itemId, format, correct, responseMs: 1500, xp: 5, practice }, getDb(), at);

test('practice answers are logged as practice and never change the schedule', () => {
  const [known, unseen] = ids;
  attempt(known, 'intro', true);
  const before = state(known);
  assert.equal(attempt(known, 'typed', false, true).grade, null);
  assert.equal(attempt(known, 'typed', true, true).grade, null);
  assert.equal(attempt(unseen, 'typed', true, true).grade, null);
  assert.deepEqual(state(known), before, 'FSRS card and mastery unchanged');
  assert.equal(state(unseen).srs, undefined, 'practice never introduces a card');
  const logged = getDb().prepare('SELECT practice, grade FROM attempts WHERE practice = 1').all();
  assert.equal(logged.length, 3);
  assert.ok(logged.every((r) => r.grade === null));
  assert.notEqual(attempt(known, 'typed', true).grade, null, 'a real review later that day still counts');
});

test('a practice session covers any card in the source and teaches nothing new', () => {
  const plan = planSession('standard', getDb(), at, deck.id, { practice: true });
  assert.equal(plan.practice, true);
  assert.equal(plan.counts.fresh, 0);
  const exercises = plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises : []));
  assert.ok(!exercises.some((e) => e.type === 'intro'), 'no new-card lessons');
  const seenIds = new Set(
    getDb()
      .prepare('SELECT item_id FROM srs')
      .all()
      .map((r) => Number(r.item_id)),
  );
  assert.ok(
    Object.keys(plan.items).some((id) => !seenIds.has(Number(id))),
    'cards not yet learned can be practised',
  );
  assert.equal(planSession('standard', getDb(), at, deck.id).practice, false);
});
