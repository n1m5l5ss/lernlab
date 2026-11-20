// Import decks from any supported source into the library. Progress on existing cards is always kept.
import { unzipSync, strFromU8 } from 'fflate';
import { basename, extname } from './paths';
import { getDb, setMeta, type DB } from './db';
import {
  createDeck,
  deckByName,
  getDeck,
  storeMedia,
  upsertCards,
  type Deck,
  type NormalizedCard,
  type UpsertResult,
} from './library';
import { csvToCards } from './formats/csv';
import { readLernpack } from './formats/lernpack';
import { readApkg } from './formats/apkg';

export type ImportOptions = { deckId?: number; deckName?: string; language?: string | null };
export type ImportResult = UpsertResult & { format: string; media: number; mediaMissing: number };

function pickDeck(
  fallbackName: string,
  opts: ImportOptions,
  language: string | null = null,
  settings = {},
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

/** Save media and drop references to files that don't exist. */
function attachMedia(cards: NormalizedCard[], media: Record<string, Uint8Array>) {
  const renamed: Record<string, string> = {};
  let stored = 0;
  for (const [name, data] of Object.entries(media)) {
    renamed[name] = storeMedia(name, data);
    stored++;
  }
  let missing = 0;
  for (const c of cards) {
    for (const k of ['image', 'audio', 'video'] as const) {
      const v = c[k];
      if (!v) continue;
      if (/^https?:\/\//.test(v)) continue; // remote media is allowed (shown when online)
      const key = renamed[v] ?? renamed[basename(v)];
      if (key) c[k] = key;
      else {
        c[k] = undefined;
        missing++;
      }
    }
  }
  return { stored, missing };
}

export function importFile(
  fileName: string,
  data: Uint8Array,
  opts: ImportOptions = {},
  d: DB = getDb(),
): ImportResult {
  const ext = extname(fileName).toLowerCase();
  const base = basename(fileName, ext);
  const isZip = data[0] === 0x50 && data[1] === 0x4b;

  if (isZip) {
    const entries = unzipSync(data, {
      filter: (f) =>
        /(^|\/)(manifest\.json|collection\.anki2|collection\.anki21b?|media)$/.test(f.name) ||
        /\.(csv|tsv|txt)$/i.test(f.name),
    });
    const names = Object.keys(entries);
    if (names.some((n) => n.endsWith('manifest.json'))) {
      const pack = readLernpack(data);
      const g = pack.manifest.deck;
      const deck = pickDeck(g.name || base, opts, g.language ?? null, g.goal ? { goal: g.goal } : {}, d);
      if (g.description && !deck.description)
        d.prepare('UPDATE decks SET description = ? WHERE id = ?').run(g.description, deck.id);
      const m = attachMedia(pack.cards, pack.media);
      return { ...upsertCards(deck, pack.cards, d), format: 'lernpack', media: m.stored, mediaMissing: m.missing };
    }
    if (names.some((n) => /collection\.anki/.test(n))) {
      const apkg = readApkg(data);
      const root = apkg.decks.length
        ? apkg.decks
            .map((x) => x.split('::')[0])
            .sort(
              (a, b) =>
                apkg.decks.filter((x) => x.startsWith(b)).length - apkg.decks.filter((x) => x.startsWith(a)).length,
            )[0]
        : base;
      const deck = pickDeck(root.replace(/^Lang$/, base), opts, null, {}, d);
      const m = attachMedia(apkg.cards, apkg.media);
      return { ...upsertCards(deck, apkg.cards, d), format: 'apkg', media: m.stored, mediaMissing: m.missing };
    }
    // A zip with a CSV plus its images/audio.
    const all = unzipSync(data);
    const csvName = Object.keys(all).find((n) => /\.(csv|tsv|txt)$/i.test(n) && !n.startsWith('__MACOSX'));
    if (!csvName)
      throw new Error('Unsupported zip: expected a .lernpack, an Anki .apkg, or a zip with a CSV and media files');
    const { cards } = csvToCards(strFromU8(all[csvName]));
    const media = Object.fromEntries(
      Object.entries(all)
        .filter(([n]) => n !== csvName && !n.endsWith('/') && !n.startsWith('__MACOSX'))
        .map(([n, v]) => [basename(n), v]),
    );
    const deck = pickDeck(basename(csvName, extname(csvName)) || base, opts, null, {}, d);
    const m = attachMedia(cards, media);
    return { ...upsertCards(deck, cards, d), format: 'csv+media', media: m.stored, mediaMissing: m.missing };
  }

  const text = new TextDecoder().decode(data);
  if (ext === '.json' || /^\s*[[{]/.test(text)) {
    const j = JSON.parse(text);
    const cards: NormalizedCard[] = (Array.isArray(j) ? j : (j.cards ?? [])).map(
      (c: NormalizedCard & { id?: string }) => ({
        ...c,
        sourceId: c.sourceId ?? c.id,
      }),
    );
    const deck = pickDeck(
      j.deck?.name ?? base,
      opts,
      j.deck?.language ?? null,
      j.deck?.goal ? { goal: j.deck.goal } : {},
      d,
    );
    const m = attachMedia(cards, {});
    return { ...upsertCards(deck, cards, d), format: 'json', media: 0, mediaMissing: m.missing };
  }
  const { cards } = csvToCards(text);
  if (!cards.length) throw new Error('No cards found. Use one card per line: front, back (comma or tab separated).');
  const deck = pickDeck(base, opts, null, {}, d);
  const m = attachMedia(cards, {});
  return {
    ...upsertCards(deck, cards, d),
    format: ext === '.tsv' || text.includes('\t') ? 'tsv' : 'csv',
    media: 0,
    mediaMissing: m.missing,
  };
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

/** Live import from a running Anki desktop. */
export async function importFromAnki(
  anki: AnkiSource,
  source: string,
  opts: ImportOptions = {},
  onProgress?: (msg: string) => void,
  d: DB = getDb(),
): Promise<ImportResult> {
  onProgress?.(`Reading notes from Anki deck "${source}"…`);
  const notes = await anki.notesInDeck(source);
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
    if (i % 50 === 0) onProgress?.(`Copying media ${i + 1}/${files.length}…`);
    const buf = await anki.mediaFile(file).catch(() => null);
    if (buf) media[file] = buf;
  }
  const m = attachMedia(ordered, media);
  const res = upsertCards(deck, ordered, d);
  setMeta(d, 'lastImport', { source, at: new Date().toISOString(), notes: ordered.length });
  onProgress?.(`Done: ${res.total} cards (${res.added} new, ${res.updated} updated), ${m.stored} media files.`);
  return { ...res, format: 'anki', media: m.stored, mediaMissing: m.missing };
}
