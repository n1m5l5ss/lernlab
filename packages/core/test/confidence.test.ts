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
const { CALIBRATION_MIN, calibration, calibrationCounts, isConfidence, rateConfidence } =
  await import('../src/confidence');
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

test("calibration counts each rated answer against the card's next real review on a later day", () => {
  const day3 = new Date(2026, 10, 26, 10);
  const rate = (card: number, c: number) => {
    recordAttempt(
      { sessionId: 's1', itemId: card, format: 'intro', correct: true, responseMs: 900, xp: 1 },
      getDb(),
      day1,
    );
    attempt(card, true);
    rateConfidence('s1', card, c, getDb());
  };
  const [a, b, c, e, f, g] = ids.slice(3, 9);
  rate(a, 5);
  rate(b, 5);
  rate(c, 4);
  rate(e, 4);
  rate(f, 2); // not reviewed again yet: not counted
  rate(g, 5);
  attempt(g, false); // later the same day: not its next review
  attempt(a, true, day3, { session: 's2' });
  attempt(b, false, day3, { session: 's2' });
  attempt(c, true, day3, { session: 's2' });
  attempt(e, true, day3, { session: 's2', practice: true }); // practice is not a review
  attempt(e, false, day3, { session: 's2' });
  attempt(e, true, day3, { session: 's2' }); // a second answer that day: only the graded first one counts
  const before = state(a);
  assert.deepEqual(calibrationCounts(getDb()), [
    { confidence: 4, rated: 2, right: 1 },
    { confidence: 5, rated: 2, right: 1 },
  ]);
  assert.deepEqual(state(a), before, 'reading it changes nothing');
});

test('calibration shows a share only once a rating has enough answers, and leads with the surest ones', () => {
  const none = calibration([]);
  assert.equal(none.levels.length, 5);
  assert.ok(none.levels.every((l) => l.rate === null && l.rated === 0));
  assert.deepEqual(none.lead, []);
  const n = CALIBRATION_MIN;
  const r = calibration([
    { confidence: 5, rated: 2 * n, right: 2 * n - 1 },
    { confidence: 4, rated: n, right: Math.round(n / 2) },
    { confidence: 3, rated: n, right: 1 },
    { confidence: 1, rated: n - 1, right: 0 },
  ]);
  assert.deepEqual(
    r.levels.map((l) => [l.confidence, l.rated, l.rate]),
    [
      [1, n - 1, null],
      [2, 0, null],
      [3, n, 1 / n],
      [4, n, Math.round(n / 2) / n],
      [5, 2 * n, (2 * n - 1) / (2 * n)],
    ],
  );
  assert.deepEqual(
    r.lead.map((l) => l.confidence),
    [5, 4],
  );
  assert.equal(r.rated, 5 * n - 1);
});
