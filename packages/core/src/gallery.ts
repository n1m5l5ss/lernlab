// The deck gallery's index (docs/GALLERY.md): parsing and checking an untrusted index.json, and search.
// Pure: the download itself happens in the data process (apps/desktop/backend/gallery.ts).

/** Where the app reads the gallery from, only when the user opens it (principle 4). One place to change it. */
export const GALLERY_INDEX_URL = 'https://raw.githubusercontent.com/n1m5l5ss/lernlab-decks/main/index.json';

/** WHATWG URL. Every target has it; it is typed here so core needs neither DOM nor Node types. */
type WebUrl = { href: string; origin: string; protocol: string; hostname: string; username: string };
const WebURL = (globalThis as unknown as { URL: new (url: string, base?: string | WebUrl) => WebUrl }).URL;

export const GALLERY_LIMITS = {
  /** index.json itself. */
  indexBytes: 2 * 1024 * 1024,
  /** Decks listed in one index. */
  decks: 5000,
  /** One deck file. */
  deckBytes: 200 * 1024 * 1024,
  indexTimeoutMs: 15_000,
  deckTimeoutMs: 120_000,
};

/** One deck in the gallery, after checking. `url` is absolute. */
export type GalleryDeck = {
  id: string;
  title: string;
  description: string;
  /** Language code of the cards' front side, or null for any other subject. */
  language: string | null;
  cards: number;
  /** SPDX licence id or expression, e.g. CC-BY-4.0. */
  licence: string;
  author: string;
  url: string;
  sha256: string;
  size: number;
  tags: string[];
};

export type GalleryIndex = {
  updated: string | null;
  decks: GalleryDeck[];
  rejected: { index: number; reason: string }[];
};

export class GalleryIndexError extends Error {}

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** An SPDX id or expression: CC-BY-4.0, CC0-1.0, MIT OR CC-BY-SA-4.0, LicenseRef-…. */
const SPDX = /^\(?[A-Za-z0-9.+-]+\)?( (AND|OR|WITH) \(?[A-Za-z0-9.+-]+\)?)*$/;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
/** Hosts a deck file may come from besides the index's own: GitHub, where the gallery repo lives. */
const GITHUB_HOSTS = /^(github\.com|raw\.githubusercontent\.com|objects\.githubusercontent\.com)$/;

/** https anywhere; plain http only on this computer (a test or dev index). */
export const isGalleryUrl = (url: WebUrl) =>
  url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.has(url.hostname));

const text = (v: unknown, max: number, field: string, required = true): string => {
  if (v === undefined && !required) return '';
  if (typeof v !== 'string' || (required && !v.trim()) || v.length > max) throw new Error(field);
  return v.trim();
};

/** One entry, checked. Throws an Error named after the bad field. */
function checkDeck(raw: unknown, base: WebUrl): GalleryDeck {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('entry');
  const e = raw as Record<string, unknown>;
  const id = text(e.id, 80, 'id');
  if (!ID.test(id)) throw new Error('id');
  const language = e.language === null || e.language === undefined ? null : text(e.language, 20, 'language');
  if (language !== null && !LANGUAGE.test(language)) throw new Error('language');
  const licence = text(e.licence, 100, 'licence');
  if (!SPDX.test(licence)) throw new Error('licence');
  const sha256 = text(e.sha256, 64, 'sha256').toLowerCase();
  if (!SHA256.test(sha256)) throw new Error('sha256');
  const count = (v: unknown, max: number, field: string) => {
    if (!Number.isSafeInteger(v) || (v as number) < 1 || (v as number) > max) throw new Error(field);
    return v as number;
  };
  let url: WebUrl;
  try {
    url = new WebURL(text(e.url, 2000, 'url'), base);
  } catch {
    throw new Error('url');
  }
  // Deck files come from the index's own site or from GitHub, never from anywhere else.
  if (!isGalleryUrl(url) || (url.origin !== base.origin && !GITHUB_HOSTS.test(url.hostname)) || url.username)
    throw new Error('url');
  const tags = Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === 'string').slice(0, 20) : [];
  return {
    id,
    title: text(e.title, 200, 'title'),
    description: text(e.description, 2000, 'description', false),
    language,
    cards: count(e.cards, 100_000, 'cards'),
    licence,
    author: text(e.author, 200, 'author'),
    url: url.href,
    sha256,
    size: count(e.size, GALLERY_LIMITS.deckBytes, 'size'),
    tags: tags.map((t) => t.slice(0, 50)),
  };
}

/**
 * Read an index.json the app downloaded from `indexUrl`. The whole index is refused if it is not a
 * gallery index of a version this app knows; a single bad entry is left out and listed in `rejected`.
 */
export function parseGalleryIndex(json: string, indexUrl: string): GalleryIndex {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new GalleryIndexError('index.json is not valid JSON');
  }
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.format !== 'lernlab-gallery' || !Array.isArray(o.decks))
    throw new GalleryIndexError('not a LernLab gallery index');
  if (o.version !== 1) throw new GalleryIndexError(`unknown index version ${String(o.version)}`);
  const base = new WebURL(indexUrl);
  const decks: GalleryDeck[] = [];
  const rejected: GalleryIndex['rejected'] = [];
  const seen = new Set<string>();
  for (const [index, entry] of o.decks.slice(0, GALLERY_LIMITS.decks).entries()) {
    try {
      const deck = checkDeck(entry, base);
      if (seen.has(deck.id)) throw new Error('duplicate id');
      seen.add(deck.id);
      decks.push(deck);
    } catch (e) {
      rejected.push({ index, reason: (e as Error).message });
    }
  }
  return { updated: typeof o.updated === 'string' ? o.updated.slice(0, 40) : null, decks, rejected };
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** Decks whose title, description, author, language or tags contain every word of the query. */
export function searchGallery(decks: GalleryDeck[], query: string): GalleryDeck[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return decks;
  return decks.filter((d) => {
    const hay = fold([d.title, d.description, d.author, d.language ?? '', ...d.tags].join(' '));
    return words.every((w) => hay.includes(w));
  });
}
