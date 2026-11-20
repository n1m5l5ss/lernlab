// The Progress screen's numbers: learned vs remaining per deck, pace, forecast, study days, retention, hardest cards.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-journey-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { createDeck } = await import('../src/library');
const { recordAttempt } = await import('../src/learn');
const { journey, JOURNEY } = await import('../src/progress');
const { addDays, weekStart } = await import('../src/game');
const { KNOWN_MASTERY } = await import('../src/browse');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const csv = (prefix: string, n: number) =>
  strToU8('front,back\n' + Array.from({ length: n }, (_, i) => `${prefix} ${i},answer ${i}`).join('\n'));
const exam = createDeck('Exam deck', null, { goal: { label: 'Exam', words: 8 } });
const plain = createDeck('Plain deck', null);
importFile('a.csv', csv('Alpha', 10), { deckId: exam.id });
importFile('b.csv', csv('Beta', 4), { deckId: plain.id });
const ids = (deckId: number) =>
  getDb()
    .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY target')
    .all(deckId)
    .map((r) => Number(r.id));
const alpha = ids(exam.id);

// Wednesday 25 November 2026; the reviews happen on Monday of the same week.
const now = new Date(2026, 10, 25, 10);
const today = '2026-11-25';
const monday = new Date(2026, 10, 23, 10);
const answer = (itemId: number, correct: boolean, at: Date, practice = false) => {
  recordAttempt({ sessionId: 's', itemId, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), at);
  recordAttempt({ sessionId: 's', itemId, format: 'typed', correct, responseMs: 3000, xp: 1, practice }, getDb(), at);
};
for (const id of alpha.slice(0, 4)) answer(id, true, monday);
answer(alpha[4], false, monday);
getDb()
  .prepare(`UPDATE item_state SET mastery = ? WHERE item_id IN (${alpha.slice(0, 4).join(',')})`)
  .run(KNOWN_MASTERY);
// A practice answer never counts as a review, even if it somehow carries a grade.
getDb()
  .prepare(
    `INSERT INTO attempts(ts, day, session_id, item_id, format, correct, response_ms, xp, grade, practice)
     VALUES (?, ?, 'p', ?, 'typed', 0, 1000, 0, 1, 1)`,
  )
  .run(now.toISOString(), today, alpha[5]);
getDb()
  .prepare('INSERT OR REPLACE INTO days(day, xp, sessions, seconds) VALUES (?, 10, 1, 900), (?, 0, 0, 0)')
  .run('2026-11-23', '2026-11-24');

test('weeks start on Monday', () => {
  assert.equal(weekStart('2026-11-25'), '2026-11-23');
  assert.equal(weekStart('2026-11-23'), '2026-11-23');
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
});

test('per deck: learned vs remaining, pace per week and the forecast date', () => {
  const j = journey(getDb(), now);
  const a = j.decks.find((d) => d.id === exam.id)!;
  assert.equal(a.cards, 10);
  assert.equal(a.learned, 4);
  assert.equal(a.remaining, 6);
  assert.deepEqual(a.goal, { label: 'Exam', target: 8 });
  // 4 cards first recalled in the last 4 weeks: 1 a week; 4 left to the goal of 8 → 4 weeks.
  assert.equal(a.perWeek, 1);
  assert.equal(a.reached, false);
  assert.equal(a.forecast, addDays(today, 28));

  const b = j.decks.find((d) => d.id === plain.id)!;
  assert.deepEqual([b.cards, b.learned, b.remaining, b.perWeek], [4, 0, 4, 0]);
  assert.equal(b.goal, null);
  assert.equal(b.forecast, null, 'no pace yet, so no date');
  assert.deepEqual(j.totals, { learned: 4, remaining: 10, perWeek: 1 });
});

test('study days: only days with a session, inside the heatmap window', () => {
  const j = journey(getDb(), now);
  assert.equal(j.today, today);
  assert.deepEqual(j.studyDays, [{ day: '2026-11-23', minutes: 15 }]);
  assert.equal(j.heatmapSince, addDays(weekStart(today), -7 * (JOURNEY.heatmapWeeks - 1)));
});

test('retention: share of real reviews recalled, by week, practice left out', () => {
  const j = journey(getDb(), now);
  assert.equal(j.retention.weeks.length, JOURNEY.retentionWeeks);
  const last = j.retention.weeks.at(-1)!;
  assert.equal(last.week, '2026-11-23');
  assert.deepEqual([last.reviews, last.recalled], [5, 4]);
  assert.ok(j.retention.weeks.slice(0, -1).every((w) => w.reviews === 0));
  assert.deepEqual([j.retention.reviews, j.retention.recalled], [5, 4]);
  assert.equal(j.retention.target, 0.9);
});

test('hardest cards: the ones you lapse on most, at most 20, with readable text', () => {
  const j = journey(getDb(), now);
  assert.equal(j.hardest.length, 1);
  assert.equal(j.hardest[0].id, alpha[4]);
  assert.equal(j.hardest[0].front, 'Alpha 4');
  assert.equal(j.hardest[0].back, 'answer 4');
  assert.equal(j.hardest[0].lapses, 1);
  assert.ok(JOURNEY.hardest === 20);
});
