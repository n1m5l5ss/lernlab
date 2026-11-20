import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from '@lernlab/core/types';
import { MISSED_SHOWN, summaryFacts } from './summary-logic';

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
