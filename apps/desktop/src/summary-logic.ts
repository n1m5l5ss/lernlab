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

/**
 * The level-up, new badges and streak news this session earned. Empty for an ordinary session.
 * Calm mode (#216) leaves out the level and the badges (badges still show on Progress); streak news is
 * information about your days, so it stays.
 */
export function summaryMoments(f: SummaryFacts, server: FinishLike | null, calm = false): Moment[] {
  const out: Moment[] = [];
  if (f.levelUp && !calm) out.push({ kind: 'level', level: f.levelUp });
  if (!calm) for (const u of server?.unlocked ?? []) out.push({ kind: 'badge', key: u.key });
  const s = server?.streakChange;
  if (s?.freezeEarned) out.push({ kind: 'freeze' });
  if (s?.repaired) out.push({ kind: 'repaired' });
  if (s?.repairDone) out.push({ kind: 'repairProgress', done: s.repairDone });
  return out;
}

/** Whether the summary celebrates (confetti, the level-up sound): a real milestone, and never in calm mode. */
export const celebrates = (
  f: Pick<SummaryFacts, 'levelUp'>,
  server: { goalMetNow?: boolean; unlocked?: unknown[] } | null,
  calm: boolean,
) => !calm && !!(server?.goalMetNow || server?.unlocked?.length || f.levelUp);

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

/** Most new cards the tomorrow check asks about. */
export const TOMORROW_SHOWN = 12;

/**
 * "Will you know this tomorrow?" (#205): the new cards met in this session, each with its question only (the
 * answer stays hidden: a judgement from the question alone predicts recall better). None in practice mode.
 */
export function tomorrowCards(
  result: { practice: boolean; newCards: number[] },
  items: Record<number, Item>,
  qa: (item: Item) => { prompt: string },
): { id: number; prompt: string }[] {
  if (result.practice) return [];
  return [...new Set(result.newCards)]
    .filter((id) => items[id])
    .slice(0, TOMORROW_SHOWN)
    .map((id) => ({ id, prompt: qa(items[id]).prompt }));
}

type Group = { cards: number; reviewed: number; right: number };
/** How the last check held up: each answer (yes, unsure, no) whose cards have come back, with how many were right. */
export function tomorrowReport(groups: Record<'yes' | 'unsure' | 'no', Group>) {
  return (['yes', 'unsure', 'no'] as const)
    .filter((answer) => groups[answer].reviewed > 0)
    .map((answer) => ({ answer, reviewed: groups[answer].reviewed, right: groups[answer].right }));
}
