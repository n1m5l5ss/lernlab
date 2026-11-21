// Import decks from any supported source into the library. Progress on existing cards is always kept.
// Every importer returns an ImportReport (documented in docs/FORMAT.md, "Import report").
import { basename, extname } from './paths';
import { getDb, setMeta, type DB } from './db';
import {
  createDeck,
  deckByName,
  getDeck,
  storeMedia,
  upsertCards,
  type Deck,
  type DeckSettings,
  type NormalizedCard,
  type SkipCode,
} from './library';
import { csvToCards, pastedToCards } from './formats/csv';
import { lernpackMedia, readLernpack } from './formats/lernpack';
import { readApkg } from './formats/apkg';
import { importAnkiHistory } from './ankihistory';
import { jsonToCard, parseJson } from './formats/json';
import { IMPORT_LIMITS, isNestedZip, listZip, mediaProblem, readZip, type MediaProblem } from './formats/zip';
import { UserError } from './errors';

export { IMPORT_LIMITS } from './formats/zip';

export type ImportOptions = {
  deckId?: number;
  deckName?: string;
  language?: string | null;
  /** Anki packages: replay the review history into the schedule (default on). */
  ankiHistory?: boolean;
};

export type ImportFormat = 'lernpack' | 'apkg' | 'csv+media' | 'json' | 'csv' | 'tsv' | 'paste' | 'anki';
export type ImportWarningCode = MediaProblem | 'nested_zip_ignored' | 'encoding_guessed';

/** What an import did. Every code has a message under errors.<code> in locales/*.json. */
export type ImportReport = {
  deck: Deck;
  format: ImportFormat;
  /** New cards. */
  added: number;
  /** Cards that were already in the deck (matched by id): their text changed, their progress was kept. */
  updated: number;
  /** Cards in the deck after the import. */
  total: number;
  /** Rows that were not imported: `row` is the line in a CSV/TSV/JSONL file, otherwise the card's position (from 1). */
  skipped: { row: number; code: SkipCode }[];
  /** All skipped rows; `skipped` lists at most REPORT_LIST_MAX of them. */
  skippedCount: number;
  /** Media files saved. */
  media: number;
  /** How many media files cards refer to that were not found. */
  mediaMissing: number;
  /** Their names (at most REPORT_LIST_MAX). */
  missingMedia: string[];
  /** Files that were left out, with the reason. */
  warnings: { code: ImportWarningCode; file?: string }[];
  /** Past Anki reviews replayed into the schedule (0 for other formats). */
  reviews: number;
};
/** Older name of ImportReport. */
export type ImportResult = ImportReport;

export const REPORT_LIST_MAX = 500;

/** Every code an import report can hold, for the translation check. */
export const IMPORT_REPORT_CODES: readonly (SkipCode | ImportWarningCode)[] = [
  'row_no_front',
  'row_duplicate',
  'row_invalid',
  'media_unsupported',
  'media_too_large',
  'media_wrong_type',
  'nested_zip_ignored',
  'encoding_guessed',
];

function pickDeck(
  fallbackName: string,
  opts: ImportOptions,
  language: string | null = null,
  settings: DeckSettings = {},
  d: DB = getDb(),
): Deck {
  if (opts.deckId) {
    const dk = getDeck(opts.deckId, d);
    if (dk) return dk;
  }
  const name = (opts.deckName || fallbackName).trim() || 'My deck';
  return (
    deckByName(name, d) ?? createDeck(name, opts.language !== undefined ? opts.language : language, settings, '', d)
  );
}

const MEDIA_FIELDS = ['image', 'audio', 'video'] as const;
const isRemote = (v: string) => /^https?:\/\//.test(v); // remote media is allowed (shown when online)

/** File names (and their base names) the cards refer to. */
export function mediaRefs(cards: NormalizedCard[]): Set<string> {
  const refs = new Set<string>();
  for (const c of cards)
    for (const k of MEDIA_FIELDS) {
      const v = c[k];
      if (v && !isRemote(v)) refs.add(v).add(basename(v));
    }
  return refs;
}

type Parsed = {
  format: ImportFormat;
  cards: NormalizedCard[];
  /** Line or position of each card in the source, for the report. Defaults to position. */
  lines?: number[];
  invalid?: number[];
  media?: Record<string, Uint8Array>;
  mediaMissing?: string[];
  warnings?: ImportReport['warnings'];
};

