// "Your own numbers" (#215): how often you recalled a card after it had been away for days, weeks or months,
// next to repeats on the same day. People trust spacing once they see it work on themselves, so Progress shows
// these counts from the learner's own answers. They describe what happened; they are not an experiment (the
// groups hold different cards), and the screen says so. Reads only.
import { getDb, type DB } from './db';
import { addDays, dayKey } from './game';
import { RECALL_FORMATS } from './types';

export const SPACING = {
  /** A group shows its share once it has this many answers. */
  minAnswers: 20,
  /** Answers of the last year, */
  windowDays: 365,
  /** and at most this many of the newest ones, so Progress stays quick on a long history. */
  maxAnswers: 2000,
} as const;

/** How long the card was away before the answer: the same day, 1–6 days, 7–29 days, 30 days or more. */
export const SPACING_GROUPS = ['sameDay', 'days', 'weeks', 'months'] as const;
export type SpacingKey = (typeof SPACING_GROUPS)[number];
export type SpacingCount = { key: SpacingKey; answers: number; right: number };
export type SpacingGroup = SpacingCount & { rate: number | null };

export const spacingGroup = (gapDays: number): SpacingKey =>
  gapDays < 1 ? 'sameDay' : gapDays < 7 ? 'days' : gapDays < 30 ? 'weeks' : 'months';

/**
 * Every group with its share right (null until it has enough answers). `longest`: the longest gap with enough
 * answers, the number that shows what lasts; null until there is one, and then the screen claims nothing.
 */
export function spacingReport(counts: SpacingCount[]): {
  groups: SpacingGroup[];
  longest: SpacingGroup | null;
  sameDay: SpacingGroup | null;
} {
  const groups = SPACING_GROUPS.map((key) => {
    const c = counts.find((x) => x.key === key) ?? { key, answers: 0, right: 0 };
    return { ...c, rate: c.answers >= SPACING.minAnswers ? c.right / c.answers : null };
  });
  const shown = groups.filter((g) => g.rate !== null);
  return {
    groups,
    longest: shown.filter((g) => g.key !== 'sameDay').at(-1) ?? null,
    sameDay: shown.find((g) => g.key === 'sameDay') ?? null,
  };
}

/**
 * The most recent recall answers (at most `limit`, from the last year), by the days since the card's recall
 * answer before. Same day: any repeat, practice included (cards brought back in a session). After a gap: real
 * reviews only, right when recalled (Hard or better). A card's first recall answer has no gap and is left out.
 * Bounded so Progress stays quick on a long history: the newest answers by id, each with one indexed look-up
 * of the answer before it (about 7 ms on the 100,000-card benchmark database; reading a whole year of
 * 186,000 answers with a window function took about 150 ms).
 */
export function spacingCounts(d: DB = getDb(), now = new Date(), limit: number = SPACING.maxAnswers): SpacingCount[] {
  const formats = RECALL_FORMATS.map((f) => `'${f}'`).join(',');
  return d
    .prepare(
      `SELECT CASE WHEN gap < 1 THEN 'sameDay' WHEN gap < 7 THEN 'days' WHEN gap < 30 THEN 'weeks' ELSE 'months' END AS key,
              COUNT(*) AS answers,
              COALESCE(SUM(CASE WHEN gap < 1 THEN correct ELSE grade >= 2 END), 0) AS right
       FROM (SELECT a.practice, a.grade, a.correct,
                    CAST(round(julianday(a.day) - julianday(
                      (SELECT p.day FROM attempts p WHERE p.item_id = a.item_id AND p.id < a.id
                         AND p.format IN (${formats}) ORDER BY p.id DESC LIMIT 1))) AS INTEGER) AS gap
             FROM (SELECT id, item_id, day, practice, grade, correct FROM attempts
                   WHERE format IN (${formats}) AND day >= ? ORDER BY id DESC LIMIT ?) a)
       WHERE gap IS NOT NULL AND (gap < 1 OR (practice = 0 AND grade >= 1))
       GROUP BY key`,
    )
    .all(addDays(dayKey(now), -SPACING.windowDays), Math.max(1, Math.floor(limit)))
    .map((r) => ({ key: r.key as SpacingKey, answers: Number(r.answers), right: Number(r.right) }));
}
