// Concept map from memory (#219): for a topic that has an author's map, the learner links its terms from
// memory ("Mitochondrion --makes--> ATP"), then compares with the author's map: the links they matched, the
// ones they missed and the ones only they drew. Building a map helps more than studying a finished one,
// g = 0.72 versus 0.43 [Schroeder et al. 2018]; plain retrieval practice still beat concept mapping
// [Karpicke & Blunt 2011], so this is optional practice: nothing here is saved, graded, scheduled or timed.
// The author's maps live on the deck as one block of plain text (deck setting `maps`, no migration):
//
//   # Cell energy
//   Mitochondrion --makes--> ATP
//   Glucose --is broken down in--> Mitochondrion
//
// Deck files are untrusted: every term and label is plain text, and sizes are capped.
import { stripHtml } from './text';

/** Caps: maps per deck, links and terms per map, and the length of a topic, a term and a label. */
export const MAPS_MAX = 20;
export const MAP_LINKS_MAX = 30;
export const MAP_TERMS_MAX = 16;
export const MAP_TEXT_MAX_LENGTH = 6000;
export const MAP_TOPIC_MAX_LENGTH = 80;
export const MAP_TERM_MAX_LENGTH = 60;
export const MAP_LABEL_MAX_LENGTH = 40;

export type MapLink = { from: string; label: string; to: string };
export type ConceptMap = { topic: string; links: MapLink[] };

