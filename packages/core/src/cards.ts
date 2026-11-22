// Subject-neutral card logic shared by server and client.
import { acceptedAnswers, stripHtml } from './text';
import { outsideMath } from './math';
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
  if (item.kind === 'numeric') {
    // A number is always the answer: it is typed, and checked with its tolerance and unit (numeric.ts).
    const back = stripHtml(item.meaning);
    return { prompt: item.target, answer: back, accepted: withAlts([back]), requireArticle: false, typeable: true };
  }
  if (item.kind === 'occlusion') {
    // Name the hidden box: its label is always typed, whatever its length (occlusion.ts).
    const back = stripHtml(item.meaning);
    return { prompt: item.target, answer: back, accepted: withAlts([back]), requireArticle: false, typeable: true };
  }
  if (item.kind === 'code') {
    // Asked by codeExercise (exercises.ts); the answer is the output, or the code itself.
    const answer = item.meaning || (item.extra?.code ?? '');
    return { prompt: item.target, answer, accepted: withAlts([]), requireArticle: false, typeable: false };
  }
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
export function mcqOf(item: Pick<Item, 'extra' | 'meaning'>): { choices: string[]; correct: number[] } | null {
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

export type ClozeMatch = { start: number; end: number; answer: string; hint: string | undefined };

const CLOZE_START = /\{\{c\d+::/g;
const LINE_END = /[\n\r\u2028\u2029]/g;

/**
 * Every cloze from `from` on, in order: `{{c1::answer}}` or `{{c1::answer::hint}}`, ending at the first `}}`
 * on the same line (the same matches as /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g; with `multiline`, as with
 * [\s\S] instead of `.`). A scanner instead of that regex, because the regex backtracks: a card full of
 * unclosed `{{c1::` took minutes and froze the app. This runs in linear time.
 */
export function* clozes(text: string, multiline = false): Generator<ClozeMatch> {
  const starts = new RegExp(CLOZE_START.source, 'g');
  const lines = new RegExp(LINE_END.source, 'g');
  let close = -1; // next "}}" at or after the current start, cached
  let lineEnd = -1; // next line terminator at or after the current start, cached
  let m: RegExpExecArray | null;
  while ((m = starts.exec(text))) {
    const body = m.index + m[0].length;
    if (close < body) close = text.indexOf('}}', body);
    if (close < 0) return; // no "}}" anywhere after this: no more clozes
    if (multiline) lineEnd = Infinity;
    else if (lineEnd < body) {
      lines.lastIndex = body;
      lineEnd = lines.exec(text)?.index ?? Infinity;
    }
    if (lineEnd < close) continue; // this one isn't closed on its line; try the next start
    const inner = text.slice(body, close);
    const sep = inner.indexOf('::');
    yield {
      start: m.index,
      end: close + 2,
      answer: sep < 0 ? inner : inner.slice(0, sep),
      hint: sep < 0 ? undefined : inner.slice(sep + 2),
    };
    starts.lastIndex = close + 2;
  }
}

/** Replace every cloze with what `to` makes of it (by default its answer). */
export function replaceClozes(text: string, to: (c: ClozeMatch) => string = (c) => c.answer, multiline = false) {
  let out = '';
  let at = 0;
  for (const c of clozes(text, multiline)) {
    out += text.slice(at, c.start) + to(c);
    at = c.end;
  }
  return out + text.slice(at);
}

const reveal = (text: string) => replaceClozes(text);

/** Anki/LernLab cloze syntax: {{c1::answer}} or {{c1::answer::hint}}. Returns the first cloze as a gap. */
export function parseCloze(text: string): { before: string; answer: string; hint: string; after: string } | null {
  const first = clozes(text).next();
  if (first.done) return null;
  const m = first.value;
  return {
    before: stripHtml(reveal(text.slice(0, m.start))),
    answer: stripHtml(m.answer),
    hint: m.hint ? stripHtml(m.hint) : '',
    after: stripHtml(reveal(text.slice(m.end))),
  };
}

/** Plain-text version of a cloze card (all gaps filled), for lists and match games. */
export const clozeText = (text: string) => reveal(text);

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

// ==term==: the marks touch the term and stand apart from other text, so `a == b` and `a==b` stay as written.
const KEY_TERM = /(^|[^\w=])==(?=[^\s=])([^=]+?)(?<=\S)==(?![\w=])/g;

/**
 * Light Markdown for CSV authors: **bold**, *italic*, `code` and ==key term== (highlighted, which helps
 * readers find what matters: signalling, d = 0.70 [Mayer 2023]). Math (\( … \)) is left as written.
 */
export function markdownLite(s: string): string {
  return outsideMath(s, (text) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(KEY_TERM, '$1<mark>$2</mark>'),
  );
}
