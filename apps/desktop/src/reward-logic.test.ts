import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BONUS, xpFor } from '@lernlab/core/game';
import { addReward, floatReason, newRewardTally, rewardLines } from './reward-logic';

test('XP is sorted by what earned it: recall, a comeback after a slip, practice, runs and tries', () => {
  const t = newRewardTally();
  addReward(t, { format: 'typed', ok: true, gained: xpFor('typed', true, 1), combo: 1, slipped: false });
  addReward(t, { format: 'flip', ok: true, gained: xpFor('flip', true, 2), combo: 2, slipped: false });
  addReward(t, { format: 'typed', ok: false, gained: 1, combo: 0, slipped: false });
  addReward(t, { format: 'typed', ok: true, gained: xpFor('typed', true, 1), combo: 1, slipped: true });
  addReward(t, { format: 'mc', ok: true, gained: xpFor('mc', true, 2), combo: 2, slipped: false });
  addReward(t, { format: 'match', ok: true, gained: xpFor('match', true, 3), combo: 3, slipped: true });
  assert.deepEqual(t.recall, { xp: 15 + 12, count: 2 });
  assert.deepEqual(t.comeback, { xp: 15, count: 1 });
  assert.deepEqual(t.practice, { xp: 5 + 5, count: 2 }, 'recognition and games are practice, even after a slip');
  assert.deepEqual(t.tried, { xp: 1, count: 1 });
  assert.deepEqual(t.run, { xp: 2 + 2, count: 3 }, 'the bonus for answers in a row, and the longest run');
});

test('the reward lines add up to the XP shown, biggest reasons first, and leave out what earned nothing', () => {
  const t = newRewardTally();
  let xp = 0;
  const answers = [
    ['typed', true, false],
    ['typed', true, false],
    ['typed', false, false],
    ['typed', true, true],
    ['mc', true, false],
  ] as const;
  let combo = 0;
  for (const [format, ok, slipped] of answers) {
    combo = ok ? combo + 1 : 0;
    const gained = xpFor(format, ok, combo);
    xp += gained;
    addReward(t, { format, ok, gained, combo, slipped });
  }
  const lines = rewardLines(t, { perfectBlocks: 2, goalMetNow: true, bossWon: false });
  const bonus = 2 * BONUS.perfectBlock + BONUS.dailyGoal;
  assert.equal(
    lines.reduce((n, l) => n + l.xp, 0),
    xp + bonus,
  );
  assert.deepEqual(
    lines.map((l) => l.reason),
    ['perfect', 'recall', 'goal', 'comeback', 'practice', 'run', 'tried'],
  );
  assert.deepEqual(lines[0], { reason: 'perfect', xp: 40, count: 2 });
  assert.deepEqual(lines[3], { reason: 'comeback', xp: 15, count: 1 });
  assert.ok(!lines.some((l) => l.reason === 'boss'));
});

test('without the finish response only the answers are listed (the bonus was not recorded)', () => {
  const t = newRewardTally();
  addReward(t, { format: 'typed', ok: true, gained: 15, combo: 1, slipped: false });
  assert.deepEqual(rewardLines(t, null), [{ reason: 'recall', xp: 15, count: 1 }]);
  assert.deepEqual(rewardLines(newRewardTally(), null), []);
  assert.deepEqual(rewardLines(newRewardTally(), { perfectBlocks: 0, goalMetNow: false, bossWon: true }), [
    { reason: 'boss', xp: BONUS.bossWin, count: 1 },
  ]);
});

test('the floating number names its reason: a comeback first, then a run, else nothing', () => {
  assert.deepEqual(floatReason({ format: 'typed', ok: true, combo: 4, slipped: true }), { reason: 'comeback' });
  assert.deepEqual(floatReason({ format: 'typed', ok: true, combo: 4, slipped: false }), { reason: 'run', count: 4 });
  assert.equal(floatReason({ format: 'typed', ok: true, combo: 1, slipped: false }), null);
  assert.equal(floatReason({ format: 'mc', ok: true, combo: 1, slipped: true }), null, 'only a recall is a comeback');
  assert.equal(floatReason({ format: 'rain', ok: true, combo: 5, slipped: false }), null, 'arcade rounds pay flat');
  assert.equal(floatReason({ format: 'typed', ok: false, combo: 0, slipped: true }), null);
});
