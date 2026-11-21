// Decks and cards: create, update, import (any format → NormalizedCard), export.
import type { Row } from './host';
import type { DeckRow } from './schema';
import { getDb, getMeta, setMeta, tx, type DB } from './db';
import { host } from './host';
import { basename, extname } from './paths';
import { sha1Hex } from './sha1';
import { stripHtml, splitArticle } from './text';
import { markdownLite, sanitizeHtml } from './cards';
import { parseQuantity, parseTolerance } from './numeric';
import type { Item, ItemKind } from './types';
import { UserError } from './errors';
import { cleanExamSettings, type ExamSettings } from './exam';

export type DeckSettings = {
  newPerDay?: number;
  goal?: { label: string; words: number; hoursLow?: number; hoursHigh?: number; tag?: string };
  /** The day of the exam or deadline this deck works towards (YYYY-MM-DD). */
  examDate?: string;
  ankiSource?: string;
  /** The system voice that reads this deck's cards aloud (its voiceURI); none means the best match. */
  voice?: string;
  /** Reading-aloud speed, 0.5–1.5 (1 is normal). */
  rate?: number;
  /** Exam simulator: question count, minutes and pass mark (defaults fill in what is missing). */
  exam?: Partial<ExamSettings>;
};

/**
 * Deck settings from the screen, checked: only known fields, in range. A field set to null or ''
 * is cleared (returned as undefined, which drops it when merged and saved).
 */
