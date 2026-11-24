// Telling look-alike categories apart (#211). Mixing helps when the task is to tell similar categories apart
// (g = 0.42 overall, 0.67 for paintings) and hurts for word lists (g = −0.39) [Brunmair & Richter 2019]. So:
// - the sorting round ("Which one is this?") takes the categories the learner mixes up most. A card's label is
//   its category, or, in a deck that is not vocabulary, the one tag that puts it in a group (art style, species);
// - new vocabulary is met in themed groups (themedFirst) and mixed only later, in review.
// The round is practice only: its answers never change the schedule (FSRS).
import { getDb, type DB } from './db';
import { askedOwnWay } from './explain';
import { dayKey } from './game';
import { shuffle } from './text';
import type { Item } from './types';

/** A tag is a category when at least this many cards have it… */
export const LABEL_MIN_CARDS = 3;
/** …and at most this share of the deck (a tag on every card says nothing). */
const LABEL_MAX_SHARE = 0.8;
/** …and nearly every tagged card has exactly one such tag (several each: topics, not categories). */
const EXCLUSIVE_SHARE = 0.8;
/** Choices in one round, and cards in an untimed one. */
export const LABELS_MAX = 4;
export const ROUND_MAX = 12;
/** Wrong picks older than this many days no longer count. */
const MISS_DAYS = 30;
/** How far ahead of the deck's order a themed group of new words may reach. */
export const THEME_WINDOW = 40;

/** Each card's label for the sorting round: its category, or its one category-like tag (never for vocabulary). */
export function categoryLabels(items: Item[]): Map<number, string> {
  const labels = new Map<number, string>();
  const untagged = new Map<number, Item[]>();
  for (const i of items) {
    if (i.kind === 'grammar' || askedOwnWay(i)) continue;
    if (i.category) labels.set(i.id, i.category);
    else if (!i.lang) untagged.set(i.deckId, [...(untagged.get(i.deckId) ?? []), i]);
  }
  for (const deck of untagged.values()) {
    const count = new Map<string, number>();
    for (const i of deck) for (const t of new Set(i.tags)) count.set(t, (count.get(t) ?? 0) + 1);
    const isLabel = (t: string) => count.get(t)! >= LABEL_MIN_CARDS && count.get(t)! <= deck.length * LABEL_MAX_SHARE;
    const own = deck.map((i) => [i.id, [...new Set(i.tags)].filter(isLabel)] as const).filter(([, t]) => t.length);
    const one = own.filter(([, t]) => t.length === 1);
    if (new Set(one.map(([, t]) => t[0])).size < 2 || one.length < own.length * EXCLUSIVE_SHARE) continue;
    for (const [id, t] of one) labels.set(id, t[0]);
  }
  return labels;
}

/** Wrong picks in recent sorting rounds: the card and the label that was picked for it. */
export function labelMisses(d: DB = getDb(), now = new Date()): { itemId: number; picked: string; n: number }[] {
  const since = dayKey(new Date(now.getTime() - MISS_DAYS * 86_400_000));
  return d
    .prepare(
      `SELECT item_id, given, COUNT(*) AS n FROM attempts
       WHERE day >= ? AND format = 'gender' AND correct = 0 AND given IS NOT NULL GROUP BY item_id, given`,
    )
    .all(since)
    .map((r) => ({ itemId: Number(r.item_id), picked: String(r.given), n: Number(r.n) }));
}

/**
 * The labels for one round, at most `max`: the pair mixed up most, then the labels mixed up most with those
 * already chosen, then the most common ones. A wrong pick in a round counts double a mix-up between two cards
 * (confusions.ts). With nothing known yet, the most common labels.
 */
export function confusableLabels(
  labels: Map<number, string>,
  mixups: Map<number, number[]>,
  misses: { itemId: number; picked: string; n: number }[],
  max = LABELS_MAX,
): string[] {
  const freq = new Map<string, number>();
  for (const l of labels.values()) freq.set(l, (freq.get(l) ?? 0) + 1);
  const score = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const add = (a: string | undefined, b: string | undefined, n: number) => {
    if (a && b && a !== b && freq.has(a) && freq.has(b)) score.set(key(a, b), (score.get(key(a, b)) ?? 0) + n);
  };
  for (const m of misses) add(labels.get(m.itemId), m.picked, 2 * m.n);
  for (const [id, others] of mixups) for (const o of others) add(labels.get(id), labels.get(o), 0.5); // seen twice
  const all = shuffle([...freq.keys()]).sort((a, b) => freq.get(b)! - freq.get(a)!);
  const pairs = [...score].sort((a, b) => b[1] - a[1]).map(([k]) => k.split('\u0000'));
  const out: string[] = [];
  while (out.length < Math.min(max, all.length)) {
    const rest = all.filter((l) => !out.includes(l));
    const near = (l: string) => out.reduce((s, o) => s + (score.get(key(l, o)) ?? 0), 0);
    const next = rest.reduce((a, b) => (near(b) > near(a) ? b : a)); // ties: the more common one
    // Nothing mixed up with the chosen ones: the next pair that was mixed up, then the most common labels.
    const pair = near(next) > 0 ? undefined : pairs.find((p) => p.some((l) => !out.includes(l)));
    out.push(...(pair ? pair.filter((l) => !out.includes(l)) : [next]));
  }
  return out.slice(0, max);
}

/**
 * New cards in the order to meet them: the deck's order, but for vocabulary the cards that share the first
 * card's theme (its sub-deck and its most specific tag) come first, so new words are met as a group.
 */
export function themedFirst(items: Item[]): number[] {
  const first = items[0];
  const ids = (list: Item[]) => list.map((i) => i.id);
  if (!first?.lang) return ids(items);
  const window = items.slice(0, THEME_WINDOW);
  const near = window.filter((i) => i.deckId === first.deckId && i.deck === first.deck);
  const shared = (t: string) => near.filter((i) => i.tags.includes(t)).length;
  const theme = first.tags.filter((t) => shared(t) >= 2).sort((a, b) => shared(a) - shared(b))[0];
  const same = new Set(theme ? near.filter((i) => i.tags.includes(theme)) : near);
  return ids([
    ...window.filter((i) => same.has(i)),
    ...window.filter((i) => !same.has(i)),
    ...items.slice(THEME_WINDOW),
  ]);
}
