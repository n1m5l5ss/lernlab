// End-to-end learning loop on a fresh database: import → plan → answer → grade → finish → next day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { cleanupTempDir } from '../shared/test-utils';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-'));
process.env.LERNLAB_DATA = dir;
process.env.ANKICONNECT_URL = 'http://127.0.0.1:8799';

const { startMockAnki } = await import('../test/mock-anki');
const { importDeck } = await import('./importer');
const { planSession } = await import('./session');
const { recordAttempt, dueItemIds } = await import('./learn');
const { finishSession, appState, dailySummary } = await import('./progress');
const { getDb } = await import('./db');

let server: any;
before(async () => {
  server = await startMockAnki(8799);
});
after(() => {
  server.close();
  cleanupTempDir(dir);
});

const day1 = new Date(2026, 10, 21, 10, 17);

test('import reads all notes, kinds and media', async () => {
  const r = await importDeck('Lang::German');
  assert.equal(r.total, 38);
  assert.equal(r.media, 38);
  assert.equal(r.deck.language, 'de');
  const kinds = Object.fromEntries(
    getDb()
      .prepare('SELECT kind, COUNT(*) n FROM items GROUP BY kind')
      .all()
      .map((x: any) => [x.kind, Number(x.n)]),
  );
  assert.equal(kinds.noun, 16);
  assert.equal(kinds.grammar, 5);
  assert.ok(kinds.verb >= 5);
  const re = await importDeck('Lang::German');
  assert.equal(re.added, 0, 're-import keeps items');
});

test('first session plan is varied and has no format twice in a row', () => {
  const plan = planSession('standard', getDb(), day1);
  const kinds = plan.blocks.map((b) => (b.kind === 'drill' ? b.format : b.kind));
  for (let i = 1; i < kinds.length; i++) assert.notEqual(kinds[i], kinds[i - 1], `repeat at ${i}: ${kinds}`);
  assert.equal(plan.counts.fresh, 5);
  assert.equal(plan.counts.grammar, 'G01');
  assert.ok(kinds.includes('gender') && kinds.includes('match') && kinds.includes('boss'), kinds.join());
  for (const b of plan.blocks) {
    const ids = 'itemIds' in b ? b.itemIds : b.exercises.map((e: any) => e.itemId).filter(Boolean);
    for (const id of ids) assert.ok(plan.items[id], `item ${id} missing from plan.items`);
  }
});

test('answering: intro, recognition (no grade), recall (one grade per day)', () => {
  const plan = planSession('standard', getDb(), day1);
  const learn = plan.blocks.find((b) => b.kind === 'learn')!;
  const id = (learn as any).exercises[0].itemId as number;
  const base = { sessionId: plan.id, itemId: id, responseMs: 3000, xp: 5 };
  recordAttempt({ ...base, format: 'intro', correct: true }, getDb(), day1);
  assert.equal(recordAttempt({ ...base, format: 'mc', correct: true }, getDb(), day1).grade, null);
  assert.equal(recordAttempt({ ...base, format: 'typed', correct: false }, getDb(), day1).grade, 1);
  assert.equal(
    recordAttempt({ ...base, format: 'typed', correct: true }, getDb(), day1).grade,
    null,
    'second recall same day is not graded',
  );
  const st = getDb().prepare('SELECT * FROM item_state WHERE item_id = ?').get(id);
  assert.equal(Number(st.mastery), 3);

  // Introduce and pass the rest of the new words so we have a learned set.
  for (const e of (learn as any).exercises.filter((x: any) => x.type === 'intro')) {
    recordAttempt({ ...base, itemId: e.itemId, format: 'intro', correct: true }, getDb(), day1);
    recordAttempt({ ...base, itemId: e.itemId, format: 'typed', correct: true }, getDb(), day1);
  }
  // The grammar lesson introduces its items (the client sends an intro for each).
  for (const gid of plan.blocks.flatMap((b: any) =>
    b.title === 'Lesson' ? b.exercises.map((e: any) => e.itemId).filter(Boolean) : [],
  )) {
    recordAttempt({ ...base, itemId: gid, format: 'intro', correct: true }, getDb(), day1);
    assert.equal(
      recordAttempt({ ...base, itemId: gid, format: 'unscramble', correct: true }, getDb(), day1).grade,
      3,
      'unscramble grades grammar items',
    );
  }
  const res = finishSession(
    {
      sessionId: plan.id,
      length: 'standard',
      seconds: 600,
      answers: 12,
      correct: 10,
      bossWon: true,
      bestGenderCombo: 16,
      perfectBlocks: 1,
      startedAt: day1.toISOString(),
    },
    getDb(),
    day1,
  );
  assert.equal(res.streak.current, 1);
  assert.ok(res.goalMetNow);
  assert.ok(res.unlocked.some((u) => u.key === 'boss') && res.unlocked.some((u) => u.key === 'gender15'));
  const s = dailySummary(getDb(), day1);
  assert.equal(s.sessions, 1);
  assert.ok(s.errors.length >= 1);
});

test('next days: failed item comes back as due; streak continues', () => {
  const day2 = new Date(2026, 10, 22, 10, 17);
  const due = dueItemIds(getDb(), day2);
  assert.ok(due.length >= 1, 'the Again item is due tomorrow');
  const plan = planSession('standard', getDb(), day2);
  assert.ok(plan.counts.due >= 1);
  assert.equal(plan.counts.grammar, 'G02', 'next grammar group');
  finishSession(
    {
      sessionId: plan.id,
      length: 'standard',
      seconds: 300,
      answers: 5,
      correct: 5,
      bossWon: null,
      bestGenderCombo: 0,
      perfectBlocks: 0,
      startedAt: day2.toISOString(),
    },
    getDb(),
    day2,
  );
  assert.equal(appState(getDb(), day2).streak.current, 2);
  // Skip 23rd: a freeze is used on the 24th
  const day4 = new Date(2026, 10, 24, 10, 0);
  const st = appState(getDb(), day4);
  assert.equal(st.streak.current, 2);
  assert.equal(st.streak.freezes, 1);
  assert.equal(st.missedYesterday, true);
});

test('progress report counts learned words and forecasts', async () => {
  const { progressReport } = await import('./progress');
  const p = progressReport(getDb(), new Date(2026, 10, 24, 10, 0));
  assert.ok(p.totals.producible >= 5);
  assert.equal(p.totals.vocabTotal, 33);
  assert.equal(p.series.length, 60);
  assert.equal(
    p.series.at(-1)!.cumulative,
    p.series.reduce((s: number, x: any) => s + x.learned, 0),
  );
  assert.ok(p.forecast.goal?.at30PerDay);
  assert.equal(p.forecast.goal?.label, 'Goethe B1');
});
