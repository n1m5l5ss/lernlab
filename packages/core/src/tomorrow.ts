// "Will you know this tomorrow?" (#205). At the end of a session with new cards, the learner sees each new
// card's question only and answers yes, unsure or no. A judgement made from the question alone predicts recall
// better than one made with the answer in view. The next session shows how those guesses held up, and puts the
// "unsure" cards first in the warm-up. Kept in `meta` on this computer; it never changes the schedule (FSRS).
import { getDb, getMeta, setMeta, type DB } from './db';
import { UserError } from './errors';
import { dayKey } from './game';

export const TOMORROW_ANSWERS = ['yes', 'unsure', 'no'] as const;
export type TomorrowAnswer = (typeof TOMORROW_ANSWERS)[number];
/** Most cards one check holds (a long session meets far fewer new cards). */
export const TOMORROW_MAX = 100;

type Check = {
  day: string;
  answers: { itemId: number; answer: TomorrowAnswer }[];
  /** The day the result was first shown; it is shown only that day. */
  reported?: string;
};
const KEY = 'tomorrowCheck';

/** Save the answers (the day's check grows as sessions end; a card's newer answer replaces its older one). */
export function saveTomorrowCheck(
  answers: { itemId: number; answer: TomorrowAnswer }[],
  d: DB = getDb(),
  now = new Date(),
) {
  if (answers.some((a) => !TOMORROW_ANSWERS.includes(a.answer)))
    throw new UserError('invalid_input', 'An answer must be yes, unsure or no');
  const day = dayKey(now);
  const prev = getMeta<Check | null>(d, KEY, null);
  const byId = new Map(prev?.day === day ? prev.answers.map((a) => [a.itemId, a.answer]) : []);
  const exists = d.prepare('SELECT 1 FROM items WHERE id = ?');
  for (const a of answers) if (exists.get(a.itemId)) byId.set(a.itemId, a.answer);
  const check: Check = {
    day,
    answers: [...byId].slice(0, TOMORROW_MAX).map(([itemId, answer]) => ({ itemId, answer })),
  };
  setMeta(d, KEY, check);
  return { cards: check.answers.length };
}

/** The first real review (graded answer) of each card after the check's day. */
function nextReviews(d: DB, check: Check): Map<number, boolean> {
  const ids = check.answers.map((a) => Number(a.itemId)).filter(Number.isSafeInteger);
  const first = new Map<number, boolean>();
  if (!ids.length) return first;
  const rows = d
    .prepare(
      `SELECT item_id, correct FROM attempts WHERE item_id IN (${ids.join(',')}) AND day > ? AND grade IS NOT NULL
       ORDER BY day, id`,
    )
    .all(check.day);
  for (const r of rows) if (!first.has(Number(r.item_id))) first.set(Number(r.item_id), Number(r.correct) === 1);
  return first;
}

const pending = (d: DB, now: Date): Check | null => {
  const check = getMeta<Check | null>(d, KEY, null);
  return check && check.day < dayKey(now) ? check : null;
};

/** Cards answered "unsure" in the last check that have not come back for review yet (the warm-up starts with them). */
export function tomorrowUnsure(d: DB = getDb(), now = new Date()): number[] {
  const check = pending(d, now);
  if (!check) return [];
  const reviewed = nextReviews(d, check);
  return check.answers.filter((a) => a.answer === 'unsure' && !reviewed.has(a.itemId)).map((a) => a.itemId);
}

/**
 * How the last check held up, for the end of the next session: per answer, the cards, how many came back for
 * review and how many of those were right. Null until one of them was reviewed, and after the day it was
 * first shown.
 */
export function reportTomorrowCheck(d: DB = getDb(), now = new Date()) {
  const check = pending(d, now);
  const today = dayKey(now);
  if (!check || (check.reported && check.reported !== today)) return null;
  const reviewed = nextReviews(d, check);
  if (!reviewed.size) return null;
  const groups = Object.fromEntries(
    TOMORROW_ANSWERS.map((answer) => {
      const cards = check.answers.filter((a) => a.answer === answer);
      const seen = cards.filter((a) => reviewed.has(a.itemId));
      return [
        answer,
        { cards: cards.length, reviewed: seen.length, right: seen.filter((a) => reviewed.get(a.itemId)).length },
      ];
    }),
  ) as Record<TomorrowAnswer, { cards: number; reviewed: number; right: number }>;
  if (!check.reported) setMeta(d, KEY, { ...check, reported: today });
  return { day: check.day, groups };
}
