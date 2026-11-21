// Exam simulator (#43): the clock, picking answers and the review list. No React, so it is easy to test.

/** Seconds left on a whole-exam clock of `minutes` that started at `startedAt` (ms). */
export const secondsLeft = (startedAt: number, minutes: number, now: number) =>
  Math.max(0, Math.ceil(minutes * 60 - (now - startedAt) / 1000));

/** 28:59, or 1:02:05 past an hour. Digits only, so it needs no translation. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const two = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

/** One-answer questions replace the choice; multi-select ones toggle it. */
export const toggleChoice = (chosen: number[], i: number, multi: boolean) =>
  !multi ? [i] : chosen.includes(i) ? chosen.filter((c) => c !== i) : [...chosen, i];

export type ReviewFilter = 'all' | 'flagged' | 'open';
export type ReviewRow = { index: number; answered: boolean; flagged: boolean };

/** The questions for the review before handing in: all, only flagged, or only unanswered. */
export function reviewRows(
  questions: { itemId: number }[],
  answers: Record<number, number[]>,
  flags: Set<number>,
  filter: ReviewFilter,
): ReviewRow[] {
  return questions
    .map((q, index) => ({ index, answered: !!answers[q.itemId]?.length, flagged: flags.has(q.itemId) }))
    .filter((r) => filter === 'all' || (filter === 'flagged' ? r.flagged : !r.answered));
}
