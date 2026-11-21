// Confidence rating (#205): an optional 1–5 tap after a recall answer, stored with the answer. It never
// changes the schedule (FSRS), mastery or XP.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-confidence-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { recordAttempt } = await import('../src/learn');
const { getDb } = await import('../src/db');
const { isConfidence, rateConfidence } = await import('../src/confidence');
after(() => cleanupTempDir(dir));

const rows = Array.from({ length: 12 }, (_, i) => `Question ${i},answer ${i}`).join('\n');
const { deck } = importFile('Sure.csv', strToU8(`front,back\n${rows}\n`));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const day1 = new Date(2026, 10, 24, 10);
const attempt = (itemId: number, correct: boolean, at = day1, opts: { practice?: boolean; session?: string } = {}) =>
  recordAttempt(
    {
      sessionId: opts.session ?? 's1',
      itemId,
      format: 'typed',
      correct,
      responseMs: 1500,
      xp: 5,
      practice: opts.practice,
    },
    getDb(),
    at,
  );
const state = (id: number) => ({
  srs: getDb().prepare('SELECT * FROM srs WHERE item_id = ?').get(id),
  item: getDb().prepare('SELECT * FROM item_state WHERE item_id = ?').get(id),
  days: getDb().prepare('SELECT * FROM days').all(),
});
const confidences = (id: number) =>
  getDb()
    .prepare('SELECT confidence, practice FROM attempts WHERE item_id = ? ORDER BY id')
    .all(id)
    .map((r) => [r.confidence === null ? null : Number(r.confidence), Number(r.practice)]);

test('only whole numbers from 1 to 5 are confidence ratings', () => {
  for (const n of [1, 2, 3, 4, 5]) assert.ok(isConfidence(n));
  for (const n of [0, 6, 2.5, -1, NaN, '3', null, undefined]) assert.ok(!isConfidence(n));
});

test("a rating is saved with the card's answer in that session and changes nothing else", () => {
  const card = ids[0];
  attempt(card, false);
  const before = state(card);
  assert.deepEqual(rateConfidence('s1', card, 5, getDb()), { ok: true });
  assert.deepEqual(state(card), before, 'FSRS card, mastery, counters and XP unchanged');
  assert.deepEqual(confidences(card), [[5, 0]]);
  // Changing your mind replaces the rating.
  rateConfidence('s1', card, 4, getDb());
  assert.deepEqual(confidences(card), [[4, 0]]);
});

test('a rating goes on the latest real answer, never on practice or another session', () => {
  const card = ids[1];
  attempt(card, false);
  attempt(card, true, day1, { practice: true }); // the card brought back later in the session
  rateConfidence('s1', card, 2, getDb());
  assert.deepEqual(confidences(card), [
    [2, 0],
    [null, 1],
  ]);
  assert.deepEqual(rateConfidence('other', card, 3, getDb()), { ok: false });
  assert.deepEqual(rateConfidence('s1', ids[11], 3, getDb()), { ok: false }, 'no answer to rate');
});

test('a bad rating is refused', () => {
  const card = ids[2];
  attempt(card, true);
  assert.throws(() => rateConfidence('s1', card, 9, getDb()), { code: 'invalid_confidence' });
  assert.deepEqual(confidences(card), [[null, 0]]);
});