/** Save media, point cards at the saved files, and write the cards. Media that fails a check is left out. */
function finish(p: Parsed, deck: () => Deck, d: DB): ImportReport {
  if (p.cards.length > IMPORT_LIMITS.cards)
    throw new UserError('too_many_cards', 'Too many cards in one file', { max: IMPORT_LIMITS.cards });
  const warnings = [...(p.warnings ?? [])];
  const media = p.media ?? {};
  const saved: Record<string, string> = {};
  for (const [name, data] of Object.entries(media)) {
    const problem = mediaProblem(name, data);
    if (problem) warnings.push({ code: problem, file: name });
    else saved[name] = storeMedia(name, data);
  }
  const missing = new Set(p.mediaMissing ?? []);
  for (const c of p.cards)
    for (const k of MEDIA_FIELDS) {
      const v = c[k];
      if (!v || isRemote(v)) continue;
      const key = saved[v] ?? saved[basename(v)];
      if (key) c[k] = key;
      else {
        c[k] = undefined;
        if (!media[v] && !media[basename(v)]) missing.add(v);
      }
    }
  const res = upsertCards(deck(), p.cards, d);
  const skipped = [
    ...(p.invalid ?? []).map((row) => ({ row, code: 'row_invalid' as const })),
    ...res.skipped.map((s) => ({ row: p.lines?.[s.index] ?? s.index + 1, code: s.code })),
  ].sort((a, b) => a.row - b.row);
  return {
    deck: res.deck,
    format: p.format,
    added: res.added,
    updated: res.updated,
    total: res.total,
    skipped: skipped.slice(0, REPORT_LIST_MAX),
    skippedCount: skipped.length,
    media: Object.keys(saved).length,
    mediaMissing: missing.size,
    missingMedia: [...missing].slice(0, REPORT_LIST_MAX),
    warnings: warnings.slice(0, REPORT_LIST_MAX),
    reviews: 0,
  };
}

/** Text in UTF-8, UTF-16 (with a byte order mark) or, failing UTF-8, Windows-1252 (old Excel exports). */
function decodeText(data: Uint8Array): { text: string; guessed: boolean } {
  if (data[0] === 0xff && data[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(data), guessed: false };
  if (data[0] === 0xfe && data[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(data), guessed: false };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(data), guessed: false };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(data), guessed: true };
  }
}

const notInMacFolder = (n: string) => !n.startsWith('__MACOSX');

