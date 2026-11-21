// Text helpers shared by server (exercise generation) and client (instant answer checking).
import type { Line } from './teacher';
import { hasMath, mathKey } from './math';

export const ARTICLES = ['der', 'die', 'das'] as const;
export type Article = (typeof ARTICLES)[number];

/** Cut out every <script> and <style> element with its contents; an unclosed one runs to the end. */
function dropCode(html: string): string {
  const lower = html.toLowerCase();
  let out = '';
  let i = 0;
  while (i < html.length) {
    const s = lower.indexOf('<script', i);
    const t = lower.indexOf('<style', i);
    const at = s < 0 ? t : t < 0 ? s : Math.min(s, t);
    if (at < 0) break;
    const name = at === s ? 'script' : 'style';
    if (/[\w-]/.test(lower.charAt(at + name.length + 1))) {
      out += html.slice(i, at + 1);
      i = at + 1;
      continue;
    }
    out += html.slice(i, at);
    const close = '</' + name;
    const end = lower.indexOf(close, at);
    if (end < 0) return out;
    const gt = lower.indexOf('>', end);
    i = gt < 0 ? html.length : gt + 1;
  }
  return out + html.slice(i);
}

/** Remove HTML tags (and the code inside script and style) and decode the few entities Anki commonly stores. */
export function stripHtml(html: string): string {
  // Repeat until nothing changes, so pieces like "<scr<b></b>ipt>" can't join into a new tag.
  let text = html;
  for (let prev = ''; prev !== text;) {
    prev = text;
    text = dropCode(text)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '');
  }
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a sentence like "Ich <b>bin</b> müde." into the parts around the first bold span. */
export function splitBold(html: string): { before: string; bold: string; after: string } | null {
  const m = html.match(/^(.*?)<b>(.*?)<\/b>(.*)$/i);
  if (!m) return null;
  return { before: stripHtml(m[1]), bold: stripHtml(m[2]), after: stripHtml(m[3]) };
}

/** Lowercase, unify umlaut spellings and ß, drop punctuation and extra spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[.,!?;:"'„“”‚‘’()«»–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same as normalize but keeps umlauts distinct (used to tell "exact" from "umlaut-substituted"). */
export function normalizeLoose(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:"'„“”‚‘’()«»–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type CheckResult = {
  correct: boolean;
  /** Accepted, but with a small slip (typo, umlaut written as ae, capitalisation). Grades as Hard. */
  nearMiss: boolean;
  /** For nouns: the word was right but the article was wrong (or missing). */
  articleError: boolean;
  /** Short note shown in feedback, as a locale key (check.*) with its values. */
  note?: Line;
  /** Which accepted answer the input matched (or the canonical one). */
  matched: string;
};

/** Split a noun like "der Sohn" into its article and the bare noun. */
export function splitArticle(target: string): { article: Article | null; word: string } {
  const m = target.trim().match(/^(der|die|das)\s+(.+)$/i);
  if (m && !/\//.test(target)) return { article: m[1].toLowerCase() as Article, word: m[2] };
  return { article: null, word: target.trim() };
}

/**
 * Check a typed answer against the accepted answers.
 * Rules (from the design spec): exact → correct; umlaut spelled out (ae/oe/ue/ss) or capitalisation slip →
 * correct but near miss; one-letter typo on a word of 5+ letters → correct but near miss; for nouns, the
 * article must be right, otherwise articleError (counts as wrong for the gender, Hard for the word).
 */
export function checkAnswer(input: string, accepted: string[], opts: { requireArticle?: boolean } = {}): CheckResult {
  const given = input.trim();
  const canonical = accepted[0] ?? '';
  if (!given) return { correct: false, nearMiss: false, articleError: false, matched: canonical };

  for (const ans of accepted) {
    // Math is compared by its source, exactly (no typo forgiveness): see mathKey.
    if (hasMath(ans)) {
      if (mathKey(given) === mathKey(ans)) return { correct: true, nearMiss: false, articleError: false, matched: ans };
      continue;
    }
    const r = compareOne(given, ans, opts.requireArticle ?? false);
    if (r) return { ...r, matched: ans };
  }
  return { correct: false, nearMiss: false, articleError: false, matched: canonical };
}

function compareOne(given: string, answer: string, requireArticle: boolean): Omit<CheckResult, 'matched'> | null {
  const g = splitArticle(given);
  const a = splitArticle(answer);

  if (a.article && requireArticle) {
    const wordResult = compareWords(g.article ? g.word : given, a.word);
    if (!wordResult) return null;
    if (g.article !== a.article) {
      return {
        correct: false,
        nearMiss: false,
        articleError: true,
        note: g.article
          ? { key: 'check.articleWrong', params: { right: a.article, given: g.article } }
          : { key: 'check.articleMissing', params: { article: a.article, word: a.word } },
      };
    }
    return { correct: true, nearMiss: wordResult.near, articleError: false, note: wordResult.note };
  }

  const r = compareWords(given, answer);
  if (!r) return null;
  return { correct: true, nearMiss: r.near, articleError: false, note: r.note };
}

function compareWords(given: string, answer: string): { near: boolean; note?: Line } | null {
  if (given.trim() === answer.trim()) return { near: false };
  const gl = normalizeLoose(given);
  const al = normalizeLoose(answer);
  if (gl === al) {
    // Only case or punctuation differs. German nouns need capitals, so flag it gently.
    const caseOnly = given.trim().toLowerCase() === answer.trim().toLowerCase();
    return caseOnly && given.trim() !== answer.trim()
      ? { near: true, note: { key: 'check.capitals', params: { answer } } }
      : { near: false };
  }
  const gn = normalize(given);
  const an = normalize(answer);
  if (gn === an) return { near: true, note: { key: 'check.spelling', params: { answer } } };
  if (an.length >= 5 && levenshtein(gn, an) <= 1)
    return { near: true, note: { key: 'check.almost', params: { answer } } };
  return null;
}

/** Word-level similarity 0..1 used for spoken answers (speech recognition is noisy). */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x && !y) return 1;
  const d = levenshtein(x, y);
  return 1 - d / Math.max(x.length, y.length, 1);
}

/** Tokenise a sentence into word tiles, keeping punctuation attached to the word before it. */
export function tokenize(sentence: string): string[] {
  return stripHtml(sentence).split(/\s+/).filter(Boolean);
}

/** Accepted answers for a vocabulary target: the full target plus each slash/semicolon alternative. */
export function acceptedAnswers(target: string): string[] {
  const clean = stripHtml(target)
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
  if (hasMath(clean)) return [clean]; // a / or \; inside a formula is not a list of answers
  const parts = clean
    .split(/\s*[/;]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const set = new Set([clean, ...(parts.length > 1 ? parts : [])]);
  return [...set];
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
