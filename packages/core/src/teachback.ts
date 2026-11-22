// Teach-back (#208): for a tag the learner has mastered, "Explain this to a beginner in 60 seconds". They
// type or record an explanation, compare it with the tag's key points and tick the ones they missed; the
// cards behind those points can then be practised. Teaching what you know helps: preparing to teach
// g = 0.35, teaching g = 0.56 [Kobayashi 2019; Fiorella & Mayer 2016].
// It is optional practice: nothing here is saved, graded or scheduled, and the 60 seconds is a suggestion.
import { clozeText, mcqOf } from './cards';
import { KNOWN_MASTERY } from './browse';
import { getDb, type DB } from './db';
import { keyPointsOf } from './explain';
import type { Row } from './host';
import { ITEM_SELECT, rowToItem } from './learn';
import { isMyth } from './misconceptions';
import { shuffle, stripHtml } from './text';
import type { Item } from './types';

/** A tag is a topic to teach back once it has at least this many cards and this share of them is known. */
export const TEACH_MIN_CARDS = 3;
export const TEACH_KNOWN_SHARE = 0.8;
/** At most this many topics are offered, and this many key points are checked for one topic. */
export const TEACH_TOPICS_MAX = 12;
export const TEACH_POINTS_MAX = 8;
/** A suggestion shown to the learner, never a timer. */
export const TEACH_SECONDS = 60;

export type TeachTopic = { tag: string; cards: number };
/** One thing a good explanation of the topic says, and the card it comes from. */
export type TeachPoint = { itemId: number; about: string; text: string };

// `why` and `how` say how a card is asked (explain.ts); they are not topics.
const NOT_TOPICS = new Set(['why', 'how']);
const tagsOf = (r: Row): string[] => {
  try {
    const t = JSON.parse(String(r.tags ?? '[]'));
    return Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
  } catch {
    return [];
  }
};

/** Is a tag mastered? Enough cards, and most of them known. */
export const isMastered = (cards: number, known: number): boolean =>
  cards >= TEACH_MIN_CARDS && known / cards >= TEACH_KNOWN_SHARE;

/** The tags to offer for teaching back: mastered tags of subject decks (not vocabulary), biggest first. */
export function teachBackTopics(d: DB = getDb()): TeachTopic[] {
  const rows = d
    .prepare(
      `SELECT i.tags, COALESCE(st.mastery, 0) AS mastery FROM items i
       JOIN decks dk ON dk.id = i.deck_id LEFT JOIN item_state st ON st.item_id = i.id
       WHERE i.suspended = 0 AND i.tags != '[]' AND dk.language IS NULL ORDER BY i.ord`,
    )
    .all();
  const topics = new Map<string, { tag: string; cards: number; known: number }>();
  for (const r of rows)
    for (const tag of new Set(tagsOf(r).map((t) => t.trim()))) {
      const key = tag.toLowerCase();
      if (NOT_TOPICS.has(key)) continue;
      const t = topics.get(key) ?? { tag, cards: 0, known: 0 };
      t.cards++;
      if (Number(r.mastery) >= KNOWN_MASTERY) t.known++;
      topics.set(key, t);
    }
  return [...topics.values()]
    .filter((t) => isMastered(t.cards, t.known))
    .sort((a, b) => b.cards - a.cards || a.tag.localeCompare(b.tag))
    .slice(0, TEACH_TOPICS_MAX)
    .map(({ tag, cards }) => ({ tag, cards }));
}

/** What a card says, as plain statements: an explain card's key points, or else its answer. */
export function pointsOf(item: Item): TeachPoint[] {
  const about = item.kind === 'cloze' ? '' : stripHtml(item.target);
  const point = (text: string): TeachPoint => ({ itemId: item.id, about, text });
  const keyPoints = keyPointsOf(item);
  if (keyPoints.length) return keyPoints.map(point);
  if (item.kind === 'cloze') return [point(stripHtml(clozeText(item.target)))];
  if (item.kind === 'mcq') {
    const m = mcqOf(item);
    return m ? [point(m.correct.map((i) => stripHtml(m.choices[i] ?? '')).join(', '))] : [];
  }
  // Steps, code and picture boxes are not something to say in a sentence; a myth is said by its correction.
  if (!['card', 'numeric'].includes(item.kind) && !isMyth(item)) return [];
  return [point(stripHtml(item.meaning))];
}

/** The key points to compare an explanation of this tag with: a few, in the cards' own order. */
export function teachBackPoints(tag: string, d: DB = getDb(), rand: () => number = Math.random): TeachPoint[] {
  const want = tag.trim().toLowerCase();
  if (!want) return [];
  const all = d
    .prepare(`${ITEM_SELECT} WHERE i.suspended = 0 AND i.tags != '[]' AND dk.language IS NULL ORDER BY i.ord`)
    .all()
    .filter((r: Row) => tagsOf(r).some((t) => t.trim().toLowerCase() === want))
    .flatMap((r: Row) => pointsOf(rowToItem(r)))
    .filter((p) => p.text);
  if (all.length <= TEACH_POINTS_MAX) return all;
  const keep = new Set(shuffle(all, rand).slice(0, TEACH_POINTS_MAX));
  return all.filter((p) => keep.has(p));
}

/** The cards behind the points the learner ticked as missed, each once, for a practice round. */
export const missedCards = (points: TeachPoint[], missed: boolean[]): number[] => [
  ...new Set(points.filter((_, i) => missed[i]).map((p) => p.itemId)),
];