export function importFile(
  fileName: string,
  data: Uint8Array,
  opts: ImportOptions = {},
  d: DB = getDb(),
): ImportReport {
  const ext = extname(fileName).toLowerCase();
  const base = basename(fileName, ext);

  if (data[0] === 0x50 && data[1] === 0x4b) {
    const names = listZip(data).map((e) => e.name);
    const nested = names.filter((n) => isNestedZip(n) && notInMacFolder(n));
    const warnings: ImportReport['warnings'] = nested.map((file) => ({
      code: 'nested_zip_ignored',
      file: basename(file),
    }));
    if (names.some((n) => n.endsWith('manifest.json'))) {
      const pack = readLernpack(data);
      const g = pack.manifest.deck;
      const want = mediaRefs(pack.cards);
      const media = lernpackMedia(data, (f) => want.has(f) && !isNestedZip(f));
      return finish(
        { format: 'lernpack', ...pack, media, warnings },
        () => {
          const deck = pickDeck(g.name || base, opts, g.language ?? null, g.goal ? { goal: g.goal } : {}, d);
          if (g.description && !deck.description)
            d.prepare('UPDATE decks SET description = ? WHERE id = ?').run(g.description, deck.id);
          return deck;
        },
        d,
      );
    }
    if (names.some((n) => /(^|\/)collection\.anki/.test(n))) {
      const apkg = readApkg(data);
      const root = apkg.decks.length
        ? apkg.decks
            .map((x) => x.split('::')[0])
            .sort(
              (a, b) =>
                apkg.decks.filter((x) => x.startsWith(b)).length - apkg.decks.filter((x) => x.startsWith(a)).length,
            )[0]
        : base;
      const report = finish(
        { format: 'apkg', ...apkg },
        () => pickDeck(root.replace(/^Lang$/, base), opts, null, {}, d),
        d,
      );
      if (opts.ankiHistory !== false) report.reviews = importAnkiHistory(report.deck.id, apkg.history, d);
      return report;
    }
    // A zip with a CSV plus its images/audio.
    const csvName = names.find((n) => /\.(csv|tsv|txt)$/i.test(n) && notInMacFolder(n));
    if (!csvName)
      throw new UserError(
        'unsupported_zip',
        'Unsupported zip: expected a .lernpack, an Anki .apkg, or a zip with a CSV and media files',
      );
    const decoded = decodeText(readZip(data, (n) => n === csvName)[csvName]);
    const { cards, lines } = csvToCards(decoded.text);
    if (decoded.guessed) warnings.push({ code: 'encoding_guessed', file: basename(csvName) });
    const want = mediaRefs(cards);
    const files = readZip(data, (n) => n !== csvName && notInMacFolder(n) && !isNestedZip(n) && want.has(basename(n)));
    const media = Object.fromEntries(Object.entries(files).map(([n, v]) => [basename(n), v]));
    return finish(
      { format: 'csv+media', cards, lines, media, warnings },
      () => pickDeck(basename(csvName, extname(csvName)) || base, opts, null, {}, d),
      d,
    );
  }
  if (['.zip', '.apkg', '.colpkg', '.lernpack'].includes(ext))
    throw new UserError('zip_damaged', 'This file is damaged or not a complete zip file');

  const { text, guessed } = decodeText(data);
  if (text.includes('\0')) throw new UserError('not_text', 'Not a text file');
  const warnings: ImportReport['warnings'] = guessed ? [{ code: 'encoding_guessed', file: fileName }] : [];
  const json = ext === '.json' || /^\s*[[{]/.test(text) ? parseJson(text) : undefined;
  if (ext === '.json' && json === undefined)
    throw new UserError('bad_json', 'This JSON file could not be read: check that it is valid JSON');
  if (json !== undefined) {
    const j = json as { cards?: unknown; deck?: { name?: unknown; language?: unknown; goal?: unknown } } | null;
    const list = Array.isArray(j) ? j : Array.isArray(j?.cards) ? j.cards : [];
    if (!list.length)
      throw new UserError('no_cards', 'No cards found. Use one card per line: front, back (comma or tab separated).');
    const cards: NormalizedCard[] = [];
    const lines: number[] = [];
    const invalid: number[] = [];
    list.forEach((raw: unknown, i: number) => {
      const card = jsonToCard(raw);
      if (card) {
        cards.push(card);
        lines.push(i + 1);
      } else invalid.push(i + 1);
    });
    const g = Array.isArray(j) ? {} : (j?.deck ?? {});
    const name = typeof g.name === 'string' ? g.name : base;
    const language = typeof g.language === 'string' ? g.language : null;
    const goal = g.goal && typeof g.goal === 'object' ? { goal: g.goal as DeckSettings['goal'] } : {};
    return finish(
      { format: 'json', cards, lines, invalid, warnings },
      () => pickDeck(name, opts, language, goal, d),
      d,
    );
  }
  const { cards, lines } = csvToCards(text);
  if (!cards.length)
    throw new UserError('no_cards', 'No cards found. Use one card per line: front, back (comma or tab separated).');
  const format = ext === '.tsv' || text.includes('\t') ? 'tsv' : 'csv';
  return finish({ format, cards, lines, warnings }, () => pickDeck(base, opts, null, {}, d), d);
}

/** Cards pasted as text, with custom separators between term and definition and between cards. */
export function importPasted(
  text: string,
  opts: ImportOptions & { deckName: string; fieldSep?: string; cardSep?: string },
  d: DB = getDb(),
): ImportReport {
  const cards = pastedToCards(text, opts.fieldSep || '\t', opts.cardSep || '\n');
  if (!cards.length) throw new UserError('no_cards', 'No cards found in the pasted text');
  return finish({ format: 'paste', cards }, () => pickDeck(opts.deckName, opts, opts.language ?? null, {}, d), d);
}

/** A running Anki desktop. The desktop app implements this with the AnkiConnect add-on. */
export interface AnkiSource {
  notesInDeck(deck: string): Promise<AnkiNote[]>;
  /** Deck name for each note id, looked up from one card id per note. */
  cardDecks(cardIds: number[]): Promise<Record<number, string>>;
  mediaFile(filename: string): Promise<Uint8Array | null>;
}

export type AnkiNote = {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  cards: number[];
};

/** How far a live Anki import is: reading notes, then copying media files. */
export type AnkiProgress = { step: 'notes' } | { step: 'media'; done: number; total: number };

/** Live import from a running Anki desktop. */
export async function importFromAnki(
  anki: AnkiSource,
  source: string,
  opts: ImportOptions = {},
  onProgress?: (p: AnkiProgress) => void,
  d: DB = getDb(),
): Promise<ImportReport> {
  onProgress?.({ step: 'notes' });
  const notes = await anki.notesInDeck(source);
  if (!notes.length) throw new UserError('anki_deck_empty', 'This Anki deck has no notes', { deck: source });
  const deckOf = await anki.cardDecks(notes.map((n) => n.cards[0]).filter(Boolean));
  const fieldMapped = notes.map((n) => {
    const f = (...names: string[]) => {
      for (const x of names) if (n.fields[x]) return n.fields[x].value ?? '';
      return '';
    };
    const order = Object.entries(n.fields)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([, v]) => v.value);
    const all = order.join(' ');
    const reading = f('Reading');
    return {
      sourceId: n.noteId,
      front: (f('Target', 'Front', 'Word', 'Expression', 'Text') || order[0] || '').replace(/\[sound:[^\]]+\]/g, ''),
      back: (f('Meaning', 'Back', 'Definition', 'Extra') || order[1] || '').replace(/\[sound:[^\]]+\]/g, ''),
      example: f('Sentence', 'Example') || undefined,
      exampleTranslation: f('SentenceMeaning', 'Translation') || undefined,
      explanation: f('Grammar') || undefined,
      notes: f('Notes') || undefined,
      audio: all.match(/\[sound:([^\]]+)\]/)?.[1],
      image: all.match(/<img[^>]+src=["']?([^"' >]+)/i)?.[1],
      tags: n.tags,
      subdeck: deckOf[n.noteId] ?? source,
      group: n.tags.find((t) => /^G\d+$/.test(t)),
      rank: parseInt(f('Rank').replace(/<[^>]+>/g, ''), 10) || 0,
      extra: reading ? { reading } : undefined,
    } as NormalizedCard;
  });

  const german = /german|deutsch/i.test(source);
  const fallbackName = german ? 'German' : source.split('::').pop()!;
  const deck = pickDeck(
    fallbackName,
    opts,
    german ? 'de' : null,
    {
      ankiSource: source,
      ...(german
        ? { goal: { label: 'Goethe B1', words: 2400, hoursLow: 260, hoursHigh: 490, tag: 'exam_goethe_b1' } }
        : {}),
    },
    d,
  );

  // About-me words are woven into the frequency order (every 4th slot after the first 12).
  const vocab = fieldMapped
    .filter((c) => !c.tags?.includes('aboutme') && !c.tags?.includes('grammar'))
    .sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
  const aboutMe = fieldMapped.filter((c) => c.tags?.includes('aboutme') && !c.tags?.includes('grammar'));
  const grammar = fieldMapped
    .filter((c) => c.tags?.includes('grammar'))
    .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.front.localeCompare(b.front));
  const ordered: NormalizedCard[] = [];
  let ai = 0;
  vocab.forEach((v, i) => {
    ordered.push(v);
    if (i >= 11 && i % 4 === 3 && ai < aboutMe.length) ordered.push(aboutMe[ai++]);
  });
  ordered.push(...aboutMe.slice(ai), ...grammar);
  ordered.forEach((c, i) => {
    c.rank = i + 1;
  });

  const media: Record<string, Uint8Array> = {};
  const files = [...new Set(ordered.flatMap((c) => [c.audio, c.image]).filter(Boolean) as string[])];
  for (const [i, file] of files.entries()) {
    if (i % 20 === 0) onProgress?.({ step: 'media', done: i, total: files.length });
    const buf = await anki.mediaFile(file).catch(() => null);
    if (buf) media[file] = buf;
  }
  const report = finish({ format: 'anki', cards: ordered, media }, () => deck, d);
  setMeta(d, 'lastImport', { source, at: new Date().toISOString(), notes: ordered.length });
  return report;
}
