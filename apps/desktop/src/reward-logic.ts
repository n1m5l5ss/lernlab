// Rewards that say what they are for (#216): the XP of a session, sorted by what earned it, so the summary can
// list "+40 · 3 cards recalled after a slip" instead of one bare number. Pure, so it can be tested.
import { ARCADE_FORMATS, BONUS, xpFor } from '@lernlab/core/game';
import { RECALL_FORMATS, type Format } from '@lernlab/core/types';

type Part = { xp: number; count: number };
/** What the answers of one session earned, by reason. `run.count` is the longest run of right answers. */
export type RewardTally = { recall: Part; comeback: Part; practice: Part; tried: Part; run: Part };
export const newRewardTally = (): RewardTally => ({
  recall: { xp: 0, count: 0 },
  comeback: { xp: 0, count: 0 },
  practice: { xp: 0, count: 0 },
  tried: { xp: 0, count: 0 },
  run: { xp: 0, count: 0 },
});

type Answered = {
  format: Format;
  ok: boolean;
  /** Answers right in a row, this one included. */
  combo: number;
  /** The card was missed earlier in this session. */
  slipped: boolean;
};

/** Adds one answer's XP (`gained`, from xpFor) to the reason that earned it. Changes and returns `t`. */
export function addReward(t: RewardTally, a: Answered & { gained: number }): RewardTally {
  if (!a.ok) {
    t.tried.xp += a.gained;
    t.tried.count++;
    return t;
  }
  const inARow = Math.max(0, a.gained - xpFor(a.format, true, 1));
  t.run.xp += inARow;
  t.run.count = Math.max(t.run.count, a.combo);
  const part = !RECALL_FORMATS.includes(a.format) ? t.practice : a.slipped ? t.comeback : t.recall;
  part.xp += a.gained - inARow;
  part.count++;
  return t;
}

export type RewardReason = keyof RewardTally | 'perfect' | 'goal' | 'boss';
export type RewardLine = { reason: RewardReason; xp: number; count: number };

/**
 * Every reason this session earned XP, biggest first. `finish` is what the recorded session added (whole rounds
 * right, the daily goal, the boss), or null when recording failed: then only the answers are listed.
 * The lines add up to the XP the summary shows.
 */
export function rewardLines(
  t: RewardTally,
  finish: { perfectBlocks: number; goalMetNow: boolean; bossWon: boolean } | null,
): RewardLine[] {
  const lines: RewardLine[] = (['recall', 'comeback', 'practice', 'run', 'tried'] as const).map((reason) => ({
    reason,
    ...t[reason],
  }));
  if (finish) {
    lines.push({ reason: 'perfect', xp: finish.perfectBlocks * BONUS.perfectBlock, count: finish.perfectBlocks });
    if (finish.goalMetNow) lines.push({ reason: 'goal', xp: BONUS.dailyGoal, count: 1 });
    if (finish.bossWon) lines.push({ reason: 'boss', xp: BONUS.bossWin, count: 1 });
  }
  const order = ['perfect', 'recall', 'goal', 'boss', 'comeback', 'practice', 'run', 'tried'];
  return lines.filter((l) => l.xp > 0).sort((a, b) => b.xp - a.xp || order.indexOf(a.reason) - order.indexOf(b.reason));
}

/** The reason shown next to the number that floats up after an answer; null for an ordinary one. */
export function floatReason(a: Answered): { reason: 'comeback' } | { reason: 'run'; count: number } | null {
  if (!a.ok) return null;
  if (a.slipped && RECALL_FORMATS.includes(a.format)) return { reason: 'comeback' };
  if (a.combo >= 2 && !ARCADE_FORMATS.includes(a.format)) return { reason: 'run', count: a.combo };
  return null;
}
