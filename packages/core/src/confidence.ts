// Confidence and calibration (#205). After a recall answer the learner may tap how sure they were, 1 to 5.
// It is stored with the answer and used only to show how well that feeling matches real recall. It never
// changes the schedule (FSRS), the mastery ladder or XP: only the answer itself does that.
import { getDb, type DB } from './db';
import { UserError } from './errors';

export const CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const isConfidence = (n: unknown): n is Confidence =>
  typeof n === 'number' && (CONFIDENCE_LEVELS as readonly number[]).includes(n);

/**
 * Save how sure the learner was of their last real answer to this card in this session. Practice answers
 * (a card brought back, practice mode) are never rated. A second rating replaces the first.
 */
export function rateConfidence(sessionId: string, itemId: number, confidence: number, d: DB = getDb()) {
  if (!isConfidence(confidence)) throw new UserError('invalid_confidence', 'Confidence must be 1 to 5');
  const last = d
    .prepare(
      `SELECT MAX(id) AS id FROM attempts WHERE item_id = ? AND session_id = ? AND practice = 0 AND format != 'gender'`,
    )
    .get(itemId, sessionId);
  if (!last || last.id === null) return { ok: false };
  d.prepare('UPDATE attempts SET confidence = ? WHERE id = ?').run(confidence, last.id);
  return { ok: true };
}

/** A rating needs this many answers followed by a review before Progress shows its share. */
export const CALIBRATION_MIN = 5;

export type CalibrationCount = { confidence: Confidence; rated: number; right: number };

/**
 * For each rating: how many rated answers were followed by a review, and how many of those reviews were
 * right. The review is the card's next graded answer on a later day (its first real recall that day);
 * practice, games and answers later the same day are left out. One grouped query over the rated answers
 * (partial index from migration 007) with one indexed look-up each.
 */
export function calibrationCounts(d: DB = getDb()): CalibrationCount[] {
  return d
    .prepare(
      `SELECT a.confidence AS confidence, COUNT(*) AS rated, SUM(nx.correct) AS right
       FROM attempts a
       JOIN attempts nx ON nx.id = (
         SELECT b.id FROM attempts b
         WHERE b.item_id = a.item_id AND b.day > a.day AND b.grade IS NOT NULL
         ORDER BY b.day, b.id LIMIT 1)
       WHERE a.confidence IS NOT NULL
       GROUP BY a.confidence ORDER BY a.confidence`,
    )
    .all()
    .filter((r) => isConfidence(Number(r.confidence)))
    .map((r) => ({ confidence: Number(r.confidence) as Confidence, rated: Number(r.rated), right: Number(r.right) }));
}

/**
 * The calibration chart (#205): every rating 1 to 5 with its share right at the next review (null until it
 * has CALIBRATION_MIN answers), and `lead`: the two surest ratings that have a share, surest first, for
 * "Cards you rated 5 were right 93% of the time at their next review; rated 4, 61%".
 */
export function calibration(counts: CalibrationCount[], min = CALIBRATION_MIN) {
  const levels = CONFIDENCE_LEVELS.map((confidence) => {
    const c = counts.find((x) => x.confidence === confidence);
    const rated = c?.rated ?? 0;
    const right = c?.right ?? 0;
    return { confidence, rated, right, rate: rated >= min ? right / rated : null };
  });
  return {
    levels,
    rated: levels.reduce((s, l) => s + l.rated, 0),
    lead: levels
      .filter((l) => l.rate !== null)
      .reverse()
      .slice(0, 2),
  };
}

export type Calibration = ReturnType<typeof calibration>;
