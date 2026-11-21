// Pure layout for the Progress screen's charts: the study-day calendar and the weekly retention bars.
import { addDays } from '@lernlab/core/game';
import { LEVELS, type Level } from '@lernlab/core/variants';

/** 0 = no study; 1–3 = more minutes. Sessions are 5, 10 or 20 minutes, so the steps follow them. */
export type HeatLevel = 0 | 1 | 2 | 3;
export type HeatCell = { day: string; minutes: number; level: HeatLevel; future: boolean };

export function heatLevel(minutes: number, studied: boolean): HeatLevel {
  if (!studied) return 0;
  return minutes >= 20 ? 3 : minutes >= 10 ? 2 : 1;
}

/**
 * The calendar as columns of weeks (Monday at the top), from `since` (a Monday) to the week of `today`.
 * Days after today are kept so the last column is whole, and marked as future.
 */
export function heatmapWeeks(
  since: string,
  today: string,
  studyDays: { day: string; minutes: number }[],
): HeatCell[][] {
  const byDay = new Map(studyDays.map((s) => [s.day, s.minutes]));
  const weeks: HeatCell[][] = [];
  for (let start = since; start <= today; start = addDays(start, 7))
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const minutes = byDay.get(day) ?? 0;
        return { day, minutes, level: heatLevel(minutes, byDay.has(day)), future: day > today };
      }),
    );
  return weeks;
}

/** Columns where a new month begins (its 1st falls in that week), for the labels above the calendar. */
export function monthStarts(weeks: HeatCell[][]): { column: number; day: string }[] {
  const out: { column: number; day: string }[] = [];
  weeks.forEach((w, column) => {
    const first = w.find((c) => c.day.endsWith('-01'));
    if (first) out.push({ column, day: first.day });
  });
  return out;
}

/** Share of reviews recalled, or null for a week without reviews (an empty week is not 0 %). */
export const recallRate = (w: { reviews: number; recalled: number }) => (w.reviews ? w.recalled / w.reviews : null);

/** Where week `x` of `count` is drawn: oldest first in reading order, so right to left mirrors the calendar. */
export const heatColumn = (x: number, count: number, dir: 'ltr' | 'rtl') => (dir === 'rtl' ? count - 1 - x : x);

/** At least this many answers before Progress says the mix leans on recall. */
export const LEVEL_HINT_MIN = 10;

/**
 * A deck's question levels as shares of its answers (#198), and whether nearly all were recall (80 % or more),
 * so Progress can suggest, once and gently, the apply and analyse questions a mock exam mixes in.
 */
export function levelMix(levels: Record<Level, number>) {
  const total = LEVELS.reduce((s, l) => s + levels[l], 0);
  return {
    shares: LEVELS.map((level) => ({ level, share: total ? levels[level] / total : 0 })),
    mostlyRecall: total >= LEVEL_HINT_MIN && levels.recall / total >= 0.8,
  };
}
