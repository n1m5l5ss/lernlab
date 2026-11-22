// Import preview: read a file or pasted text into cards WITHOUT saving anything, so people see what
// will happen before it happens. Delimited text (CSV/TSV/TXT) can also be re-mapped column by column;
// `mapFile` turns such a mapping into a plain CSV with known headers that `importFile` reads as usual.
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { basename, extname } from './paths';
import { cardToItem, type NormalizedCard } from './library';
import { markdownLite } from './cards';
import { csvToCards, detectDelimiter, parseDelimited, pastedToCards } from './formats/csv';
import { readLernpack } from './formats/lernpack';
import { readApkg } from './formats/apkg';
import { stripHtml } from './text';
import { countHints, type HintCount } from './cardquality';
import { UserError } from './errors';

/** Card fields a column can be mapped to, with the CSV header the CSV reader knows them by. */
export const MAPPABLE_FIELDS = {
  front: 'front',
  back: 'back',
  example: 'example',
  exampleTranslation: 'example translation',
  explanation: 'explanation',
  notes: 'notes',
  mnemonic: 'mnemonic',
  category: 'category',
  tags: 'tags',
  image: 'image',
  imageAlt: 'image_alt',
  audio: 'audio',
  video: 'video',
  subdeck: 'deck',
  group: 'lesson',
  rank: 'rank',
  reading: 'reading',
  sourceId: 'id',
  type: 'type',
  choices: 'choices',
  correct: 'correct',
  steps: 'steps',
  altAnswers: 'alt_answers',
  variants: 'variants',
  corrections: 'corrections',
  keyPoints: 'key_points',
  keyTerms: 'key_terms',
  workedSteps: 'worked_steps',
  case: 'case',
  graph: 'graph',
} as const;
export type MappableField = keyof typeof MAPPABLE_FIELDS;

/** Which column (0-based) feeds which card field, and whether the first row holds column names. */
export type ColumnMapping = { header: boolean; fields: Partial<Record<MappableField, number>> };

/** A card as the preview shows it: plain text, formatting removed. */
export type PreviewCard = { front: string; back: string; example: string; tags: string[] };
export type SkipReason = 'no_front';
export type ImportPreview = {
  format: string;
  /** The deck name the file suggests (manifest, Anki deck or file name). */
  deckName: string;
  total: number;
  cards: PreviewCard[];
  skipped: { reason: SkipReason; count: number }[];
  /** Suggestions for better cards, counted over every card (cardquality.ts). Importing never depends on them. */
  hints: HintCount[];
  /** Columns of delimited text, for mapping. Null for formats with named fields (deck files, JSON, Anki). */
  table: { header: boolean; columns: { name: string; sample: string }[]; fields: ColumnMapping['fields'] } | null;
  /** Anki packages: past reviews that can be replayed into the schedule (one per card per day). */
  ankiReviews?: number;
};

export const PREVIEW_LIMIT = 10;

// Light Markdown is read as it will be saved, so ==term== and **bold** preview without their marks.
const plain = (s: string | undefined) => stripHtml(markdownLite(String(s ?? ''))).trim();
const isZip = (data: Uint8Array) => data[0] === 0x50 && data[1] === 0x4b;

function summarize(
  format: string,
  deckName: string,
  cards: NormalizedCard[],
  table: ImportPreview['table'],
  limit: number,
): ImportPreview {
  const probe = { id: 0, name: deckName, language: null };
  const noFront = cards.filter((c) => !cardToItem(probe, c)).length;
  return {
    format,
    deckName,
    total: cards.length,
    cards: cards.slice(0, limit).map((c) => ({
      front: plain(c.front),
      back: plain(c.back),
      example: plain(c.example),
      tags: c.tags ?? [],
    })),
    skipped: noFront ? [{ reason: 'no_front', count: noFront }] : [],
    hints: countHints(probe, cards),
    table,
  };
}

/** Rows of delimited text, read the same way the CSV importer reads them (BOM and # comments removed). */
function readRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  return parseDelimited(
    clean
      .split(/\r?\n/)
      .filter((l) => !l.startsWith('#'))
      .join('\n'),
    detectDelimiter(clean),
  );
}

