// Misconception feedback (#202): an author can attach a short correction to any wrong choice of a
// multiple-choice card ("Many people think X. In fact Y, because Z."). Picking that choice shows the
// correction instead of a plain "wrong"; the grade is the same. Refutation texts help, g = 0.41 (0.28 after
// bias correction) [Schroeder & Kucera 2022]. Stored in the card's extra fields as one line of text, the
// same line CSV and .lernpack carry: one correction per choice, in the choices' order, separated by '|'
// like the choices themselves ("Many people think EC2 is serverless…|||RDS is a database").
import { markdownLite, mcqOf, sanitizeHtml } from './cards';
import { stripHtml } from './text';
import type { Item } from './types';

/** A correction is at most this long (deck files are untrusted). */
export const CORRECTION_MAX_LENGTH = 500;

type Mcq = { choices: string[]; correct: number[] } | null;

/** Plain text that stays the same when read again (stripHtml decodes one level of entities per pass). */
function plain(text: string): string {
  let s = stripHtml(text);
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, CORRECTION_MAX_LENGTH));
}

/** Read the corrections line: one per choice, in order; '' is a choice without one. */
export const parseCorrections = (line: string | undefined): string[] => (line ?? '').split('|').map(plain);

/**
 * The corrections line in its one canonical form for a card's choices: only wrong choices keep one, nothing
 * past the last choice, no empty slots at the end. '' when there are none (or the card has no choices).
 */
export function cleanCorrections(line: string | undefined, mcq: Mcq): string {
  if (!mcq) return '';
  const list = parseCorrections(line)
    .slice(0, mcq.choices.length)
    .map((c, i) => (mcq.correct.includes(i) ? '' : c));
  while (list.length && !list[list.length - 1]) list.pop();
  return list.join('|');
}

/** Write a list of corrections (one per choice) as the line. A '|' inside one becomes '/', so it can't split it. */
export const formatCorrections = (list: string[], mcq: Mcq): string =>
  cleanCorrections(list.map((c) => c.replace(/\|/g, '/')).join('|'), mcq);

/** A card's corrections, one per choice in the card's own order ('' for none); [] for a card without choices. */
export function correctionsOf(item: Pick<Item, 'extra' | 'meaning'>): string[] {
  const m = mcqOf(item);
  if (!m) return [];
  const list = parseCorrections(item.extra?.corrections);
  return m.choices.map((_, i) => list[i] ?? '');
}

/** A correction as safe HTML to show: its text escaped, with **bold**, *italic* and `code`. */
export const correctionHtml = (text: string): string =>
  sanitizeHtml(markdownLite(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')));

/** The corrections an answer shows: those of the wrong choices it picked, in the order the choices are shown. */
export const pickedCorrections = (corrections: string[] | undefined, picked: number[], correct: number[]): string[] =>
  [...picked]
    .sort((a, b) => a - b)
    .filter((i) => !correct.includes(i))
    .map((i) => corrections?.[i] ?? '')
    .filter(Boolean);
