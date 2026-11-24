// Question variants (#198): other ways to ask a card's question, each with a level (recall, apply or
// analyse). The answer stays the card's own. Sessions rotate the wording so learners can't memorise it;
// FSRS still sees one card with one grade per day. Stored in the card's extra fields as one line of text,
// the same line CSV and .lernpack carry: "apply: A patient has X. Which mechanism? | analyse: What if X doubles?"
import { stripHtml } from './text';
import type { Item } from './types';

export type Level = 'recall' | 'apply' | 'analyse';
export const LEVELS: Level[] = ['recall', 'apply', 'analyse'];
export type Variant = { prompt: string; level: Level };

/** At most this many variants per card, each at most this long (deck files are untrusted). */
export const VARIANTS_MAX = 8;
export const VARIANT_MAX_LENGTH = 500;

/** Card kinds whose recall is a written question (flip or typed); the others ask in their own way. */
export const takesVariants = (kind: string) => !['cloze', 'mcq', 'order', 'code', 'occlusion'].includes(kind);

const LEVEL_NAMES: Record<string, Level> = { recall: 'recall', apply: 'apply', analyse: 'analyse', analyze: 'analyse' };

/** Plain text that stays the same when read again (stripHtml decodes one level of entities per pass). */
function plain(text: string): string {
  let s = stripHtml(text);
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, VARIANT_MAX_LENGTH));
}

/** Read the variants line. A question without a known level before ':' is a recall question. */
export function parseVariants(line: string | undefined): Variant[] {
  const out: Variant[] = [];
  const seen = new Set<string>();
  for (const part of (line ?? '').split('|')) {
    const m = /^\s*([A-Za-z]+)\s*:(.*)$/s.exec(part);
    const level = m ? LEVEL_NAMES[m[1].toLowerCase()] : undefined;
    const prompt = plain(level ? m![2] : part);
    if (!prompt || seen.has(prompt.toLowerCase())) continue;
    seen.add(prompt.toLowerCase());
    out.push({ prompt, level: level ?? 'recall' });
    if (out.length === VARIANTS_MAX) break;
  }
  return out;
}

/** Write variants as one line. A '|' inside a question becomes '/', so it can't split the question. */
export const formatVariants = (variants: Variant[]): string =>
  parseVariants(variants.map((v) => `${v.level}: ${v.prompt.replace(/\|/g, '/')}`).join(' | '))
    .map((v) => `${v.level}: ${v.prompt}`)
    .join(' | ');

/** The variants line in its one canonical form ('' when there are none). */
export const cleanVariants = (line: string | undefined): string => formatVariants(parseVariants(line));

export const variantsOf = (item: Pick<Item, 'extra'>): Variant[] => parseVariants(item.extra?.variants);

/**
 * Which wording a recall asks: 0 is the card's own question, k is variant k. A card that has not been
 * reviewed yet (`reviews` < 1) is learned with its own question first. After that, each review moves on to
 * the next wording, so the same one never comes twice in a row; the card's id spreads the starting point.
 */
export function variantIndex(itemId: number, reviews: number, count: number): number {
  if (count <= 0 || reviews < 1) return 0;
  return (((reviews + itemId) % (count + 1)) + count + 1) % (count + 1);
}
