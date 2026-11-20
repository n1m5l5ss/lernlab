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
  missed: Item[];
};

/** How many missed cards the "come back tomorrow" list shows. */
export const MISSED_SHOWN = 6;

export function summaryFacts(
  result: { correct: number; answers: number; seconds: number; xp: number; introduced: number; missed: number[] },
  server: { bonus: number; state: { totalXp: number; week: { studied: boolean }[] } } | null,
  items: Record<number, Item>,
): SummaryFacts {
  const level = server ? levelFor(server.state.totalXp) : null;
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
    daysThisWeek: server ? server.state.week.filter((d) => d.studied).length : null,
    missed: result.missed
      .map((id) => items[id])
      .filter(Boolean)
      .slice(0, MISSED_SHOWN),
  };
}
