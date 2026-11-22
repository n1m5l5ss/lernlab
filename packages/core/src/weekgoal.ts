// Weekly goals (#214): each deck's goal, exam date and recent pace become one small goal for this week, such as
// "40 new cards, 5 sessions". Nothing is stored: the goal is worked out again from where you are, so a missed
// week is never owed. What is left is simply spread over the weeks that remain. Pure functions.
import { daysBetween } from './game';

export const WEEK_GOAL = {
  /** Without an exam date: at least this many new cards a week (or all that is left). */
  minCards: 10,
  minSessions: 3,
  maxSessions: 7,
  /** The session goal follows the average of this many earlier weeks. */
  historyWeeks: 4,
} as const;

const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * New cards to learn in one deck this week.
 * `left`: cards still to learn (to the deck's goal, or the whole deck) now; `done`: cards first recalled since
 * Monday, so the goal stays the same all week. With an exam date ahead, what was left on Monday is spread over
 * the weeks until the exam (the exam's own week counts). Without one, the goal is your pace of the last weeks,
 * with a small floor. It never asks for more than the deck's new cards per day allow.
 */
export function weekCardTarget(g: {
  left: number;
  done: number;
  examDate: string | null | undefined;
  /** The Monday of this week (a day key). */
  week: string;
  /** Cards first recalled per week, lately. */
  perWeek: number;
  newPerDay: number;
}): number {
  const atStart = Math.max(0, g.left) + Math.max(0, g.done);
  const room = Math.max(0, Math.floor(g.newPerDay)) * 7;
  const daysToExam = isDay(g.examDate) ? daysBetween(g.week, g.examDate) : -1;
  const want =
    daysToExam >= 0
      ? Math.ceil(atStart / Math.max(1, Math.ceil((daysToExam + 1) / 7)))
      : Math.max(WEEK_GOAL.minCards, Math.ceil(g.perWeek));
  return Math.min(atStart, room, want);
}

/** Sessions to aim for this week: one more than the average of the earlier weeks, between 3 and 7. */
export function weekSessionTarget(earlierWeeks: number[]): number {
  const avg = earlierWeeks.length ? earlierWeeks.reduce((s, n) => s + n, 0) / earlierWeeks.length : 0;
  return Math.min(WEEK_GOAL.maxSessions, Math.max(WEEK_GOAL.minSessions, Math.ceil(avg) + 1));
}
