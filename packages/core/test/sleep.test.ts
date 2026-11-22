// Sleep bridge (#217): an optional rhythm, off by default. New cards wait for the evening session, and the
// next session before the evening starts with a short check of last night's new and missed cards. That check
// is on a new study day, so it is a normal review: one grade per card per day. Nothing is blocked: without an
// evening session the day before, new cards come at any time.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-sleep-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt, getSettings, DEFAULT_SETTINGS } = await import('../src/learn');
const { holdNewCards, isEvening, morningCheckIds, studiedLastEvening } = await import('../src/sleep');
const { cleanMorningTime } = await import('../src/reminder');
const { getDb, setMeta } = await import('../src/db');
after(() => cleanupTempDir(dir));

const deck = createDeck('Anatomy', null);
upsertCards(
  deck,
  Array.from({ length: 30 }, (_, i) => ({ front: `Bone ${i}`, back: `Name ${i}`, rank: i + 1 })),
);
const items = allItems(getDb(), deck.id);
const d = getDb();
const at = (day: number, hour: number) => new Date(2027, 3, day, hour);
const answer = (i: number, when: Date, o: object = {}) =>
  recordAttempt(
    { sessionId: 's', itemId: items[i].id, format: 'typed', correct: true, responseMs: 9000, xp: 1, ...o },
    d,
    when,
  );
const learn = (i: number, when: Date) => {
  answer(i, when, { format: 'intro' });
  return answer(i, when);
};
const plan = (when: Date) => planSession('standard', d, when, deck.id);
const reviewed = (p: ReturnType<typeof plan>) =>
  p.blocks
    .filter((b) => b.kind === 'drill' && (b.title === 'Review' || b.title === 'Fill the gap'))
    .flatMap((b) => ('exercises' in b ? b.exercises : []))
    .map((e) => ('itemId' in e ? e.itemId : 0));

test('the rhythm is off by default and changes nothing then', () => {
  assert.equal(DEFAULT_SETTINGS.sleepBridge, false);
  assert.equal(isEvening(at(1, 17)) && isEvening(at(1, 2)) && !isEvening(at(1, 16)) && !isEvening(at(1, 5)), true);
  assert.equal(cleanMorningTime('07:15'), '07:15');
  assert.equal(cleanMorningTime('25:00'), '08:00');
  for (const i of [0, 1, 2]) learn(i, at(1, 20)); // an evening session
  answer(2, at(1, 21), { correct: false, practice: true });
  assert.equal(holdNewCards(getSettings(d), d, at(2, 9)), false);
  const morning = plan(at(2, 9));
  assert.ok(morning.counts.fresh > 0, 'new cards as usual');
});

test('on: after an evening session, the next morning checks last night’s cards first and holds new cards for the evening', () => {
  setMeta(d, 'settings', { ...getSettings(d), sleepBridge: true });
  assert.equal(studiedLastEvening(d, at(2, 9)), true);
  assert.deepEqual(morningCheckIds(d, at(2, 9)).sort(), [0, 1, 2].map((i) => items[i].id).sort());
  const morning = plan(at(2, 9));
  assert.equal(morning.counts.fresh, 0, 'new cards wait for tonight');
  assert.deepEqual(reviewed(morning).slice(0, 3).sort(), [0, 1, 2].map((i) => items[i].id).sort());
  assert.equal(morning.blocks.find((b) => b.title === 'Review')?.teacher.key, 'teacher.block.morning');
  // The check is a normal review on a new study day: graded once.
  assert.ok(answer(0, at(2, 9)).grade);
  assert.equal(answer(0, at(2, 10)).grade, null);
  assert.ok(!morningCheckIds(d, at(2, 10)).includes(items[0].id), 'checked cards are done');
  const evening = plan(at(2, 19));
  assert.ok(evening.counts.fresh > 0, 'the evening session brings the new cards');
  assert.notEqual(evening.blocks.find((b) => b.title === 'Review')?.teacher.key, 'teacher.block.morning');
});

test('nothing is blocked: without an evening session the day before, new cards come at any time', () => {
  assert.equal(studiedLastEvening(d, at(4, 9)), false, 'day 3 was skipped');
  assert.equal(holdNewCards(getSettings(d), d, at(4, 9)), false);
  assert.ok(plan(at(4, 9)).counts.fresh > 0);
  learn(5, at(4, 12)); // studied at noon only
  assert.ok(plan(at(5, 12)).counts.fresh > 0, 'a daytime-only learner keeps getting new cards');
  assert.deepEqual(morningCheckIds(d, at(5, 12)), [items[5].id], 'and still checks yesterday’s new card first');
  assert.equal(planSession('standard', d, at(5, 12), deck.id, { practice: true }).counts.fresh, 0);
});
