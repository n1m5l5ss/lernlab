// "Say it aloud" on a few cards (#222). Saying an answer out loud makes it more memorable, but mostly when
// only some items are spoken: the benefit comes from the contrast with the silent ones (the production
// effect [MacLeod & Bodner 2017]). So a session asks for it on a minority of its flip cards, the starred and
// recently missed ones, and never on all of them. It is a prompt only: no microphone, and the learner rates
// the card as usual. A setting turns it off.
import { getDb, type DB } from './db';
import type { Row } from './host';
import { RECALL_FORMATS, type Block } from './types';

/** At most one flip card in this many is said aloud. */
export const SAY_ALOUD_ONE_IN = 5;
/** A miss counts as recent for this many days. */
export const SAY_ALOUD_DAYS = 7;

/** How many of a session's `flips` flip cards may ask for it: a minority, and never the only one. */
export const sayAloudCap = (flips: number): number =>
  flips < 2 ? 0 : Math.max(1, Math.floor(flips / SAY_ALOUD_ONE_IN));

/**
 * Which of a session's flip cards to say aloud: the eligible ones (missed first, then starred), up to the
 * cap. `flips` are the cards of the flip exercises, in the order they are asked.
 */
export function pickSayAloud(flips: number[], missed: Set<number>, starred: Set<number>): Set<number> {
  const cards = [...new Set(flips)];
  const cap = sayAloudCap(cards.length);
  const order = [...cards.filter((id) => missed.has(id)), ...cards.filter((id) => starred.has(id) && !missed.has(id))];
  return new Set(order.slice(0, cap));
}

/** Mark the chosen flip exercises of a plan (each card once: a later re-show is silent again). */
export function markSayAloud(blocks: Block[], missed: Set<number>, starred: Set<number>): void {
  const flips = blocks.flatMap((b) => ('exercises' in b ? b.exercises.filter((e) => e.type === 'flip') : []));
  const chosen = pickSayAloud(
    flips.map((e) => e.itemId),
    missed,
    starred,
  );
  for (const e of flips) if (chosen.delete(e.itemId)) e.sayAloud = true;
}

/** Of these cards, the starred ones and the ones missed in a recall in the last days (`since` is a day key). */
export function sayAloudCards(
  ids: number[],
  since: string,
  d: DB = getDb(),
): { missed: Set<number>; starred: Set<number> } {
  const missed = new Set<number>();
  const starred = new Set<number>();
  const formats = RECALL_FORMATS.map((f) => `'${f}'`).join(',');
  for (let at = 0; at < ids.length; at += 500) {
    const part = ids.slice(at, at + 500);
    const marks = part.map(() => '?').join(',');
    for (const r of d.prepare(`SELECT id FROM items WHERE starred = 1 AND id IN (${marks})`).all(...part))
      starred.add(Number((r as Row).id));
    for (const r of d
      .prepare(
        `SELECT DISTINCT item_id FROM attempts WHERE correct = 0 AND day >= ? AND format IN (${formats}) AND item_id IN (${marks})`,
      )
      .all(since, ...part))
      missed.add(Number((r as Row).item_id));
  }
  return { missed, starred };
}
