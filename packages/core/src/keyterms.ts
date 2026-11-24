// Key terms (#212): an author marks the key part of an answer as ==term== and it is highlighted when the
// answer shows (signalling, d = 0.70 in lab studies [Mayer 2023]). A basic card's back is stored as plain
// text, so its marked terms live in the card's extra fields as one line separated by '|', which is also what
// CSV (key_terms) and .lernpack (keyTerms) carry: an older reader ignores it and shows the plain answer.
// Fields that keep their formatting (explanation, notes, cloze and choice cards) hold the highlight as <mark>.
import { outsideMath } from './math';
import { stripHtml } from './text';
import type { Item } from './types';

/** A card keeps at most this many key terms, each at most this long (deck files are untrusted). */
export const KEY_TERMS_MAX = 5;
export const KEY_TERM_MAX_LENGTH = 100;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The terms as they stand in a text: whole, not inside a longer word or a formula. Longest first. */
function split(text: string, terms: string[], mark: (term: string) => string, other: (text: string) => string) {
  if (!terms.length) return other(text);
  const any = [...terms].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const re = new RegExp(`(?<![\\w=])(?:${any.join('|')})(?![\\w=])`, 'g');
  return outsideMath(text, (part) => {
    let out = '';
    let last = 0;
    for (const m of part.matchAll(re)) {
      out += other(part.slice(last, m.index)) + mark(m[0]);
      last = m.index + m[0].length;
    }
    return out + other(part.slice(last));
  });
}

/** Read the key terms line: plain text, blanks and repeats dropped, at most five. */
export function parseKeyTerms(line: string | undefined): string[] {
  const out: string[] = [];
  for (const part of (line ?? '').split('|')) {
    const t = stripHtml(part);
    // A term is written back as ==term==, so it can't hold a '=' or be longer than a phrase.
    if (!t || t.includes('=') || t.length > KEY_TERM_MAX_LENGTH || out.includes(t)) continue;
    if (stripHtml(t) !== t) continue; // would read differently next time
    out.push(t);
    if (out.length === KEY_TERMS_MAX) break;
  }
  return out;
}

/** The terms marked in a cleaned back (`<mark>…</mark>`, which is what ==term== becomes). */
export const markedTerms = (html: string): string[] =>
  [...html.matchAll(/<mark>([\s\S]*?)<\/mark>/g)].map((m) => stripHtml(m[1]));

/** The canonical line for a card: only terms that stand in its plain answer. '' when none do. */
export function cleanKeyTerms(line: string | undefined, answer: string): string {
  return parseKeyTerms(line)
    .filter((t) =>
      split(
        answer,
        [t],
        () => '\0',
        (s) => s,
      ).includes('\0'),
    )
    .join('|');
}

export const keyTermsOf = (item: Pick<Item, 'extra'>): string[] => parseKeyTerms(item.extra?.keyTerms);

/**
 * A card's answer as safe HTML with its key terms highlighted. Text that is not the card's plain answer, and
 * the answer of a card without key terms, comes back unchanged.
 */
export function markAnswer(item: Pick<Item, 'extra' | 'meaning'>, text: string): string {
  const terms = keyTermsOf(item);
  if (!terms.length || text !== item.meaning) return text;
  return split(text, terms, (t) => `<mark>${escapeHtml(t)}</mark>`, escapeHtml);
}

/** The answer as its author wrote it, with ==term== around the key terms (for the card editor). */
export const answerSource = (item: Pick<Item, 'extra' | 'meaning'>): string =>
  split(
    item.meaning,
    keyTermsOf(item),
    (t) => `==${t}==`,
    (s) => s,
  );
