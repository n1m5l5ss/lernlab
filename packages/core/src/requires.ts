// Prerequisite links (#207): learn the basics first. A card can say what it `requires`: other cards of its deck
// (by their front) or whole tags, separated by '|'. New cards are met after the cards they require were recalled
// (mastery learning, ES = 0.52 [Kulik et al. 1990]); cards tagged `key-term` are met first (pre-training, median
// d = 0.78 [Mayer 2023]). It is an order, never a lock: a card whose basics are not ready moves to the end of
// the queue and is still met when nothing else is left. Stored in the card's extra fields (no migration).
// Deck files are untrusted: names that match nothing are ignored, and a link that closes a circle is dropped.
import { frontText } from './exercises';
import { normalize, stripHtml } from './text';
import type { Item } from './types';

/** A card names at most this many prerequisites, each at most this long. */
export const REQUIRES_MAX = 10;
export const REQUIRE_MAX_LENGTH = 200;
/** One name stands for at most this many cards (a tag on a whole deck is not a prerequisite). */
const RESOLVED_MAX = 200;
/** The mastery level "recalled" (types.ts FORMAT_LEVEL): the card was answered from memory. */
export const RECALLED = 3;
/** Cards with this tag are key terms: met before the other new cards. */
export const KEY_TERM_TAG = 'key-term';
/** A card forgotten this often "keeps lapsing": its weak basics get a look first. */
export const LAPSES_WEAK = 2;
/** Most basics one session looks at before the reviews. */
export const BASICS_MAX = 3;

function plain(text: string): string {
  let s = stripHtml(text);
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, REQUIRE_MAX_LENGTH));
}

/** Read the requires line: plain-text names, blanks and repeats dropped, at most ten. */
export function parseRequires(line: string | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of (line ?? '').slice(0, 10_000).split('|')) {
    const p = plain(part);
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    out.push(p);
    if (out.length === REQUIRES_MAX) break;
  }
  return out;
}

/** The requires line in its one canonical form ('' for none). */
export const cleanRequires = (line: string | undefined): string => parseRequires(line).join('|');

export const isKeyTerm = (item: Pick<Item, 'tags'>): boolean =>
  item.tags.some((t) => t.trim().toLowerCase() === KEY_TERM_TAG);

/**
 * Each card's prerequisites among these cards: a name is the front of a card of the same deck, or else one of
 * the deck's tags (every card with it; "#tag" always means the tag). Unknown names and the card itself are
 * left out, and a link that would close a circle is dropped, so the result has no cycles.
 */
export function requiresGraph(items: Item[]): Map<number, number[]> {
  const graph = new Map<number, number[]>();
  const linked = items.filter((i) => i.extra?.requires);
  if (!linked.length) return graph;
  const decks = new Set(linked.map((i) => i.deckId));
  const fronts = new Map<string, number[]>();
  const tags = new Map<string, number[]>();
  const put = (m: Map<string, number[]>, k: string, id: number) => void (m.get(k)?.push(id) ?? m.set(k, [id]));
  for (const i of items) {
    if (!decks.has(i.deckId)) continue;
    put(fronts, `${i.deckId}\u0000${normalize(frontText(i))}`, i.id);
    for (const t of new Set(i.tags.map((x) => x.trim().toLowerCase()))) put(tags, `${i.deckId}\u0000${t}`, i.id);
  }
  for (const i of linked) {
    const ids = new Set<number>();
    for (const name of parseRequires(i.extra.requires)) {
      const tag = tags.get(`${i.deckId}\u0000${name.replace(/^#/, '').toLowerCase()}`);
      const found = (name.startsWith('#') ? undefined : fronts.get(`${i.deckId}\u0000${normalize(name)}`)) ?? tag;
      for (const id of (found ?? []).slice(0, RESOLVED_MAX)) if (id !== i.id) ids.add(id);
    }
    if (ids.size) graph.set(i.id, [...ids]);
  }
  // Drop every link that leads back to a card still being walked (depth-first, without recursion).
  const state = new Map<number, 1 | 2>(); // 1: on the path, 2: done
  for (const start of graph.keys()) {
    if (state.has(start)) continue;
    const stack: { id: number; next: number }[] = [{ id: start, next: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const out = graph.get(top.id) ?? [];
      if (top.next >= out.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const to = out[top.next];
      if (state.get(to) === 1) out.splice(top.next, 1);
      else {
        top.next++;
        if (!state.has(to)) {
          state.set(to, 1);
          stack.push({ id: to, next: 0 });
        }
      }
    }
  }
  return graph;
}

/**
 * The same cards with the basics first: key terms, then each card in its order with the listed cards it still
 * needs pulled in front of it. A card that needs something not yet `ready` waits at the end, in order.
 * Nothing is dropped.
 */
export function basicsFirst(
  ids: number[],
  graph: Map<number, number[]>,
  ready: (id: number) => boolean,
  keyTerm: (id: number) => boolean = () => false,
): number[] {
  if (!graph.size && !ids.some(keyTerm)) return ids;
  const listed = new Set(ids);
  const opened = new Set<number>();
  const placed = new Set<number>();
  const out: number[] = [];
  const waiting: number[] = [];
  for (const first of [...ids.filter(keyTerm), ...ids.filter((id) => !keyTerm(id))]) {
    // Depth-first without recursion: a card is placed once everything it needs from the list was placed.
    const stack = [first];
    while (stack.length) {
      const id = stack[stack.length - 1];
      const needs = placed.has(id) ? [] : (graph.get(id) ?? []).filter((p) => !ready(p));
      const todo = opened.has(id) ? [] : needs.filter((p) => listed.has(p) && !placed.has(p) && !opened.has(p));
      opened.add(id);
      if (todo.length) {
        stack.push(...todo.reverse());
        continue;
      }
      stack.pop();
      if (!placed.has(id)) (needs.length ? waiting : out).push(id);
      placed.add(id);
    }
  }
  return [...out, ...waiting];
}
