// CSV / TSV / Quizlet-style text import, and the CSV that exports write. Header row optional; columns matched by common names.
import type { NormalizedCard } from '../library';

/** RFC 4180-ish parser: quoted fields, doubled quotes, newlines inside quotes.
 *  `lines`, when given, receives the 1-based line each returned row starts on. */
export function parseDelimited(text: string, delim: string, lines?: number[]): string[][] {
  const rows: string[][] = [];
  const starts: number[] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  let line = 1;
  let start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '\n') line++;
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      starts.push(start);
      start = ++line;
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
    starts.push(start);
  }
  const keep = rows.map((r) => r.some((c) => c.trim()));
  lines?.push(...starts.filter((_, i) => keep[i]));
  return rows.filter((_, i) => keep[i]);
}

export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) ?? '';
  if (first.includes('\t')) return '\t';
  const count = (c: string) => first.split(c).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

const COLUMNS: Record<string, string[]> = {
  front: ['front', 'term', 'question', 'word', 'target', 'prompt', 'expression', 'vocab', 'q'],
  back: ['back', 'definition', 'answer', 'meaning', 'translation', 'a', 'english'],
  example: ['example', 'sentence', 'context', 'example sentence'],
  exampleTranslation: [
    'example translation',
    'example_translation',
    'sentence meaning',
    'sentencemeaning',
    'sentence translation',
  ],
  explanation: ['explanation', 'grammar', 'rule', 'why', 'rationale'],
  notes: ['notes', 'note', 'hint', 'mnemonic', 'extra'],
  image: ['image', 'picture', 'img'],
  audio: ['audio', 'sound'],
  video: ['video', 'gif', 'clip'],
  category: ['category', 'group by', 'class', 'gender', 'article', 'group'],
  tags: ['tags', 'tag', 'labels'],
  subdeck: ['deck', 'subdeck', 'chapter', 'section', 'topic'],
  group: ['lesson', 'unit'],
  rank: ['rank', 'frequency', 'order', '#'],
  reading: ['reading', 'pronunciation', 'furigana', 'romanization', 'ipa'],
  sourceId: ['id', 'guid'],
  type: ['type', 'card type', 'kind'],
  choices: ['choices', 'options'],
  correct: ['correct', 'correct answer', 'correct answers'],
  steps: ['steps', 'sequence'],
  altAnswers: ['alt_answers', 'alt answers', 'alternatives', 'also accept'],
  extra: [],
};

export function csvToCards(text: string): {
  cards: NormalizedCard[];
  /** The 1-based line in the file each card starts on. */
  lines: number[];
  columns: Record<string, number>;
  header: boolean;
} {
  const clean = text.replace(/^﻿/, '');
  const delim = detectDelimiter(clean);
  const starts: number[] = [];
  // Comment lines become empty lines, so line numbers still match the file.
  const rows = parseDelimited(
    clean
      .split(/\r?\n/)
      .map((l) => (l.startsWith('#') ? '' : l))
      .join('\n'),
    delim,
    starts,
  );
  if (!rows.length) return { cards: [], lines: [], columns: {}, header: false };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const columns: Record<string, number> = {};
  for (const [key, names] of Object.entries(COLUMNS)) {
    const idx = head.findIndex((h) => names.includes(h));
    if (idx >= 0) columns[key] = idx;
  }
  const header = 'front' in columns || 'back' in columns || Object.keys(columns).length >= 2;
  if (!header) {
    columns.front = 0;
    columns.back = 1;
  }
  if (header && !('front' in columns)) columns.front = [0, 1].find((i) => !Object.values(columns).includes(i)) ?? 0;
  if (header && !('back' in columns))
    columns.back = [1, 0, 2].find((i) => !Object.values(columns).includes(i) && i !== columns.front) ?? 1;
  const body = header ? rows.slice(1) : rows;
  const lines = header ? starts.slice(1) : starts;
  const get = (r: string[], k: string) => (k in columns ? (r[columns[k]] ?? '').trim() : '');
  // A row with a back but no front is kept, so the import report can name it; a row with neither is not a card.
  const all = body.map((r) => {
    const reading = get(r, 'reading');
    return {
      sourceId: get(r, 'sourceId') || undefined,
      front: get(r, 'front'),
      back: get(r, 'back'),
      example: get(r, 'example') || undefined,
      exampleTranslation: get(r, 'exampleTranslation') || undefined,
      explanation: get(r, 'explanation') || undefined,
      notes: get(r, 'notes') || undefined,
      image: get(r, 'image') || undefined,
      audio: get(r, 'audio') || undefined,
      video: get(r, 'video') || undefined,
      category: get(r, 'category') || undefined,
      tags: get(r, 'tags') ? get(r, 'tags').split(/[\s,;]+/) : [],
      subdeck: get(r, 'subdeck') || undefined,
      group: get(r, 'group') || undefined,
      rank: Number(get(r, 'rank')) || undefined,
      extra: reading ? { reading } : undefined,
      type: get(r, 'type') || undefined,
      choices: get(r, 'choices') || undefined,
      correct: get(r, 'correct') || undefined,
      steps: get(r, 'steps') || undefined,
      altAnswers: get(r, 'altAnswers') || undefined,
    } as NormalizedCard;
  });
  const keep = all.map((c) => !!(c.front || c.back));
  return { cards: all.filter((_, i) => keep[i]), lines: lines.filter((_, i) => keep[i]), columns, header };
}

/** CSV columns LernLab writes: every card field a spreadsheet can hold, named so `csvToCards` reads them back. */
const CSV_COLUMNS: [string, (c: NormalizedCard) => string | number | undefined][] = [
  ['front', (c) => c.front],
  ['back', (c) => c.back],
  ['alt_answers', (c) => c.altAnswers],
  ['example', (c) => c.example],
  ['example translation', (c) => c.exampleTranslation],
  ['explanation', (c) => c.explanation],
  ['notes', (c) => c.notes],
  ['category', (c) => c.category],
  ['tags', (c) => (c.tags ?? []).join(' ')],
  ['type', (c) => c.type],
  ['choices', (c) => c.choices],
  ['correct', (c) => c.correct],
  ['steps', (c) => c.steps],
  ['image', (c) => c.image],
  ['audio', (c) => c.audio],
  ['video', (c) => c.video],
  ['deck', (c) => c.subdeck],
  ['lesson', (c) => c.group],
  ['rank', (c) => c.rank],
  ['reading', (c) => c.extra?.reading],
  ['id', (c) => c.sourceId],
];

/** Quote a cell when it holds a separator, a quote or a line break, or starts like a # comment line. */
const csvCell = (v: string | number | undefined) => {
  const s = String(v ?? '');
  return /^#|[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Cards as a CSV that `csvToCards` reads back to the same cards. */
export function cardsToCsv(cards: NormalizedCard[]): string {
  const lines = [CSV_COLUMNS.map(([name]) => name).join(',')];
  for (const c of cards) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(c))).join(','));
  return `${lines.join('\n')}\n`;
}

/** Quizlet-style paste: custom separators between term/definition and between cards. */
export function pastedToCards(text: string, fieldSep = '\t', cardSep = '\n'): NormalizedCard[] {
  const cards = text
    .split(cardSep === '\n' ? /\r?\n/ : cardSep)
    .map((c) => c.trim())
    .filter(Boolean);
  return cards
    .map((c) => {
      const i = c.indexOf(fieldSep);
      return i < 0
        ? { front: c, back: '' }
        : { front: c.slice(0, i).trim(), back: c.slice(i + fieldSep.length).trim() };
    })
    .filter((c) => c.front);
}
