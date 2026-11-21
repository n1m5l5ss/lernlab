// The numbers the session summary shows, worked out from the session result and the finish response.
import type { Item } from '@lernlab/core/types';
import { levelFor } from '@lernlab/core/game';

export type SummaryFacts = {
  recalled: number;
  total: number;
  minutes: number;
  introduced: number;
  xp: number;
  level: { next: number; toNext: number; percent: number } | null;
  daysThisWeek: number | null;
  /** The new level when this session crossed a level line, else null. */
  levelUp: number | null;
  missed: Item[];
};

/** One celebration line at the end of a session, in the order the summary shows them. */
export type Moment =
  | { kind: 'level'; level: number }
  | { kind: 'badge'; key: string }
  | { kind: 'freeze' }
  | { kind: 'repaired' }
  | { kind: 'repairProgress'; done: number };

type FinishLike = {
  unlocked?: { key: string }[];
  streakChange?: { freezeEarned: boolean; repaired: boolean; repairDone: number | null };
};

/** The level-up, new badges and streak news this session earned. Empty for an ordinary session. */
export function summaryMoments(f: SummaryFacts, server: FinishLike | null): Moment[] {
  const out: Moment[] = [];
  if (f.levelUp) out.push({ kind: 'level', level: f.levelUp });
  for (const u of server?.unlocked ?? []) out.push({ kind: 'badge', key: u.key });
  const s = server?.streakChange;
  if (s?.freezeEarned) out.push({ kind: 'freeze' });
  if (s?.repaired) out.push({ kind: 'repaired' });
  if (s?.repairDone) out.push({ kind: 'repairProgress', done: s.repairDone });
  return out;
}

/** How many missed cards the "come back tomorrow" list shows. */
export const MISSED_SHOWN = 6;

export function summaryFacts(
  result: { correct: number; answers: number; seconds: number; xp: number; introduced: number; missed: number[] },
  server: { bonus: number; sessionXp?: number; state: { totalXp: number; week: { studied: boolean }[] } } | null,
  items: Record<number, Item>,
): SummaryFacts {
  const level = server ? levelFor(server.state.totalXp) : null;
  const before = server ? levelFor(Math.max(0, server.state.totalXp - (server.sessionXp ?? 0))) : null;
  return {
    recalled: result.correct,
    total: result.answers,
    minutes: Math.max(1, Math.round(result.seconds / 60)),
    introduced: result.introduced,
    xp: result.xp + (server?.bonus ?? 0),
    level: level && {
      next: level.level + 1,
      toNext: Math.max(0, level.span - level.into),
      percent: Math.round((level.into / level.span) * 100),
    },
    levelUp: level && before && level.level > before.level ? level.level : null,
    daysThisWeek: server ? server.state.week.filter((d) => d.studied).length : null,
    missed: result.missed
      .map((id) => items[id])
      .filter(Boolean)
      .slice(0, MISSED_SHOWN),
  };
}
