// Case chains (#209): a short case (a patient, a legal fact pattern, an architecture, a historical situation)
// followed by 2–4 linked questions: diagnose, explain, decide. Problem-based learning has a robust positive
// effect on skills [Dochy et al. 2003], and practising in the exam's format helps. A chain is made of ordinary
// cards that share the same case text in one deck, in deck order. Each question is its own card, with its own
// answer and its own schedule (one FSRS grade per day from its own recall); the case shows with every one.
// Stored in the card's extra fields as plain text, which is also what CSV and .lernpack carry (no migration).
import { correctionHtml } from './misconceptions';
import { stripHtml } from './text';
import type { Item } from './types';

/** A case is at most this long (deck files are untrusted). */
export const CASE_MAX_LENGTH = 2000;

/** The case as plain text on one line, in its one canonical form ('' for none). */
export function cleanCase(text: string | undefined): string {
  let s = stripHtml(text ?? '');
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, CASE_MAX_LENGTH));
}

export const caseOf = (item: Pick<Item, 'extra'>): string => item.extra?.case ?? '';
export const hasCase = (item: Pick<Item, 'extra'>): boolean => !!item.extra?.case;

/** The case as safe HTML to show: its text escaped, with **bold**, *italic* and `code`. */
export const caseHtml = correctionHtml;

/**
 * A front for readers that don't know cases (older apps, Anki): the case, then the question, so the card can
 * still be answered. Read back in with its `case`, the front is the question alone again (questionOf).
 */
export const frontWithCase = (caseText: string, front: string): string =>
  caseText ? `${caseText}\n\n${front}` : front;

/** A plain-text front without the case a writer put before it. */
export function questionOf(front: string, caseText: string): string {
  const rest = caseText && front.startsWith(`${caseText} `) ? front.slice(caseText.length).trim() : '';
  return rest || front;
}

/** The questions of a card's case, the card included, in the order given (deck order): its chain. */
export const chainOf = <T extends Pick<Item, 'extra' | 'deckId'>>(item: T, pool: T[]): T[] =>
  hasCase(item) ? pool.filter((p) => p.deckId === item.deckId && caseOf(p) === caseOf(item)) : [item];

/**
 * Put each chain's questions next to each other, in deck order (`pos`), where its first one stands in `ids`.
 * Other cards keep their places.
 */
export function keepChains(
  ids: number[],
  get: (id: number) => Pick<Item, 'extra' | 'deckId'>,
  pos: (id: number) => number,
): number[] {
  const out: number[] = [];
  const done = new Set<number>();
  for (const id of ids) {
    if (done.has(id)) continue;
    const card = get(id);
    const inChain = (x: number) => get(x).deckId === card.deckId && caseOf(get(x)) === caseOf(card);
    const chain = hasCase(card) ? ids.filter(inChain).sort((x, y) => pos(x) - pos(y)) : [id];
    for (const x of chain) done.add(x);
    out.push(...chain);
  }
  return out;
}
