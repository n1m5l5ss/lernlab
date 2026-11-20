// Subject-neutral card logic shared by server and client.
import { acceptedAnswers, stripHtml } from './text';
import type { Item } from './types';

/** The alt text for a card's image: its description, or '' (a decorative image) when it has none. */
export const imageAltOf = (item: Pick<Item, 'image' | 'extra'>): string =>
  item.image ? (item.extra?.imageAlt ?? '') : '';

const SHORT = (s: string) => s.length > 0 && s.length <= 40 && s.split(/\s+/).length <= 6;

/**
 * Decide what a recall question looks like for a card.
 * Language decks: show the meaning, produce the foreign word (with article for nouns).
 * Other subjects: if the back is short, ask front → type back (Q→A); else if the front is short,
 * ask back → type front (definition → term, Quizlet style); if both are long, it's a self-graded flip.
 */
export function qa(item: Item): {
  prompt: string;
  answer: string;
  accepted: string[];
  requireArticle: boolean;
  typeable: boolean;
} {
  const alts = (item.extra?.alt ?? '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
  const withAlts = (a: string[]) => [...new Set([...a, ...alts])];
  if (item.kind === 'mcq' || item.kind === 'order') {
    return {
      prompt: item.target,
      answer: item.meaning,
      accepted: [stripHtml(item.meaning)],
      requireArticle: false,
      typeable: false,
    };
  }
  if (item.lang) {
    return {
      prompt: item.meaning,
      answer: item.target,
      accepted: withAlts(acceptedAnswers(item.target)),
      requireArticle: item.kind === 'noun',
      typeable: SHORT(stripHtml(item.target)) || item.kind === 'phrase',
    };
  }
  const front = stripHtml(item.target);
  const back = stripHtml(item.meaning);
  if (SHORT(back))
    return {
      prompt: item.target,
      answer: back,
      accepted: withAlts(acceptedAnswers(back)),
      requireArticle: false,
      typeable: true,
    };
  if (SHORT(front))
    return {
      prompt: item.meaning,
      answer: front,
      accepted: withAlts(acceptedAnswers(front)),
      requireArticle: false,
      typeable: true,
    };
  return { prompt: item.target, answer: item.meaning, accepted: [back], requireArticle: false, typeable: false };
}

/** Choices for a multiple-choice / multi-select question card ("A|B|C|D", correct "2|4" or by text). */
export function mcqOf(item: Item): { choices: string[]; correct: number[] } | null {
  const choices = (item.extra?.choices ?? '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (choices.length < 2) return null;
  const raw = (item.extra?.correct ?? stripHtml(item.meaning))
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  const correct = raw
    .map((r) => (/^\d+$/.test(r) ? Number(r) - 1 : choices.findIndex((c) => c.toLowerCase() === r.toLowerCase())))
    .filter((i) => i >= 0 && i < choices.length);
  return correct.length ? { choices, correct: [...new Set(correct)] } : null;
}

/** Steps of an ordering card ("first|second|third"), from extra.steps or the back. */
export function stepsOf(item: Item): string[] {
  const raw = item.extra?.steps ?? stripHtml(item.meaning);
  return raw
    .split(/\s*\|\s*|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Anki/LernLab cloze syntax: {{c1::answer}} or {{c1::answer::hint}}. Returns the first cloze as a gap. */
export function parseCloze(text: string): { before: string; answer: string; hint: string; after: string } | null {
  const m = text.match(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/);
  if (!m) return null;
  const reveal = (s: string) => s.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1');
  const idx = text.indexOf(m[0]);
  return {
    before: stripHtml(reveal(text.slice(0, idx))),
    answer: stripHtml(m[2]),
    hint: m[3] ? stripHtml(m[3]) : '',
    after: stripHtml(reveal(text.slice(idx + m[0].length))),
  };
}

/** Plain-text version of a cloze card (all gaps filled), for lists and match games. */
export const clozeText = (text: string) => text.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1');

/** The safe list: the only tags a card may keep (decks are shared files). Listed in docs/FORMAT.md. */
export const SAFE_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'mark',
  'sup',
  'sub',
  'small',
  'code',
  'pre',
  'br',
  'p',
  'div',
  'span',
  'ul',
  'ol',
  'li',
] as const;
const ALLOWED = new Set<string>(SAFE_TAGS);
const BARE_TAG = new RegExp(`<(?!/?(?:${SAFE_TAGS.join('|')})>)`, 'gi');

/**
 * Shared decks are untrusted: keep the safe-list tags without any attribute and drop every other tag.
 * Any `<` left that is not one of those bare tags becomes `&lt;`, so no tag can be rebuilt from pieces.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
      const n = name.toLowerCase();
      if (!ALLOWED.has(n)) return '';
      return tag.startsWith('</') ? `</${n}>` : n === 'br' ? '<br>' : `<${n}>`;
    })
    .replace(BARE_TAG, '&lt;');
}

/** Light Markdown for CSV authors: **bold**, *italic*, `code`. */
export function markdownLite(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
