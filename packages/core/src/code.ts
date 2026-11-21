// Code cards (#46): a snippet in a programming language, asked as predict-the-output, fill-the-token or
// order-the-lines. Code is only ever shown as text: it is never run and never treated as HTML.
// The rules are documented in docs/FORMAT.md ("Code cards").
import type { CheckResult } from './text';
import type { Item } from './types';

export type TokenKind = 'keyword' | 'string' | 'comment' | 'number';
export type Token = { kind: TokenKind | null; text: string };

type Lang = {
  name: string;
  kw: string;
  line?: string;
  block?: boolean;
  quotes: string;
  triple?: boolean;
  ci?: boolean;
};
const C = 'break case char const continue default do double else enum extern float for goto if int long return';
const C2 = `${C} short signed sizeof static struct switch typedef union unsigned void volatile while`;
const JS =
  'async await break case catch class const continue debugger default delete do else export extends false finally ' +
  'for function if import in instanceof let new null of return static super switch this throw true try typeof ' +
  'undefined var void while yield';
const LANGS: Record<string, Lang> = {
  python: {
    name: 'Python',
    kw:
      'False None True and as assert async await break class continue def del elif else except finally for from ' +
      'global if import in is lambda nonlocal not or pass raise return self try while with yield',
    line: '#',
    quotes: `"'`,
    triple: true,
  },
  javascript: { name: 'JavaScript', kw: JS, line: '//', block: true, quotes: '"\'`' },
  typescript: {
    name: 'TypeScript',
    kw: `${JS} abstract any as boolean declare enum implements interface keyof never number private protected public readonly string type unknown`,
    line: '//',
    block: true,
    quotes: '"\'`',
  },
  java: {
    name: 'Java',
    kw:
      'abstract boolean break byte case catch char class continue default do double else enum extends false final ' +
      'finally float for if implements import instanceof int interface long new null package private protected ' +
      'public return short static super switch this throw throws true try var void while',
    line: '//',
    block: true,
    quotes: `"'`,
  },
  c: { name: 'C', kw: `${C2} NULL include define`, line: '//', block: true, quotes: `"'` },
  cpp: {
    name: 'C++',
    kw: `${C2} auto bool class delete false namespace new nullptr private protected public std template this throw true try using virtual include define`,
    line: '//',
    block: true,
    quotes: `"'`,
  },
  csharp: {
    name: 'C#',
    kw:
      'abstract as async await base bool break case catch char class const continue decimal default do double else ' +
      'enum false finally float for foreach if in int interface internal is long namespace new null object out ' +
      'override private protected public readonly return static string struct switch this throw true try using var ' +
      'virtual void while',
    line: '//',
    block: true,
    quotes: `"'`,
  },
  go: {
    name: 'Go',
    kw:
      'break case chan const continue default defer else fallthrough false for func go goto if import interface map ' +
      'nil package range return select struct switch true type var',
    line: '//',
    block: true,
    quotes: '"\'`',
  },
  rust: {
    name: 'Rust',
    kw:
      'as break const continue crate else enum false fn for if impl in let loop match mod move mut pub ref return ' +
      'self Self static struct super trait true type unsafe use where while',
    line: '//',
    block: true,
    quotes: '"',
  },
  sql: {
    name: 'SQL',
    kw:
      'select from where and or not insert into values update set delete create table drop alter join left right ' +
      'inner outer on group by order having limit as distinct null is in like between count sum avg min max ' +
      'primary key union all case when then else end',
    line: '--',
    block: true,
    quotes: "'",
    ci: true,
  },
  bash: {
    name: 'Bash',
    kw: 'if then else elif fi for while until do done case esac in function return echo exit export local',
    line: '#',
    quotes: `"'`,
  },
};
const ALIASES: Record<string, string> = { py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript' };
Object.assign(ALIASES, { tsx: 'typescript', 'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', rs: 'rust' });
Object.assign(ALIASES, { golang: 'go', sh: 'bash', shell: 'bash', zsh: 'bash' });

/** The languages the highlighter knows, by id (`python`, `javascript`…), with their display names. */
export const CODE_LANGS = Object.entries(LANGS).map(([id, l]) => ({ id, name: l.name }));
const langOf = (lang: string) => {
  const id = lang.trim().toLowerCase();
  return LANGS[ALIASES[id] ?? id];
};
/** A language's display name (`py` → Python); an unknown one is shown as written. */
export const langName = (lang: string) => langOf(lang)?.name ?? lang.trim();

const esc = (s: string) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');
const compiled = new Map<Lang, { re: RegExp; kw: Set<string> }>();
function compile(l: Lang) {
  let c = compiled.get(l);
  if (c) return c;
  const comments = [l.block ? String.raw`/\*[\s\S]*?(?:\*/|$)` : '', l.line ? `${esc(l.line)}[^\\n]*` : ''];
  const strings = [...l.quotes].map((q) =>
    q === '`' ? '`(?:\\\\[\\s\\S]|[^\\\\`])*`?' : `${q}(?:\\\\[\\s\\S]|[^\\\\\\n${q}])*${q}?`,
  );
  if (l.triple) strings.unshift(`"""[\\s\\S]*?(?:"""|$)`, `'''[\\s\\S]*?(?:'''|$)`);
  const re = new RegExp(
    `(${comments.filter(Boolean).join('|')})|(${strings.join('|')})|` +
      String.raw`(\b(?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)|([A-Za-z_$][\w$]*)`,
    'g',
  );
  c = { re, kw: new Set(l.kw.split(' ').map((k) => (l.ci ? k.toLowerCase() : k))) };
  compiled.set(l, c);
  return c;
}

/** Split code into coloured tokens. Joined, the tokens are exactly the code. Unknown languages stay plain. */
export function highlight(code: string, lang: string): Token[] {
  const l = langOf(lang);
  if (!l || code.length > 20_000) return [{ kind: null, text: code }];
  const { re, kw } = compile(l);
  const out: Token[] = [];
  const plain = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && !last.kind) last.text += text;
    else out.push({ kind: null, text });
  };
  let at = 0;
  for (const m of code.matchAll(re)) {
    plain(code.slice(at, m.index));
    at = m.index + m[0].length;
    const kind: TokenKind | null = m[1]
      ? 'comment'
      : m[2]
        ? 'string'
        : m[3]
          ? 'number'
          : kw.has(l.ci ? m[0].toLowerCase() : m[0])
            ? 'keyword'
            : null;
    if (kind) out.push({ kind, text: m[0] });
    else plain(m[0]);
  }
  plain(code.slice(at));
  return out.length ? out : [{ kind: null, text: code }];
}

