// Decks and cards: create, update, import (any format → NormalizedCard), export.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { getDb, getMeta, mediaDir, setMeta, tx, type DB } from './db';
import { stripHtml, splitArticle } from '../shared/text';
import { markdownLite, sanitizeHtml } from '../shared/cards';
import type { ItemKind } from '../shared/types';

export type DeckSettings = {
  newPerDay?: number;
  goal?: { label: string; words: number; hoursLow?: number; hoursHigh?: number; tag?: string };
  ankiSource?: string;
};

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
  audio?: string;
  video?: string; // mp4/webm/gif
  category?: string; // for category-sort rounds (e.g. "der"/"die"/"das", "IaaS"/"PaaS"/"SaaS")
  tags?: string[];
  subdeck?: string;
  group?: string; // lesson group, e.g. "G01" (taught together as a mini-lesson)
  rank?: number; // frequency rank / introduction order
  extra?: Record<string, string>;
  /** Card type: basic (default), cloze, mcq (choices + correct), order (steps). */
  type?: string;
  choices?: string; // "A|B|C|D"
  correct?: string; // "2|4" (1-based) or the correct choice texts
  steps?: string; // "first|second|third"
  altAnswers?: string; // "colour|color"
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

const rowToDeck = (r: any): Deck => ({
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
  if (!cur) throw new Error('Deck not found');
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
      .map((r: any) => r.id);
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
  return parseInt(createHash('sha1').update(s).digest('hex').slice(0, 13), 16);
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
export function storeMedia(name: string, data: Buffer): string {
  let file = basename(name).replace(/[^\w.\-() ]+/g, '_');
  const dest = () => resolve(mediaDir(), file);
  if (existsSync(dest())) {
    if (statSync(dest()).size === data.length) return file;
    file = `${createHash('sha1').update(data).digest('hex').slice(0, 8)}-${file}`;
    if (existsSync(dest())) return file;
  }
  writeFileSync(dest(), data);
  return file;
}

export const MEDIA_TYPES = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.flac'],
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

export type UpsertResult = { deck: Deck; added: number; updated: number; total: number };

/** Insert or update cards in a deck. Progress (srs/item_state) is untouched for existing cards. */
export function upsertCards(deck: Deck, cards: NormalizedCard[], d: DB = getDb()): UpsertResult {
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  const maxOrd = Number(d.prepare('SELECT COALESCE(MAX(ord), -1) AS n FROM items WHERE deck_id = ?').get(deck.id).n);
  const ranked = cards.map((c, i) => ({ c, i })).sort((a, b) => (a.c.rank || 1e9) - (b.c.rank || 1e9) || a.i - b.i);
  tx(d, () => {
    const exists = d.prepare('SELECT ord FROM items WHERE id = ?');
    const up = d.prepare(`
      INSERT INTO items (id, deck_id, deck, kind, target, article, word, meaning, sentence_html, sentence, sentence_meaning,
        grammar, notes, audio, image, video, category, rank, tags, grp, ord, extra, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET deck_id=excluded.deck_id, deck=excluded.deck, kind=excluded.kind, target=excluded.target,
        article=excluded.article, word=excluded.word, meaning=excluded.meaning, sentence_html=excluded.sentence_html,
        sentence=excluded.sentence, sentence_meaning=excluded.sentence_meaning, grammar=excluded.grammar, notes=excluded.notes,
        audio=excluded.audio, image=excluded.image, video=excluded.video, category=excluded.category, rank=excluded.rank,
        tags=excluded.tags, grp=excluded.grp, extra=excluded.extra, updated_at=excluded.updated_at`);
    ranked.forEach(({ c }, i) => {
      const front = clean(c.front);
      const back = clean(c.back);
      if (!stripHtml(front) && !/\{\{c\d+::/.test(front)) return;
      const tags = (c.tags ?? []).map((t) => t.trim()).filter(Boolean);
      const kind = detectKind(stripHtml(front), stripHtml(back), tags, deck.language, c);
      const extra: Record<string, string> = { ...(c.extra ?? {}) };
      if (c.choices) extra.choices = c.choices;
      if (c.correct) extra.correct = c.correct;
      if (c.steps) extra.steps = c.steps;
      if (c.altAnswers) extra.alt = c.altAnswers;
      const { article, word } = splitArticle(stripHtml(front));
      const id =
        typeof c.sourceId === 'number'
          ? c.sourceId
          : stableId(`${deck.name}\u0000${c.sourceId ?? `${front}\u0000${back}`}`);
      const prev = exists.get(id);
      prev ? updated++ : added++;
      const example = clean(c.example);
      const isNoun = kind === 'noun';
      up.run(
        id,
        deck.id,
        c.subdeck ?? deck.name,
        kind,
        kind === 'cloze' ? front : stripHtml(front),
        isNoun ? article : null,
        isNoun ? word : stripHtml(front),
        ['cloze', 'mcq', 'order'].includes(kind) ? back : stripHtml(back),
        example,
        stripHtml(example),
        stripHtml(c.exampleTranslation ?? ''),
        clean(c.explanation),
        clean(c.notes),
        c.audio || null,
        c.image || null,
        c.video || null,
        (c.category ?? (isNoun ? article : null)) || null,
        c.rank ?? 0,
        JSON.stringify(tags),
        c.group || null,
        prev ? Number(prev.ord) : maxOrd + 1 + i,
        JSON.stringify(extra),
        now,
      );
    });
  });
  const total = Number(d.prepare('SELECT COUNT(*) AS n FROM items WHERE deck_id = ?').get(deck.id).n);
  return { deck, added, updated, total };
}

export function deckCounts(d: DB = getDb()) {
  const rows = d
    .prepare(
      `
    SELECT i.deck_id AS id, COUNT(*) AS cards,
      SUM(CASE WHEN s.item_id IS NULL THEN 1 ELSE 0 END) AS fresh,
      SUM(CASE WHEN st.mastery >= 3 THEN 1 ELSE 0 END) AS learned
    FROM items i LEFT JOIN srs s ON s.item_id = i.id LEFT JOIN item_state st ON st.item_id = i.id
    WHERE i.suspended = 0 GROUP BY i.deck_id`,
    )
    .all();
  return Object.fromEntries(
    rows.map((r: any) => [
      Number(r.id),
      { cards: Number(r.cards), fresh: Number(r.fresh), learned: Number(r.learned) },
    ]),
  );
}

export function readMedia(file: string): Buffer | null {
  const p = resolve(mediaDir(), basename(file));
  return existsSync(p) ? readFileSync(p) : null;
}
