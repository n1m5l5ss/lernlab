import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from '@lernlab/core/types';
import {
  MISSED_SHOWN,
  TOMORROW_SHOWN,
  celebrates,
  summaryFacts,
  summaryMoments,
  tomorrowCards,
  tomorrowReport,
} from './summary-logic';

const item = (id: number) => ({ id, target: `word ${id}`, meaning: `meaning ${id}` }) as Item;
const items = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((id) => [id, item(id)]));
const result = { correct: 12, answers: 15, seconds: 380, xp: 120, introduced: 4, missed: [3, 99, 5] };
const week = [true, true, false, true, true, true, false].map((studied) => ({ studied }));

test('recalled, minutes, new cards, XP with bonus, level progress and days this week', () => {
  const f = summaryFacts(result, { bonus: 20, state: { totalXp: 900, week } }, items);
  assert.deepEqual([f.recalled, f.total, f.minutes, f.introduced, f.xp], [12, 15, 6, 4, 140]);
  // 900 XP: level 5 starts at 100·4^1.5 = 800 and level 6 at 100·5^1.5 ≈ 1118
  assert.deepEqual(f.level, { next: 6, toNext: 218, percent: 31 });
  assert.equal(f.daysThisWeek, 5);
});

test('missed cards come back in order, unknown ids are skipped, and the list is capped', () => {
  assert.deepEqual(
    summaryFacts(result, null, items).missed.map((i) => i.id),
    [3, 5],
  );
  const many = summaryFacts({ ...result, missed: [1, 2, 3, 4, 5, 6, 7, 8] }, null, items);
  assert.equal(many.missed.length, MISSED_SHOWN);
});

test('without a server answer (finish failed) the summary still shows the session itself', () => {
  const f = summaryFacts(result, null, items);
  assert.equal(f.level, null);
  assert.equal(f.daysThisWeek, null);
  assert.equal(f.xp, 120);
});

test('a level-up shows when the session pushed total XP past a level line', () => {
  // Level 2 starts at 100 XP: 80 + 40 crosses it; 200 - 40 = 160 was already level 2.
  const up = summaryFacts(result, { bonus: 0, sessionXp: 40, state: { totalXp: 120, week } }, items);
  assert.equal(up.levelUp, 2);
  const flat = summaryFacts(result, { bonus: 0, sessionXp: 40, state: { totalXp: 200, week } }, items);
  assert.equal(flat.levelUp, null);
  assert.equal(summaryFacts(result, null, items).levelUp, null);
});

test('moments: level-up first, then badges, then streak news; nothing for an ordinary session', () => {
  const server = {
    bonus: 0,
    sessionXp: 40,
    state: { totalXp: 120, week },
    unlocked: [{ key: 'first' }],
    streakChange: { freezeEarned: true, repaired: false, repairDone: null },
  };
  assert.deepEqual(summaryMoments(summaryFacts(result, server, items), server), [
    { kind: 'level', level: 2 },
    { kind: 'badge', key: 'first' },
    { kind: 'freeze' },
  ]);
  const repair = {
    ...server,
    sessionXp: 0,
    unlocked: [],
    streakChange: { freezeEarned: false, repaired: false, repairDone: 1 },
  };
  assert.deepEqual(summaryMoments(summaryFacts(result, repair, items), repair), [{ kind: 'repairProgress', done: 1 }]);
  const fixed = { ...repair, streakChange: { freezeEarned: false, repaired: true, repairDone: null } };
  assert.deepEqual(summaryMoments(summaryFacts(result, fixed, items), fixed), [{ kind: 'repaired' }]);
  const quiet = { ...repair, streakChange: { freezeEarned: false, repaired: false, repairDone: null } };
  assert.deepEqual(summaryMoments(summaryFacts(result, quiet, items), quiet), []);
  assert.deepEqual(summaryMoments(summaryFacts(result, null, items), null), []);
});

test('calm mode keeps streak news and drops the level, the badges and the celebration (#216)', () => {
  const server = {
    bonus: 0,
    sessionXp: 120,
    goalMetNow: true,
    state: { totalXp: 300, week },
    unlocked: [{ key: 'first' }],
    streakChange: { freezeEarned: true, repaired: false, repairDone: null },
  };
  const f = summaryFacts(result, server, items);
  assert.deepEqual(summaryMoments(f, server, true), [{ kind: 'freeze' }]);
  assert.equal(celebrates(f, server, false), true);
  assert.equal(celebrates(f, server, true), false);
  assert.equal(celebrates({ levelUp: null }, { goalMetNow: false, unlocked: [] }, false), false);
  assert.equal(celebrates({ levelUp: null }, null, false), false);
});

test('the tomorrow check asks about the new cards met, question only, never in practice (#205)', () => {
  const qa = (i: Item) => ({ prompt: `question ${i.id}` });
  assert.deepEqual(tomorrowCards({ practice: false, newCards: [2, 99, 4, 2] }, items, qa), [
    { id: 2, prompt: 'question 2' },
    { id: 4, prompt: 'question 4' },
  ]);
  assert.deepEqual(tomorrowCards({ practice: true, newCards: [2, 4] }, items, qa), []);
  assert.deepEqual(tomorrowCards({ practice: false, newCards: [] }, items, qa), []);
  const many = Array.from({ length: 30 }, (_, i) => i + 1);
  const lots = Object.fromEntries(many.map((id) => [id, item(id)]));
  assert.equal(tomorrowCards({ practice: false, newCards: many }, lots, qa).length, TOMORROW_SHOWN);
});

test('the report on the last check lists only answers whose cards came back', () => {
  const groups = {
    yes: { cards: 3, reviewed: 3, right: 2 },
    unsure: { cards: 2, reviewed: 0, right: 0 },
    no: { cards: 1, reviewed: 1, right: 1 },
  };
  assert.deepEqual(tomorrowReport(groups), [
    { answer: 'yes', reviewed: 3, right: 2 },
    { answer: 'no', reviewed: 1, right: 1 },
  ]);
});
