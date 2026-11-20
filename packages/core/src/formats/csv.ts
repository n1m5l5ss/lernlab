// CSV / TSV / Quizlet-style text import. Header row optional; columns matched by common names.
import type { NormalizedCard } from '../library';

/** RFC 4180-ish parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
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
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
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
  columns: Record<string, number>;
  header: boolean;
} {
  const clean = text.replace(/^﻿/, '');
  const delim = detectDelimiter(clean);
  const rows = parseDelimited(
    clean
      .split(/\r?\n/)
      .filter((l) => !l.startsWith('#'))
      .join('\n'),
    delim,
  );
  if (!rows.length) return { cards: [], columns: {}, header: false };
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
  const get = (r: string[], k: string) => (k in columns ? (r[columns[k]] ?? '').trim() : '');
  const cards = body
    .map((r) => {
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
    })
    .filter((c) => c.front || c.back);
  return { cards, columns, header };
}

const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export function cardsToCsv(cards: NormalizedCard[]): string {
  const cols = [
    'front',
    'back',
    'example',
    'example translation',
    'explanation',
    'notes',
    'category',
    'tags',
    'image',
    'audio',
    'video',
  ];
  const lines = [cols.join(',')];
  for (const c of cards) {
    lines.push(
      [
        c.front,
        c.back,
        c.example,
        c.exampleTranslation,
        c.explanation,
        c.notes,
        c.category,
        (c.tags ?? []).join(' '),
        c.image,
        c.audio,
        c.video,
      ]
        .map((v) => esc(v ?? ''))
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
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