/** Code as stored: Unix line ends, no trailing spaces, no blank lines around it. Indentation is kept. */
export const normalizeCode = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^\n+|\n+$/g, '');

/**
 * The comparison key for a typed code answer (rule documented in docs/FORMAT.md): every run of spaces, tabs
 * and line breaks is one space, spaces next to punctuation don't count, and curly quotes are straight quotes.
 * Case and every other character matter.
 */
export const codeKey = (s: string) =>
  s
    .normalize('NFC')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/ ?([^\p{L}\p{N}_ ]) ?/gu, '$1')
    .trim();

/** Check a typed output or token: right or wrong, no near misses (one character changes a program). */
export function checkCode(input: string, accepted: string[]): CheckResult {
  const key = codeKey(input);
  const hit = key ? accepted.find((a) => codeKey(a) === key) : undefined;
  return { correct: hit !== undefined, nearMiss: false, articleError: false, matched: hit ?? accepted[0] ?? '' };
}

/** Where the gap goes in fill-the-token code. A private-use character, so it never clashes with real code. */
export const GAP = '';
const GAPS = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

export type CodeTask =
  | { mode: 'fill'; lang: string; code: string; answer: string; hint: string }
  | { mode: 'output'; lang: string; code: string; answer: string }
  | { mode: 'order'; lang: string; lines: string[] };

/**
 * How a code card is asked: a `{{c1::token}}` gap in the code → fill the token; an expected output (the back)
 * → predict the output; otherwise → put the lines in order. Null when the card is not a code card or has
 * nothing to ask (no gap, no output, fewer than two lines).
 */
export function codeTask(item: Pick<Item, 'kind' | 'meaning' | 'extra'>): CodeTask | null {
  if (item.kind !== 'code') return null;
  const code = item.extra?.code ?? '';
  const lang = item.extra?.codeLang ?? '';
  const gap = new RegExp(GAPS.source).exec(code);
  if (gap) {
    const reveal = (s: string) => s.replace(GAPS, '$1');
    const before = reveal(code.slice(0, gap.index));
    const after = reveal(code.slice(gap.index + gap[0].length));
    return { mode: 'fill', lang, code: before + GAP + after, answer: gap[1], hint: gap[2] ?? '' };
  }
  if (item.meaning.trim()) return { mode: 'output', lang, code, answer: item.meaning };
  const lines = code.split('\n').filter((l) => l.trim());
  return lines.length >= 2 ? { mode: 'order', lang, lines } : null;
}
