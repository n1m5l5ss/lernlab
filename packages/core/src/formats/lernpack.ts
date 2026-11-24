// The open LernLab deck format (.lernpack): a zip with manifest.json, cards.csv (or cards.jsonl)
// and media/ (any subfolders, e.g. media/images, media/audio, media/video).
import { strFromU8, strToU8, zipSync, type Zippable } from 'fflate';
import { basename } from '../paths';
import { mediaKind, type DeckSettings, type NormalizedCard } from '../library';
import { cardsToCsv, csvToCards } from './csv';
import { UserError } from '../errors';
import { jsonToCard, parseJson } from './json';
import { listZip, readZip } from './zip';

export const LERNPACK_VERSION = 1;

export type Manifest = {
  format: 'lernpack';
  version: number;
  deck: { name: string; language?: string | null; description?: string; goal?: DeckSettings['goal']; maps?: string };
  cards: number;
  created: string;
  generator: string;
};

/** Media is read separately with lernpackMedia. `lines` gives the line in the cards file each card comes from; `invalid` lists lines that could not be read. */
export type Pack = {
  manifest: Manifest;
  cards: NormalizedCard[];
  lines: number[];
  invalid: number[];
};

export function readLernpack(buf: Uint8Array): Pack {
  const names = listZip(buf).map((e) => e.name);
  const root = names.find((f) => f.endsWith('manifest.json'))?.replace(/manifest\.json$/, '') ?? '';
  const cardFiles = ['cards.jsonl', 'cards.json', 'cards.csv', 'cards.tsv'].map((f) => root + f);
  const files = readZip(buf, (n) => n === `${root}manifest.json` || cardFiles.includes(n));
  const mf = files[`${root}manifest.json`];
  if (!mf) throw new UserError('not_lernpack', 'Not a .lernpack file (manifest.json missing)');
  const manifest = parseJson(strFromU8(mf)) as Manifest | undefined;
  if (manifest?.format !== 'lernpack') throw new UserError('not_lernpack', 'manifest.json is not a lernpack manifest');
  // No `deck` at all is fine (the deck is named after the file); a `deck` that is not an object is not a manifest.
  const raw: unknown = manifest.deck ?? {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new UserError('not_lernpack', 'manifest.json has no valid deck');
  const g = raw as Partial<Record<keyof Manifest['deck'], unknown>>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  manifest.deck = {
    name: str(g.name) ?? '',
    language: str(g.language) ?? null,
    description: str(g.description),
    goal: g.goal && typeof g.goal === 'object' ? (g.goal as Manifest['deck']['goal']) : undefined,
    maps: str(g.maps), // cleaned where the deck is made (importer.ts)
  };
  if (manifest.version > LERNPACK_VERSION)
    throw new UserError('lernpack_too_new', `This deck needs a newer LernLab (format v${manifest.version})`, {
      version: manifest.version,
    });
  const [jsonl, json, csv, tsv] = cardFiles.map((f) => files[f]);
  const cards: NormalizedCard[] = [];
  const lines: number[] = [];
  const invalid: number[] = [];
  if (jsonl || json) {
    const rows = jsonl
      ? strFromU8(jsonl)
          .split('\n')
          .map((l, i) => [l, i + 1] as const)
          .filter(([l]) => l.trim())
          .map(([l, line]) => [parseJson(l), line] as const)
      : ((parsed) => (Array.isArray(parsed) ? parsed.map((c, i) => [c, i + 1] as const) : []))(
          parseJson(strFromU8(json)),
        );
    for (const [raw, line] of rows) {
      const card = jsonToCard(raw);
      if (card) {
        cards.push(card);
        lines.push(line);
      } else invalid.push(line);
    }
  } else if (csv || tsv) {
    const parsed = csvToCards(strFromU8(csv ?? tsv));
    cards.push(...parsed.cards);
    lines.push(...parsed.lines);
  } else throw new UserError('lernpack_no_cards', 'Deck package has no cards file (expected cards.csv or cards.jsonl)');
  return { manifest, cards, lines, invalid };
}

/** The media files of a deck package, by file name. Only names `want` accepts are unpacked. */
export function lernpackMedia(buf: Uint8Array, want: (file: string) => boolean): Record<string, Uint8Array> {
  const names = listZip(buf).map((e) => e.name);
  const root = names.find((f) => f.endsWith('manifest.json'))?.replace(/manifest\.json$/, '') ?? '';
  const files = readZip(buf, (n) => n.startsWith(`${root}media/`) && want(basename(n)));
  return Object.fromEntries(Object.entries(files).map(([n, data]) => [basename(n), data]));
}

/** The folder under media/ a file is written to, by its kind. Unknown kinds stay in media/ itself. */
const MEDIA_FOLDERS = { image: 'images/', audio: 'audio/', video: 'video/' } as const;

/**
 * Write a deck package: manifest.json, the cards twice (cards.jsonl, lossless, and cards.csv for
 * spreadsheets) and the media files sorted into media/images, media/audio and media/video.
 * `media` is keyed by file name; cards that use a file point at it by its path inside media/.
 */
export function writeLernpack(
  manifest: Omit<Manifest, 'format' | 'version' | 'cards' | 'created'>,
  cards: NormalizedCard[],
  media: Record<string, Uint8Array>,
): Uint8Array {
  const full: Manifest = {
    format: 'lernpack',
    version: LERNPACK_VERSION,
    cards: cards.length,
    created: new Date().toISOString(),
    ...manifest,
  };
  const path = (name: string) => {
    const kind = mediaKind(name);
    return kind ? MEDIA_FOLDERS[kind] + name : name;
  };
  const at = (v: string | undefined) => (v && media[v] ? path(v) : v);
  const packed = cards.map((c) => ({ ...c, image: at(c.image), audio: at(c.audio), video: at(c.video) }));
  const files: Zippable = {
    'manifest.json': strToU8(JSON.stringify(full, null, 2)),
    'cards.jsonl': strToU8(
      packed.map(({ sourceId, ...c }) => JSON.stringify({ id: String(sourceId ?? ''), ...c })).join('\n') + '\n',
    ),
    'cards.csv': strToU8(cardsToCsv(packed)),
  };
  for (const [name, data] of Object.entries(media)) files[`media/${path(name)}`] = [data, { level: 0 }];
  return zipSync(files, { level: 6 });
}
