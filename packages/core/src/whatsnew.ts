// "What's new" after an update (issue #58, docs/RELEASING.md). The notes come from CHANGELOG.md at build time
// (scripts/whats-new.ts, bundled, offline) or from the GitHub Release of a downloaded update. Only the item
// text comes from there; every other word on the panel is in the language files.
import { getMeta, setMeta, type DB } from './db';

/** At most this many New and this many Fixed items, so the panel stays short. */
export const MAX_ITEMS = 5;

export type ReleaseNotes = { version: string; added: string[]; fixed: string[] };
type Items = Pick<ReleaseNotes, 'added' | 'fixed'>;

const ADDED = /^(added|new|features?)$/i;
const FIXED = /^(fixed|bug ?fixes)$/i;

/** One changelog line as plain words: no commit links, "closes #N", markup or trailing spaces. */
export function cleanItem(raw: string): string {
  const text = raw
    .replace(/,?\s*closes\s+\[?#\d.*$/i, '')
    .replace(/\s*\(\s*\[?[0-9a-f]{7,40}\]?(\([^)]*\))?\s*\)\s*$/i, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const add = (items: string[], raw: string) => {
  const item = cleanItem(raw);
  if (item && items.length < MAX_ITEMS && !items.includes(item)) items.push(item);
};

/** The newest released section of a Keep a Changelog / release-please CHANGELOG.md, or null. */
export function notesFromChangelog(md: string): ReleaseNotes | null {
  let notes: ReleaseNotes | null = null;
  let list: string[] | null = null;
  for (const line of md.split(/\r?\n/)) {
    const release = /^##\s+\[?v?(\d+\.\d+\.\d+[^\]\s)]*)/.exec(line);
    if (release) {
      if (notes) break;
      notes = { version: release[1], added: [], fixed: [] };
      list = null;
    } else if (/^##\s/.test(line)) {
      if (notes) break; // "## [Unreleased]" after a release, or another top-level heading
    } else if (notes && /^###\s/.test(line)) {
      const name = line.replace(/^###\s+/, '').trim();
      list = ADDED.test(name) ? notes.added : FIXED.test(name) ? notes.fixed : null;
    } else if (list) {
      const item = /^[*-]\s+(.*)$/.exec(line);
      if (item) add(list, item[1]);
    }
  }
  return notes;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
/** Tags removed and the common entities decoded: the result is only ever shown as text, never as HTML. */
const htmlText = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&(#39|amp|lt|gt|quot|apos|nbsp);/g, (_, e: string) => ENTITIES[e] ?? '');

/** New and Fixed items from a GitHub Release body, as electron-updater gives it (HTML). */
export function notesFromReleaseHtml(html: string | null | undefined): Items {
  const out: Items = { added: [], fixed: [] };
  let list: string[] | null = null;
  for (const m of (html ?? '').matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    if (m[1] !== undefined) {
      const name = htmlText(m[1]).trim();
      list = ADDED.test(name) ? out.added : FIXED.test(name) ? out.fixed : null;
    } else if (list) add(list, htmlText(m[2]));
  }
  return out;
}

/** -1, 0 or 1. Numeric parts compare as numbers; a pre-release (1.0.0-beta.2) comes before its release. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [main, pre] = v.replace(/^v/, '').split('-', 2);
    return { main: main.split('.').map((n) => Number(n) || 0), pre: pre ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.main[i] ?? 0) - (y.main[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  const p = x.pre.split('.');
  const q = y.pre.split('.');
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    if (p[i] === undefined) return -1;
    if (q[i] === undefined) return 1;
    const [m, n] = [Number(p[i]), Number(q[i])];
    const d = Number.isNaN(m) || Number.isNaN(n) ? p[i].localeCompare(q[i]) : m - n;
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * The notes to show on this launch, or null. Only after moving to a newer version, only for notes newer than
 * what was seen, and never to a brand-new user. Someone who used the app before this was saved sees them once.
 */
export function whatsNewToShow(o: {
  current: string;
  lastSeen: string | null;
  isNewUser: boolean;
  notes: ReleaseNotes | null;
}): ReleaseNotes | null {
  const { current, lastSeen, isNewUser, notes } = o;
  if (!notes || notes.added.length + notes.fixed.length === 0) return null;
  if (lastSeen === null && isNewUser) return null;
  if (compareVersions(notes.version, current) > 0) return null;
  if (lastSeen !== null && compareVersions(notes.version, lastSeen) <= 0) return null;
  return notes;
}

const KEY = 'lastSeenVersion';
/** The version whose "What's new" was last dismissed (or that a new user started on). Kept in `meta`. */
export const lastSeenVersion = (d: DB): string | null => getMeta<string | null>(d, KEY, null);
export const markVersionSeen = (d: DB, version: string) => setMeta(d, KEY, version);
