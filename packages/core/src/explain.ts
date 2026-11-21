// "Explain it" cards (#199): a card for why and how questions. Its author writes 2–5 key points; the learner
// explains in their own words, then ticks the points they covered: all → Good, some → Hard, none → Again, and
// Easy only when they ticked every point and say it was easy. Self-explanation helps, g = 0.55 [Bisra et al.
// 2018], and checking a free answer against specific points is the known fix for judging it too kindly.
// Stored in the card's extra fields as one line of plain text, separated by '|' like choices, which is also
// what CSV and .lernpack carry (no migration). Cards tagged `why` or `how` also explain first, without points.
import { correctionHtml } from './misconceptions';
import { isMyth } from './misconceptions';
import { stripHtml } from './text';
import type { Item } from './types';

/** An explain card has 2–5 key points, each at most this long (deck files are untrusted). */
export const KEY_POINTS_MIN = 2;
export const KEY_POINTS_MAX = 5;
export const KEY_POINT_MAX_LENGTH = 300;

/** Plain text that stays the same when read again (stripHtml decodes one level of entities per pass). */
function plain(text: string): string {
  let s = stripHtml(text);
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, KEY_POINT_MAX_LENGTH));
}

/** Read the key points line: plain text, blanks and repeats dropped, at most five. */
export function parseKeyPoints(line: string | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of (line ?? '').split('|')) {
    const p = plain(part);
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    out.push(p);
    if (out.length === KEY_POINTS_MAX) break;
  }
  return out;
}

/** The key points line in its one canonical form; '' when there are fewer than two (not an explain card). */
export function cleanKeyPoints(line: string | undefined): string {
  const list = parseKeyPoints(line);
  return list.length >= KEY_POINTS_MIN ? list.join('|') : '';
}

/** Write a list of key points as the line. A '|' inside one becomes '/', so it can't split it. */
export const formatKeyPoints = (list: string[]): string =>
  cleanKeyPoints(list.map((p) => p.replace(/\|/g, '/')).join('|'));

export const keyPointsOf = (item: Pick<Item, 'extra'>): string[] => parseKeyPoints(item.extra?.keyPoints);

/** An explain card: a basic card whose extra fields hold its key points (cardToItem keeps them only then). */
export const isExplain = (item: Pick<Item, 'extra'>): boolean => !!item.extra?.keyPoints;

/** Myth and explain cards are asked only in their own way: no games, distractors, guess rounds or exams. */
export const askedOwnWay = (item: Pick<Item, 'extra'>): boolean => isMyth(item) || isExplain(item);

/** Cards tagged `why` or `how` are explained before the answer shows, never flipped. */
export const asksWhy = (item: Pick<Item, 'tags'>): boolean => item.tags.some((t) => /^(why|how)$/i.test(t.trim()));

/** A key point as safe HTML to show: its text escaped, with **bold**, *italic* and `code`. */
export const keyPointHtml = correctionHtml;

/**
 * The key points as a plain-text card back, one per line, for readers that don't know explain cards (older
 * apps, Anki) when the card has no model explanation of its own. Read back in, it gives an empty back again.
 */
export const keyPointsAsBack = (points: string[]): string => points.map((p) => `• ${p}`).join('\n');

export type ExplainOutcome = { correct: boolean; nearMiss: boolean; easy: boolean };

/** The answer for `ticked` of `total` key points: all → Good, some → Hard, none → Again; Easy needs all. */
export function explainOutcome(ticked: number, total: number, easy = false): ExplainOutcome {
  const all = total > 0 && ticked >= total;
  return { correct: ticked > 0, nearMiss: ticked > 0 && !all, easy: all && easy };
}

/** "How well do you understand this?" is rated 1–7, before and after explaining. It never touches FSRS. */
export const UNDERSTANDING_SCALE = 7;

/** After minus before, when both ratings were given; null otherwise. */
export const understandingGap = (before: number | null, after: number | null): number | null =>
  before && after ? after - before : null;
