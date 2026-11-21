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
