// Sleep bridge (#217): an optional study rhythm, off by default. People who sleep between learning and
// relearning need about half the trials and remember more later [Mazza et al. 2016]. With it on:
// - new cards wait for the evening session (from EVENING_HOUR), but only on the day after an evening session,
//   so a learner who studies at other times is never kept from new cards;
// - the next session before the evening starts with a short check of last night's new and missed cards. That
//   is a new study day, so the check is a normal FSRS review: one grade per card per day.
import { getDb, type DB } from './db';
import { dayKey } from './game';
import type { Settings } from './learn';

/** Sessions from this hour until the study day ends (4 a.m.) are evening sessions. */
export const EVENING_HOUR = 17;
/** Most cards in one morning check. */
export const CHECK_MAX = 12;

export const isEvening = (now: Date): boolean => now.getHours() >= EVENING_HOUR || now.getHours() < 4;

const yesterday = (now: Date) => dayKey(new Date(now.getTime() - 86_400_000));

/** Was the last answer of yesterday's study day given in the evening? */
export function studiedLastEvening(d: DB = getDb(), now = new Date()): boolean {
  const ts = d.prepare('SELECT MAX(ts) AS ts FROM attempts WHERE day = ?').get(yesterday(now))?.ts;
  return typeof ts === 'string' && isEvening(new Date(ts));
}

/** New cards wait for tonight: the rhythm is on, it is not evening yet, and yesterday ended with an evening session. */
export const holdNewCards = (settings: Pick<Settings, 'sleepBridge'>, d: DB = getDb(), now = new Date()): boolean =>
  settings.sleepBridge === true && !isEvening(now) && studiedLastEvening(d, now);

/** Yesterday's new and missed cards that were not reviewed yet today, in deck order (every deck). */
export function morningCheckIds(d: DB = getDb(), now = new Date()): number[] {
  const y = yesterday(now);
  return d
    .prepare(
      `SELECT s.item_id FROM srs s JOIN items i ON i.id = s.item_id LEFT JOIN item_state st ON st.item_id = s.item_id
       WHERE i.suspended = 0 AND i.kind != 'grammar' AND (s.introduced_day = ? OR st.last_wrong_day = ?)
         AND (s.last_graded_day IS NULL OR s.last_graded_day != ?) ORDER BY i.deck_id, i.ord LIMIT 500`,
    )
    .all(y, y, dayKey(now))
    .map((r) => Number(r.item_id));
}
