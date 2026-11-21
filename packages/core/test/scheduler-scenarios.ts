// Fixed review sequences for test/scheduler.test.ts, the regression test for the FSRS library (ts-fsrs).
import { createEmptyCard, liveScheduler, replayScheduler, reviveCard, type Card, type Grade } from '../src/scheduler';
import type { StoredCard } from '../src/scheduler';
import { reviewsFromRevlog, replayReviews, type RevlogRow } from '../src/ankihistory';

/** What the test compares after each answer. Memory is rounded to 4 places; the dates are what matter. */
export type Step = { due: string; days: number; state: number; reps: number; lapses: number; s: number; d: number };
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
export const step = (c: Card): Step => ({
  due: c.due.toISOString(),
  days: c.scheduled_days,
  state: c.state,
  reps: c.reps,
  lapses: c.lapses,
  s: r4(c.stability),
  d: r4(c.difficulty),
});

/** Answers at fixed times (not "when due"), so a different fuzz never moves the later answers. */
export type Answer = [iso: string, grade: Grade];
export const NEW_CARD: Answer[] = [
  ['2026-01-05T09:00:00.000Z', 3], // first answer, Good
  ['2026-01-08T09:30:00.000Z', 3], // Good
  ['2026-01-20T18:00:00.000Z', 2], // Hard
  ['2026-02-15T07:15:00.000Z', 3], // Good
  ['2026-04-20T12:00:00.000Z', 1], // Again: a lapse
  ['2026-04-21T12:00:00.000Z', 3], // Good the next day
  ['2026-04-25T12:00:00.000Z', 4], // Easy
  ['2026-04-27T12:00:00.000Z', 3], // Good, early (before it was due)
  ['2027-03-01T12:00:00.000Z', 3], // Good, very late
];
export const NEW_AGAIN: Answer[] = [
  ['2026-03-02T10:00:00.000Z', 1], // a new card answered Again
  ['2026-03-03T10:00:00.000Z', 1], // and Again
  ['2026-03-04T10:00:00.000Z', 4], // then Easy
];

export function run(answers: Answer[], live: boolean, retention = 0.9, start?: Card): Step[] {
  const f = live ? liveScheduler(retention) : replayScheduler(retention);
  let card = start ?? createEmptyCard(new Date(answers[0][0]));
  return answers.map(([iso, grade]) => step((card = f.next(card, new Date(iso), grade).card)));
}

/** Cards as LernLab 1.0 stored them (ts-fsrs 5.4.2 JSON, with its elapsed_days), about to be answered again. */
export const STORED: Record<string, StoredCard> = {
  learning: JSON.parse(
    '{"due":"2026-06-01T08:10:00.000Z","stability":2.3065,"difficulty":2.11810397,"elapsed_days":0,"scheduled_days":0,"learning_steps":1,"reps":1,"lapses":0,"state":1,"last_review":"2026-06-01T08:00:00.000Z"}',
  ),
  relearning: JSON.parse(
    '{"due":"2026-06-02T09:10:00.000Z","stability":1.2,"difficulty":7.5,"elapsed_days":30,"scheduled_days":0,"learning_steps":0,"reps":6,"lapses":2,"state":3,"last_review":"2026-06-02T09:00:00.000Z"}',
  ),
  review: JSON.parse(
    '{"due":"2026-06-20T12:00:00.000Z","stability":24.5,"difficulty":5.1,"elapsed_days":12,"scheduled_days":24,"learning_steps":0,"reps":5,"lapses":1,"state":2,"last_review":"2026-05-27T12:00:00.000Z"}',
  ),
};
export const STORED_ANSWERS: Record<string, Answer[]> = {
  learning: [
    ['2026-06-02T08:00:00.000Z', 3],
    ['2026-06-05T08:00:00.000Z', 3],
  ],
  relearning: [
    ['2026-06-03T09:00:00.000Z', 2],
    ['2026-06-06T09:00:00.000Z', 3],
  ],
  review: [
    ['2026-06-20T12:00:00.000Z', 3],
    ['2026-07-30T12:00:00.000Z', 1],
    ['2026-07-31T12:00:00.000Z', 3],
  ],
};
export const runStored = (name: string, live: boolean) =>
  run(STORED_ANSWERS[name], live, 0.9, reviveCard(STORED[name]));

/** An Anki revlog (#48): learning steps on day one, reviews, a lapse and relearning, a cram that is skipped. */
const t = (iso: string) => Date.parse(iso);
export const REVLOG: RevlogRow[] = [
  { time: t('2025-09-01T10:00:00Z'), ease: 1, type: 0, ivl: -60, factor: 0 },
  { time: t('2025-09-01T10:01:00Z'), ease: 3, type: 0, ivl: -600, factor: 0 },
  { time: t('2025-09-01T10:11:00Z'), ease: 3, type: 0, ivl: 1, factor: 2500 },
  { time: t('2025-09-02T11:00:00Z'), ease: 3, type: 1, ivl: 3, factor: 2500 },
  { time: t('2025-09-05T11:00:00Z'), ease: 4, type: 1, ivl: 10, factor: 2650 },
  { time: t('2025-09-15T11:00:00Z'), ease: 1, type: 1, ivl: -600, factor: 2450 },
  { time: t('2025-09-15T11:10:00Z'), ease: 3, type: 2, ivl: 1, factor: 2450 },
  { time: t('2025-09-16T11:00:00Z'), ease: 2, type: 1, ivl: 2, factor: 2300 },
  { time: t('2025-09-18T11:00:00Z'), ease: 3, type: 3, ivl: 0, factor: 0 },
  { time: t('2025-09-20T11:00:00Z'), ease: 3, type: 1, ivl: 6, factor: 2300 },
  { time: t('2025-10-01T11:00:00Z'), ease: 3, type: 1, ivl: 15, factor: 2300 },
];
export function replayRevlog(retention = 0.9) {
  const { card, steps, lapses } = replayReviews(reviewsFromRevlog(REVLOG), retention);
  return { final: step(card), steps: steps.map((s) => step(s.card)), lapses };
}

/** Every sequence, to print the expected values or compare two versions of the library. */
export const all = () => ({
  newLive: run(NEW_CARD, true),
  newReplay: run(NEW_CARD, false),
  newLive80: run(NEW_CARD, true, 0.8),
  newLive95: run(NEW_CARD, true, 0.95),
  againLive: run(NEW_AGAIN, true),
  storedLearning: runStored('learning', true),
  storedRelearning: runStored('relearning', true),
  storedReview: runStored('review', true),
  storedReviewReplay: runStored('review', false),
  anki: replayRevlog(),
});
