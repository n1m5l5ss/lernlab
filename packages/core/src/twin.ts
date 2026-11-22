// Compare cards (#200), "twin" in deck files: two things that are easy to mix up, shown side by side. The
// learner says what they share and the one key difference, then checks against the card's back and rates
// themselves as on a flip card: a real recall, graded once a day. Comparing two cases side by side helps,
// d = 0.50 [Alfieri et al. 2013]. Stored as a basic card whose front is the first thing and whose extra
// field `twin` is the second (no migration); files carry it as `twin`, with `type: twin`.
import { stripHtml } from './text';
import type { Item } from './types';

/** The second side is plain text of at most this length (deck files are untrusted). */
export const TWIN_MAX_LENGTH = 500;

/** The second side in its one canonical form: plain text that stays the same when read again. */
export function cleanTwin(text: string | undefined): string {
  let s = stripHtml(text ?? '');
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, TWIN_MAX_LENGTH));
}

/** A compare card: a basic card with a second side (cardToItem keeps the field only then). */
export const isTwin = (item: Pick<Item, 'extra'>): boolean => !!item.extra?.twin;

/** One card as one side of a compare card: "affect: to influence". */
export const twinSide = (front: string, back: string): string =>
  cleanTwin(back ? `${front}: ${back}` : front).slice(0, TWIN_MAX_LENGTH);
