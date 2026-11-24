// The rest of a closely related group (#223). Recalling some items of a tight group can weaken the ones left
// out (retrieval-induced forgetting [Murayama et al. 2014]). A family is the cards of one deck that share a tag
// and the start of their question ("Capital of …"). When a session reviews some of a family, or the last day or
// two did, the family's other learned cards get one quick recognition question. Recognition never grades a
// card: every real review stays a normal FSRS review on its own day.
import { getDb, type DB } from './db';
import { askedOwnWay } from './explain';
import { frontText } from './exercises';
import { dayKey } from './game';
import { normalize } from './text';
import type { Item } from './types';

/** A family has at most this many cards (more is a topic, not a tight group). */
export const FAMILY_MAX = 12;
/** Most related cards one session asks, by its length. */
export const RELATED_MAX = { mini: 2, standard: 4, long: 6 } as const;
/** Cards answered within this many days (today included) count as practised. */
const WINDOW_DAYS = 2;

/** The start of a card's question, "capital of" for "Capital of France"; null when it is under three words. */
export function promptPattern(item: Item): string | null {
  if (item.kind === 'grammar' || item.kind === 'cloze' || askedOwnWay(item)) return null;
  const words = normalize(frontText(item)).split(' ');
  return words.length >= 3 ? words.slice(0, 2).join(' ') : null;
}

/** The cards of `pool` that are in a family with one of the `practised` cards and are not practised themselves. */
export function restOfFamilies(practised: Item[], pool: Item[]): number[] {
  const done = new Set(practised.map((i) => i.id));
  const keys = (i: Item) => {
    const p = promptPattern(i);
    return p ? [...new Set(i.tags)].map((t) => `${i.deckId}\u0000${p}\u0000${t}`) : [];
  };
  const wanted = new Set(practised.flatMap(keys));
  if (!wanted.size) return [];
  const families = new Map<string, number[]>();
  for (const i of pool) for (const k of keys(i)) if (wanted.has(k)) families.set(k, [...(families.get(k) ?? []), i.id]);
  const out = new Set<number>();
  for (const ids of families.values())
    if (ids.length <= FAMILY_MAX) for (const id of ids) if (!done.has(id)) out.add(id);
  return [...out];
}

/** Cards answered in the last day or two, in any format; `graded`: with a real review among the answers. */
export function recentlyAnswered(d: DB = getDb(), now = new Date()): Map<number, { graded: boolean }> {
  const since = dayKey(new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000));
  return new Map(
    d
      .prepare('SELECT item_id, MAX(grade IS NOT NULL) AS graded FROM attempts WHERE day >= ? GROUP BY item_id')
      .all(since)
      .map((r) => [Number(r.item_id), { graded: Number(r.graded) === 1 }]),
  );
}
