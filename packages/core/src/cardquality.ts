// Card-quality hints (#212): local rules that suggest a better card while it is written or imported. They
// follow Mayer's multimedia principles (lab medians: coherence d = 0.86, segmenting 0.67 [Mayer 2023]) and
// dual coding [Clark & Paivio 1991]. A hint is a suggestion only: it never blocks saving, importing or
// studying, and nothing here goes online. Text that repeats a card's audio is deliberately not a rule: in
// language decks hearing and reading the same words helps. (Key terms, ==term==, are in cards.ts markdownLite.)
import { asksWhy, isExplain } from './explain';
import { cardToItem, type Deck, type NormalizedCard } from './library';
import { stripHtml } from './text';
import type { Item } from './types';

/**
 * - split: the answer is long, so it may be two cards (segmenting).
 * - decorativeImage: the image has no description, so it may not help the answer (coherence).
 * - diagram: the card is about an idea and has no picture (dual coding).
 */
export type CardHint = 'split' | 'decorativeImage' | 'diagram';
export const CARD_HINTS: CardHint[] = ['split', 'decorativeImage', 'diagram'];

/** An answer longer than this many words may be better as two cards. */
export const ANSWER_WORDS_MAX = 40;
/** An answer of at least this many words explains an idea rather than naming a fact. */
export const IDEA_WORDS_MIN = 15;

// Scripts written without spaces (Chinese, Japanese, Korean, Thai): about two characters to a word.
const UNSPACED = /[฀-๿぀-ヿ㐀-鿿가-힯]/g;

/** Roughly how many words a text has, formatting not counted. */
export function wordCount(html: string): number {
  const text = stripHtml(html);
  const unspaced = text.match(UNSPACED)?.length ?? 0;
  const spaced = text.replace(UNSPACED, ' ').split(/\s+/).filter(Boolean).length;
  return spaced + Math.ceil(unspaced / 2);
}

/** Card types whose back is not the answer the learner gives (choices, steps, a gap, code, a box, key points). */
const OWN_ANSWER = new Set<Item['kind']>(['cloze', 'mcq', 'order', 'code', 'occlusion']);

/** The hints for one card as it would be saved (see cardToItem), in the order of CARD_HINTS. */
export function cardHints(
  item: Pick<Item, 'kind' | 'lang' | 'target' | 'meaning' | 'image' | 'video' | 'extra' | 'tags'>,
): CardHint[] {
  const out: CardHint[] = [];
  const explain = isExplain(item);
  const words = OWN_ANSWER.has(item.kind) ? 0 : wordCount(item.lang ? item.target : item.meaning);
  if (words > ANSWER_WORDS_MAX && !explain) out.push('split');
  // An occlusion card's picture is the question itself.
  if (item.image && !item.extra?.imageAlt && item.kind !== 'occlusion') out.push('decorativeImage');
  const idea = explain || asksWhy(item) || words >= IDEA_WORDS_MIN;
  if (idea && !item.lang && !item.image && !item.video && item.kind !== 'code') out.push('diagram');
  return out;
}

export type HintCount = { hint: CardHint; count: number };

/** How many of these cards get each hint, most common first. Cards with no front are not counted. */
export function countHints(deck: Pick<Deck, 'id' | 'name' | 'language'>, cards: NormalizedCard[]): HintCount[] {
  const counts = new Map<CardHint, number>();
  for (const c of cards) {
    const item = cardToItem(deck, c);
    if (item) for (const h of cardHints(item)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return CARD_HINTS.filter((h) => counts.has(h))
    .map((hint) => ({ hint, count: counts.get(hint)! }))
    .sort((a, b) => b.count - a.count);
}