const quote = (s: string) => (/^[#"]|[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Rewrite delimited text as a CSV whose headers name the mapped fields; unmapped columns are dropped. */
export function applyMapping(text: string, mapping: ColumnMapping): string {
  const fields = Object.entries(mapping.fields).filter(
    (e): e is [MappableField, number] =>
      Object.hasOwn(MAPPABLE_FIELDS, e[0]) && Number.isInteger(e[1]) && (e[1] as number) >= 0,
  );
  if (!fields.some(([f]) => f === 'front'))
    throw new UserError('mapping_needs_front', 'Choose which column holds the front of the cards');
  // Without a back column the CSV reader would borrow an unmapped one, so give it an empty one.
  const cols: [MappableField, number][] = [
    ...fields.sort((a, b) => a[1] - b[1]),
    ...(fields.some(([f]) => f === 'back') ? [] : [['back', -1] as [MappableField, number]]),
  ];
  const rows = readRows(text);
  const body = mapping.header ? rows.slice(1) : rows;
  const lines = [cols.map(([f]) => MAPPABLE_FIELDS[f]).join(',')];
  for (const r of body) lines.push(cols.map(([, i]) => quote(i < 0 ? '' : (r[i] ?? ''))).join(','));
  return `${lines.join('\n')}\n`;
}

/** Is this file delimited text that columns can be mapped for (not a zip and not JSON)? */
function delimitedText(fileName: string, data: Uint8Array): string | null {
  if (isZip(data)) return null;
  const text = new TextDecoder().decode(data);
  if (extname(fileName).toLowerCase() === '.json' || /^\s*[[{]/.test(text)) return null;
  return text;
}

/** The bytes to hand to `importFile` for a mapped file: unchanged when there is no mapping. */
export function mapFile(fileName: string, data: Uint8Array, mapping?: ColumnMapping): Uint8Array {
  const text = mapping ? delimitedText(fileName, data) : null;
  return text === null || !mapping ? data : strToU8(applyMapping(text, mapping));
}

function previewDelimited(text: string, deckName: string, mapping: ColumnMapping | undefined, limit: number) {
  const rows = readRows(text);
  const auto = csvToCards(text);
  const header = mapping ? mapping.header : auto.header;
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => ({
    name: header ? (rows[0]?.[i] ?? '').trim() : '',
    sample: ((header ? rows[1] : rows[0])?.[i] ?? '').trim(),
  }));
  const cards = mapping ? csvToCards(applyMapping(text, mapping)).cards : auto.cards;
  const fields = mapping ? mapping.fields : (auto.columns as ColumnMapping['fields']);
  const known = Object.fromEntries(
    Object.entries(fields).filter(([f, i]) => Object.hasOwn(MAPPABLE_FIELDS, f) && (i as number) < width),
  );
  return summarize(text.includes('\t') ? 'tsv' : 'csv', deckName, cards, { header, columns, fields: known }, limit);
}

/** Preview a dropped or chosen file. Nothing is saved. */
export function previewFile(
  fileName: string,
  data: Uint8Array,
  mapping?: ColumnMapping,
  limit = PREVIEW_LIMIT,
): ImportPreview {
  const ext = extname(fileName).toLowerCase();
  const base = basename(fileName, ext);
  if (isZip(data)) {
    const listing: string[] = [];
    unzipSync(data, {
      filter: (f) => {
        listing.push(f.name);
        return false;
      },
    });
    if (listing.some((n) => n.endsWith('manifest.json'))) {
      const pack = readLernpack(data);
      return summarize('lernpack', pack.manifest.deck.name || base, pack.cards, null, limit);
    }
    if (listing.some((n) => /collection\.anki/.test(n))) {
      const apkg = readApkg(data);
      let ankiReviews = 0;
      for (const list of apkg.history.values()) ankiReviews += list.length;
      return { ...summarize('apkg', apkg.decks[0]?.split('::')[0] || base, apkg.cards, null, limit), ankiReviews };
    }
    const all = unzipSync(data, { filter: (f) => /\.(csv|tsv|txt)$/i.test(f.name) && !f.name.startsWith('__MACOSX') });
    const csvName = Object.keys(all)[0];
    if (!csvName)
      throw new UserError(
        'unsupported_zip',
        'Unsupported zip: expected a .lernpack, an Anki .apkg, or a zip with a CSV and media files',
      );
    return summarize(
      'csv+media',
      basename(csvName, extname(csvName)) || base,
      csvToCards(strFromU8(all[csvName])).cards,
      null,
      limit,
    );
  }
  const text = delimitedText(fileName, data);
  if (text === null) {
    const j = JSON.parse(new TextDecoder().decode(data));
    const cards: NormalizedCard[] = Array.isArray(j) ? j : (j.cards ?? []);
    return summarize('json', j.deck?.name ?? base, cards, null, limit);
  }
  return previewDelimited(text, base, mapping, limit);
}

/** Preview pasted text split by the chosen separators. Nothing is saved. */
export function previewText(text: string, fieldSep = '\t', cardSep = '\n', limit = PREVIEW_LIMIT): ImportPreview {
  return summarize('paste', '', pastedToCards(text, fieldSep || '\t', cardSep || '\n'), null, limit);
}