/** Plain text on one line that stays the same when read again; none of the characters the format itself uses. */
function plain(text: string, max: number): string {
  let s = stripHtml(text);
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  s = s
    .replace(/-{2,}>?/g, '-')
    .replace(/[#<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, max).trim();
}
const key = (s: string) => s.toLowerCase();
const same = (a: string, b: string) => key(a) === key(b);

/** One link as written: `A --label--> B`, or `A --> B` for a link without a label. Null when it does not read. */
export function parseLink(line: string): MapLink | null {
  const m = /^(.*?)--(?:(.*?)--)?>(.*)$/.exec(line);
  if (!m) return null;
  const from = plain(m[1], MAP_TERM_MAX_LENGTH);
  const to = plain(m[3], MAP_TERM_MAX_LENGTH);
  if (!from || !to || same(from, to)) return null;
  return { from, label: plain(m[2] ?? '', MAP_LABEL_MAX_LENGTH), to };
}

export const formatLink = (l: MapLink): string =>
  l.label ? `${l.from} --${l.label}--> ${l.to}` : `${l.from} --> ${l.to}`;

/** The terms of a map, in the order they first appear. */
export function termsOf(links: MapLink[]): string[] {
  const seen = new Map<string, string>();
  for (const l of links) for (const t of [l.from, l.to]) if (!seen.has(key(t))) seen.set(key(t), t);
  return [...seen.values()];
}

/**
 * Read the maps of a deck: `# topic` starts a map, each following line is a link. Lines that do not read are
 * skipped, a term is spelled as it was first written, two terms are linked once, and a map
 * needs at least two links to be worth drawing. Everything is capped.
 */
export function parseMaps(text: string | undefined): ConceptMap[] {
  if (!text || typeof text !== 'string') return [];
  const maps: ConceptMap[] = [];
  let cur: (ConceptMap & { terms: Map<string, string>; pairs: Set<string> }) | null = null;
  for (const raw of text.slice(0, MAP_TEXT_MAX_LENGTH).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      const topic = plain(line.replace(/^#+/, ''), MAP_TOPIC_MAX_LENGTH);
      cur = null;
      if (!topic || maps.some((m) => same(m.topic, topic)) || maps.length >= MAPS_MAX) continue;
      cur = { topic, links: [], terms: new Map(), pairs: new Set() };
      maps.push(cur);
      continue;
    }
    const link = cur && cur.links.length < MAP_LINKS_MAX ? parseLink(line) : null;
    if (!cur || !link) continue;
    const fresh = [link.from, link.to].filter((t) => !cur!.terms.has(key(t)));
    if (cur.terms.size + fresh.length > MAP_TERMS_MAX) continue;
    for (const t of fresh) cur.terms.set(key(t), t);
    const from = cur.terms.get(key(link.from))!;
    const to = cur.terms.get(key(link.to))!;
    const pair = [key(from), key(to)].sort().join('\n');
    if (cur.pairs.has(pair)) continue;
    cur.pairs.add(pair);
    cur.links.push({ from, label: link.label, to });
  }
  return maps.filter((m) => m.links.length >= 2).map(({ topic, links }) => ({ topic, links }));
}

/** The maps in their one canonical form (it reads back to itself); '' when there is none. */
export const cleanMaps = (text: string | undefined): string =>
  parseMaps(text)
    .map((m) => [`# ${m.topic}`, ...m.links.map(formatLink)].join('\n'))
    .join('\n\n');

export type MapComparison = {
  /** Links both maps have (in either direction), with the learner's and the author's words for them. */
  matched: { from: string; to: string; yours: string; authors: string; reversed: boolean }[];
  /** Links only the author's map has. */
  missing: MapLink[];
  /** Links only the learner drew. They are not wrong: the author's map just does not have them. */
  extra: MapLink[];
};

/**
 * Compare the learner's links with the author's. A link matches when it joins the same two terms; the labels
 * are shown next to each other for the learner to judge, never marked right or wrong (words differ).
 */
export function compareMaps(yours: MapLink[], authors: MapLink[]): MapComparison {
  const pair = (l: MapLink) => [key(l.from), key(l.to)].sort().join('\n');
  const mine = new Map<string, MapLink>();
  for (const l of yours) if (!mine.has(pair(l))) mine.set(pair(l), l);
  const out: MapComparison = { matched: [], missing: [], extra: [] };
  const found = new Set<string>();
  for (const a of authors) {
    const y = mine.get(pair(a));
    if (!y || found.has(pair(a))) {
      if (!y) out.missing.push(a);
      continue;
    }
    found.add(pair(a));
    out.matched.push({ from: a.from, to: a.to, yours: y.label, authors: a.label, reversed: !same(y.from, a.from) });
  }
  for (const [p, l] of mine) if (!found.has(p)) out.extra.push(l);
  return out;
}

/**
 * Add a link to the learner's map. 'same' when both ends are one term, 'linked' when the two terms are already
 * linked (in either direction): the list stays as it is and the screen says why.
 */
export function addLink(links: MapLink[], from: string, label: string, to: string): MapLink[] | 'same' | 'linked' {
  if (!from || !to || same(from, to)) return 'same';
  if (links.some((l) => (same(l.from, from) && same(l.to, to)) || (same(l.from, to) && same(l.to, from))))
    return 'linked';
  if (links.length >= MAP_LINKS_MAX) return links;
  return [...links, { from, label: plain(label, MAP_LABEL_MAX_LENGTH), to }];
}

export type MapPoint = { term: string; x: number; y: number };
/** Where each term sits in a picture `width` × `height`: evenly on an ellipse, the first term at the top. */
export function layoutTerms(terms: string[], width = 360, height = 260): MapPoint[] {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const [cx, cy, rx, ry] = [width / 2, height / 2, width / 2 - 70, height / 2 - 28];
  return terms.map((term, i) => {
    const a = (2 * Math.PI * i) / Math.max(terms.length, 1) - Math.PI / 2;
    return { term, x: r1(cx + rx * Math.cos(a)), y: r1(cy + ry * Math.sin(a)) };
  });
}

export type MapTopic = { deckId: number; deckName: string; topic: string; terms: number; links: number };

type DeckWithMaps = { id: number; name: string; settings: { maps?: string } };

/** Every topic with an author's map, over the given decks, in their order. */
export function mapTopics(decks: DeckWithMaps[]): MapTopic[] {
  return decks.flatMap((deck) =>
    deck.settings.maps
      ? parseMaps(deck.settings.maps).map((m) => ({
          deckId: deck.id,
          deckName: deck.name,
          topic: m.topic,
          terms: termsOf(m.links).length,
          links: m.links.length,
        }))
      : [],
  );
}

/**
 * One topic to draw from memory: its terms in alphabetical order (the author's order would give links away)
 * and the author's links to compare with afterwards. Null when the deck has no such map.
 */
export function mapFor(
  deck: DeckWithMaps | null | undefined,
  topic: string,
): { topic: string; terms: string[]; links: MapLink[] } | null {
  const map = parseMaps(deck?.settings.maps).find((m) => same(m.topic, topic.trim()));
  if (!map) return null;
  return { topic: map.topic, terms: termsOf(map.links).sort((a, b) => a.localeCompare(b)), links: map.links };
}
