// Anki review history (#48): replay the reviews in an Anki revlog with FSRS, so imported cards keep
// their schedule instead of starting from zero. Rules (also in docs/FORMAT.md, "Anki .apkg"):
// - Only real answers count: revlog types 0 learn, 1 review, 2 relearn, and 3 filtered deck when it
//   reschedules (factor > 0). Skipped: 3 with factor 0 (cramming that did not change the schedule),
//   4 manual ("set due date", "forget"), 5 rescheduled by Anki, and any entry without a button (ease 1–4).
// - A "forget" (type 4 with interval 0) reset the card to new in Anki, so the history before it is dropped.
// - One grade per card per day, like LernLab: the first answer of each learning day (4 a.m. to 4 a.m.).
import { createEmptyCard, replayScheduler, type Card, type Grade } from './scheduler';
import { tx, type DB } from './db';
import { dayKey } from './game';
import { getSettings } from './learn';

/** One row of Anki's revlog: `time` is its id (milliseconds), `ease` the button (1 Again … 4 Easy). */
export type RevlogRow = { time: number; ease: number; type: number; ivl: number; factor: number };
/** A past answer that counts for the schedule. */
export type PastReview = { time: number; day: string; grade: Grade };

/** The answers in a card's revlog that count, oldest first, at most one per day. */
export function reviewsFromRevlog(rows: RevlogRow[]): PastReview[] {
  let out: PastReview[] = [];
  let lastDay = '';
  for (const r of [...rows].sort((a, b) => a.time - b.time)) {
    if (!Number.isFinite(r.time) || r.time <= 0) continue;
    if (r.type === 4 && r.ivl === 0) {
      out = [];
      lastDay = '';
      continue;
    }
    if (r.type > 3 || r.type < 0 || !(r.ease >= 1 && r.ease <= 4)) continue;
    if (r.type === 3 && !r.factor) continue;
    const day = dayKey(new Date(r.time));
    if (day === lastDay) continue;
    lastDay = day;
    out.push({ time: r.time, day, grade: r.ease as Grade });
  }
  return out;
}

/** The FSRS card after each answer, and at the end. No fuzz, so the same history gives the same schedule. */
export function replayReviews(reviews: PastReview[], retention: number) {
  const f = replayScheduler(retention);
  let card: Card = createEmptyCard(new Date(reviews[0].time));
  const steps: { time: number; card: Card }[] = [];
  for (const r of reviews) {
    card = f.next(card, new Date(r.time), r.grade).card;
    steps.push({ time: r.time, card });
  }
  return { card, steps, lapses: reviews.filter((r) => r.grade === 1).length };
}

/**
 * Give the deck's cards their Anki schedule (keyed by card id = Anki note id) and log the past reviews in
 * `imported_reviews`. Cards already studied in LernLab keep their own progress. One transaction.
 * Returns how many reviews were brought over.
 */
export function importAnkiHistory(deckId: number, history: Map<number, PastReview[]>, d: DB): number {
  if (!history.size) return 0;
  const retention = getSettings(d).retention;
  return tx(d, () => {
    const inDeck = d.prepare('SELECT 1 FROM items WHERE id = ? AND deck_id = ?');
    const studied = d.prepare('SELECT 1 FROM srs WHERE item_id = ? AND reps > 0');
    const setSrs = d.prepare(
      `INSERT OR REPLACE INTO srs(item_id, card, due, introduced_day, last_graded_day, reps, lapses)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const state = d.prepare('INSERT OR IGNORE INTO item_state(item_id) VALUES (?)');
    const log = d.prepare(
      'INSERT OR IGNORE INTO imported_reviews(item_id, ts, day, grade, source) VALUES (?, ?, ?, ?, ?)',
    );
    let count = 0;
    for (const [id, reviews] of history) {
      if (!reviews.length || !inDeck.get(id, deckId) || studied.get(id)) continue;
      const { card, lapses } = replayReviews(reviews, retention);
      const last = reviews[reviews.length - 1].day;
      setSrs.run(id, JSON.stringify(card), card.due.toISOString(), reviews[0].day, last, reviews.length, lapses);
      state.run(id);
      for (const r of reviews) log.run(id, new Date(r.time).toISOString(), r.day, r.grade, 'anki');
      count += reviews.length;
    }
    return count;
  });
}
