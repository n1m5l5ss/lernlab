// The FSRS scheduler (ts-fsrs), set up in one place so every caller schedules the same way.
// FSRS-6 with its default weights, no same-day learning steps (one grade per card per day, principle 1),
// and the learner's desired retention. test/scheduler.test.ts pins the dates this gives.
// ts-fsrs 6 marks this API (fsrs, generatorParameters, createEmptyCard) deprecated but keeps it on FSRS-6.
// Its new DefaultScheduler defaults to FSRS-7, which needs other weights and a full review history per card,
// and uses another card format: moving to it would need a migration of every stored card.
import { fsrs, generatorParameters, createEmptyCard, type Card, type CardInput, type Grade } from 'ts-fsrs';

export { createEmptyCard, type Card, type CardInput, type Grade };

const scheduler = (retention: number, fuzz: boolean) =>
  fsrs(generatorParameters({ request_retention: retention, enable_fuzz: fuzz, enable_short_term: false }));

/** Live reviews: fuzzed, so cards learned together spread out over the following days. */
export const liveScheduler = (retention: number) => scheduler(retention, true);

/** Replaying past reviews (the Anki history import): no fuzz, so the same history gives the same schedule. */
export const replayScheduler = (retention: number) => scheduler(retention, false);

/** FSRS's chance (0–1) that the card is recalled at `now`; 0 for a new card. Throws on a card it can't read. */
export const recallProbability = (card: CardInput, now: Date): number => replayScheduler(0.9).retrievability(card, now);

/** A card as stored in `srs.card` (JSON, so dates are strings). */
export type StoredCard = Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };

/** The card from its stored JSON, with real dates again. */
export function reviveCard(c: StoredCard): Card {
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined };
}