export function cleanDeckSettings(input: Record<string, unknown>): Partial<Record<keyof DeckSettings, unknown>> {
  const out: Partial<Record<keyof DeckSettings, unknown>> = {};
  if ('newPerDay' in input) {
    const n = Math.round(Number(input.newPerDay));
    if (Number.isFinite(n)) out.newPerDay = Math.max(0, Math.min(999, n));
  }
  if ('goal' in input) {
    const g = input.goal as Record<string, unknown> | null;
    const label = typeof g?.label === 'string' ? g.label.trim().slice(0, 100) : '';
    const words = Math.max(0, Math.min(1_000_000, Math.round(Number(g?.words)) || 0));
    out.goal = label
      ? { label, words, ...(typeof g?.tag === 'string' ? { tag: g.tag.slice(0, 100) } : {}) }
      : undefined;
  }
  if ('examDate' in input) {
    const v = input.examDate;
    const ok = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00`));
    out.examDate = ok ? v : undefined;
  }
  if ('voice' in input) {
    const v = typeof input.voice === 'string' ? input.voice.trim().slice(0, 300) : '';
    out.voice = v || undefined;
  }
  if ('rate' in input) {
    const n = input.rate === null || input.rate === '' ? NaN : Number(input.rate);
    out.rate = Number.isFinite(n) ? Math.round(Math.max(0.5, Math.min(1.5, n)) * 20) / 20 : undefined;
  }
  if ('exam' in input) out.exam = cleanExamSettings(input.exam);
  return out;
}

export type Deck = {
  id: number;
  name: string;
  language: string | null;
  description: string;
  settings: DeckSettings;
  createdAt: string;
};

/** The one shape every importer produces. Only `front` and `back` are required. */
export type NormalizedCard = {
  sourceId?: string | number; // stable id from the source (Anki note id, CSV row hash…) so re-imports update
  front: string;
  back: string;
  example?: string; // may contain <b>…</b> around the studied form, or {{c1::…}}
  exampleTranslation?: string;
  explanation?: string; // rule / longer explanation (shown in lessons and after answers)
  notes?: string;
  image?: string; // media file name
  /** Text alternative for the image (its alt text), for screen readers. Plain text; '' clears a stored one. */
  imageAlt?: string;
  audio?: string;
  video?: string; // mp4/webm/gif
  category?: string; // for category-sort rounds (e.g. "der"/"die"/"das", "IaaS"/"PaaS"/"SaaS")
  tags?: string[];
  subdeck?: string;
  group?: string; // lesson group, e.g. "G01" (taught together as a mini-lesson)
  rank?: number; // frequency rank / introduction order
  extra?: Record<string, string>;
  /** Card type: basic (default), cloze, mcq (choices + correct), order (steps), numeric (a number as the back). */
  type?: string;
  choices?: string; // "A|B|C|D"
  correct?: string; // "2|4" (1-based) or the correct choice texts
  steps?: string; // "first|second|third"
  altAnswers?: string; // "colour|color"
  tolerance?: string; // numeric cards: "0.05" (absolute) or "2%"
};

export const LANGUAGES: Record<string, string> = {
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  sv: 'Swedish',
  ru: 'Russian',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  te: 'Telugu',
  en: 'English',
};

const rowToDeck = (row: Row): Deck => rowToDeckTyped(row as unknown as DeckRow);
const rowToDeckTyped = (r: DeckRow): Deck => ({
  id: Number(r.id),
  name: r.name,
  language: r.language,
  description: r.description,
  settings: JSON.parse(r.settings),
  createdAt: r.created_at,
});

export function listDecks(d: DB = getDb()): Deck[] {
  return d.prepare('SELECT * FROM decks ORDER BY name').all().map(rowToDeck);
}
export function getDeck(id: number, d: DB = getDb()): Deck | null {
  const r = d.prepare('SELECT * FROM decks WHERE id = ?').get(id);
  return r ? rowToDeck(r) : null;
}
export function deckByName(name: string, d: DB = getDb()): Deck | null {
  const r = d.prepare('SELECT * FROM decks WHERE name = ?').get(name);
  return r ? rowToDeck(r) : null;
}

export function createDeck(
  name: string,
  language: string | null = null,
  settings: DeckSettings = {},
  description = '',
  d: DB = getDb(),
): Deck {
  const existing = deckByName(name, d);
  if (existing) return existing;
  d.prepare('INSERT INTO decks(name, language, description, settings, created_at) VALUES (?, ?, ?, ?, ?)').run(
    name,
    language || null,
    description,
    JSON.stringify({ newPerDay: 10, ...settings }),
    new Date().toISOString(),
  );
  const deck = deckByName(name, d)!;
  if (!getMeta(d, 'activeDeck', null)) setMeta(d, 'activeDeck', deck.id);
  return deck;
}

export function updateDeck(
  id: number,
  patch: Partial<Pick<Deck, 'name' | 'language' | 'description' | 'settings'>>,
  d: DB = getDb(),
): Deck {
  const cur = getDeck(id, d);
  if (!cur) throw new UserError('deck_not_found', 'Deck not found');
  const next = { ...cur, ...patch, settings: { ...cur.settings, ...(patch.settings ?? {}) } };
  d.prepare('UPDATE decks SET name = ?, language = ?, description = ?, settings = ? WHERE id = ?').run(
    next.name,
    next.language || null,
    next.description,
    JSON.stringify(next.settings),
    id,
  );
  return getDeck(id, d)!;
}

export function deleteDeck(id: number, d: DB = getDb()) {
  tx(d, () => {
    const ids = d
      .prepare('SELECT id FROM items WHERE deck_id = ?')
      .all(id)
      .map((r: Row) => r.id);
    for (const t of ['srs', 'item_state'])
      d.prepare(`DELETE FROM ${t} WHERE item_id IN (SELECT id FROM items WHERE deck_id = ?)`).run(id);
    d.prepare('DELETE FROM items WHERE deck_id = ?').run(id);
    d.prepare('DELETE FROM decks WHERE id = ?').run(id);
    return ids.length;
  });
  if (getMeta(d, 'activeDeck', null) === id) setMeta(d, 'activeDeck', listDecks(d)[0]?.id ?? null);
}

/** Stable 53-bit id from a string, so CSV/JSON re-imports update cards instead of duplicating them. */
export function stableId(s: string): number {
  return parseInt(sha1Hex(s).slice(0, 13), 16);
}

export function detectKind(
  front: string,
  back: string,
  tags: string[],
  language: string | null,
  c?: NormalizedCard,
): ItemKind {
  const t = (c?.type ?? '').toLowerCase();
  if (t === 'mcq' || t === 'multi' || t === 'choice' || c?.choices) return 'mcq';
  if (t === 'order' || t === 'sequence' || c?.steps) return 'order';
  if ((t === 'numeric' || t === 'number') && parseQuantity(back)) return 'numeric';
  if (/\{\{c\d+::/.test(front)) return 'cloze';
  if (tags.includes('grammar')) return 'grammar';
  if (!language) return 'card';
  if (tags.includes('number')) return 'number';
  if (tags.includes('phrase') || tags.includes('survival')) return 'phrase';
  if (language === 'de') {
    const { article, word } = splitArticle(front);
    if (article && /^[A-ZÄÖÜ]/.test(word)) return 'noun';
    if (/^to\s/i.test(back.trim()) && /^[a-zäöüß]+(en|n|ern|eln)$/.test(front.trim())) return 'verb';
  } else if (/^to\s/i.test(back.trim())) return 'verb';
  if (front.trim().split(/\s+/).length >= 3) return 'phrase';
  return 'word';
}

/** Store a media file in the library, keeping the name unless a different file already uses it. */
export function storeMedia(name: string, data: Uint8Array): string {
  const media = host().media;
  let file = basename(name).replace(/[^\w.\-() ]+/g, '_');
  const size = media.size(file);
  if (size !== null) {
    if (size === data.length) return file;
    file = `${sha1Hex(data).slice(0, 8)}-${file}`;
    if (media.size(file) !== null) return file;
  }
  media.write(file, data);
  return file;
}

export const MEDIA_TYPES = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.flac', '.weba'],
  video: ['.mp4', '.webm', '.mov', '.m4v'],
};
export const mediaKind = (f: string) => {
  const e = extname(f).toLowerCase();
  return MEDIA_TYPES.image.includes(e)
    ? 'image'
    : MEDIA_TYPES.audio.includes(e)
      ? 'audio'
      : MEDIA_TYPES.video.includes(e)
        ? 'video'
        : null;
};

const clean = (s: string | undefined) => sanitizeHtml(markdownLite(String(s ?? '').trim()));

/**
 * A card as it is stored and studied: formatting cleaned to the safe list, kind detected. The card
 * editor's preview uses this too, so what you see is what you get. Null for a card with no front.
 */
export function cardToItem(deck: Pick<Deck, 'id' | 'name' | 'language'>, c: NormalizedCard, id = 0): Item | null {
  const front = clean(c.front);
  const back = clean(c.back);
  if (!stripHtml(front) && !/\{\{c\d+::/.test(front)) return null;
  const tags = (c.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const kind = detectKind(stripHtml(front), stripHtml(back), tags, deck.language, c);
  const extra: Record<string, string> = { ...(c.extra ?? {}) };
  if (c.choices) extra.choices = sanitizeHtml(c.choices);
  if (c.correct) extra.correct = c.correct;
  if (c.steps) extra.steps = sanitizeHtml(c.steps);
  if (c.altAnswers) extra.alt = c.altAnswers;
  // The image description lives in extra (no migration); it goes when the image goes.
  const imageAlt = stripHtml(c.imageAlt ?? extra.imageAlt ?? '');
  if (imageAlt && c.image) extra.imageAlt = imageAlt;
  else delete extra.imageAlt;
  // Same for a numeric card's tolerance: kept only when the card is numeric and the value reads.
  const tolerance = (c.tolerance ?? extra.tolerance ?? '').trim();
  if (kind === 'numeric' && parseTolerance(tolerance)) extra.tolerance = tolerance;
  else delete extra.tolerance;
  const { article, word } = splitArticle(stripHtml(front));
  const example = clean(c.example);
  const isNoun = kind === 'noun';
  return {
    id,
    deckId: deck.id,
    lang: deck.language,
    deck: c.subdeck ?? deck.name,
    kind,
    target: kind === 'cloze' ? front : stripHtml(front),
    article: isNoun ? article : null,
    word: isNoun ? word : stripHtml(front),
    meaning: ['cloze', 'mcq', 'order'].includes(kind) ? back : stripHtml(back),
    sentenceHtml: example,
    sentence: stripHtml(example),
    sentenceMeaning: stripHtml(c.exampleTranslation ?? ''),
    grammar: clean(c.explanation),
    notes: clean(c.notes),
    audio: c.audio || null,
    image: c.image || null,
    video: c.video || null,
    category: (c.category ?? (isNoun ? article : null)) || null,
    rank: c.rank ?? 0,
    tags,
    group: c.group || null,
    extra,
  };
}

/** Why a card in an import was not saved. Each code has a message under errors.<code> in the language files. */
export type SkipCode = 'row_no_front' | 'row_duplicate' | 'row_invalid';
/** `index` is the card's position in the list given to upsertCards (0-based). */
export type UpsertResult = {
  deck: Deck;
  added: number;
  updated: number;
  total: number;
  skipped: { index: number; code: SkipCode }[];
};

/** Insert or update cards in a deck. Progress (srs/item_state) is untouched for existing cards. */
export function upsertCards(deck: Deck, cards: NormalizedCard[], d: DB = getDb()): UpsertResult {
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  const skipped: UpsertResult['skipped'] = [];
  const seen = new Set<number>();
  const maxOrd = Number(d.prepare('SELECT COALESCE(MAX(ord), -1) AS n FROM items WHERE deck_id = ?').get(deck.id)!.n);
  const ranked = cards.map((c, i) => ({ c, i })).sort((a, b) => (a.c.rank || 1e9) - (b.c.rank || 1e9) || a.i - b.i);
  tx(d, () => {
    const exists = d.prepare('SELECT ord FROM items WHERE id = ?');
    const inDeck = d.prepare('SELECT 1 FROM items WHERE id = ? AND deck_id = ?');
    const up = d.prepare(`
      INSERT INTO items (id, deck_id, deck, kind, target, article, word, meaning, sentence_html, sentence, sentence_meaning,
        grammar, notes, audio, image, video, category, rank, tags, grp, ord, extra, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET deck_id=excluded.deck_id, deck=excluded.deck, kind=excluded.kind, target=excluded.target,
        article=excluded.article, word=excluded.word, meaning=excluded.meaning, sentence_html=excluded.sentence_html,
        sentence=excluded.sentence, sentence_meaning=excluded.sentence_meaning, grammar=excluded.grammar, notes=excluded.notes,
        audio=excluded.audio, image=excluded.image, video=excluded.video, category=excluded.category, rank=excluded.rank,
        tags=excluded.tags, grp=excluded.grp, extra=excluded.extra, updated_at=excluded.updated_at`);
    ranked.forEach(({ c, i: index }, i) => {
      const item = cardToItem(deck, c);
      if (!item) return skipped.push({ index, code: 'row_no_front' });
      // An exported card carries its own id as text: back in the same deck, it updates that card.
      const own = typeof c.sourceId === 'string' && /^\d{1,16}$/.test(c.sourceId) ? Number(c.sourceId) : NaN;
      const id =
        typeof c.sourceId === 'number'
          ? c.sourceId
          : Number.isSafeInteger(own) && inDeck.get(own, deck.id)
            ? own
            : stableId(`${deck.name}\u0000${c.sourceId ?? `${clean(c.front)}\u0000${clean(c.back)}`}`);
      if (seen.has(id)) return skipped.push({ index, code: 'row_duplicate' });
      seen.add(id);
      const prev = exists.get(id);
      prev ? updated++ : added++;
      up.run(
        id,
        deck.id,
        item.deck,
        item.kind,
        item.target,
        item.article,
        item.word,
        item.meaning,
        item.sentenceHtml,
        item.sentence,
        item.sentenceMeaning,
        item.grammar,
        item.notes,
        item.audio,
        item.image,
        item.video,
        item.category,
        item.rank,
        JSON.stringify(item.tags),
        item.group,
        prev ? Number(prev.ord) : maxOrd + 1 + i,
        JSON.stringify(item.extra),
        now,
      );
    });
  });
  const total = Number(d.prepare('SELECT COUNT(*) AS n FROM items WHERE deck_id = ?').get(deck.id)!.n);
  skipped.sort((a, b) => a.index - b.index);
  return { deck, added, updated, total, skipped };
}

export function readMedia(file: string): Uint8Array | null {
  return host().media.read(basename(file));
}
