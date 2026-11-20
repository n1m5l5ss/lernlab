// The open LernLab deck format (.lernpack): a zip with manifest.json, cards.csv (or cards.jsonl)
// and media/ (any subfolders, e.g. media/images, media/audio, media/video).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { basename } from 'node:path';
import type { DeckSettings, NormalizedCard } from '../library';
import { csvToCards } from './csv';

export const LERNPACK_VERSION = 1;

export type Manifest = {
  format: 'lernpack';
  version: number;
  deck: { name: string; language?: string | null; description?: string; goal?: DeckSettings['goal'] };
  cards: number;
  created: string;
  generator: string;
};

export type Pack = { manifest: Manifest; cards: NormalizedCard[]; media: Record<string, Uint8Array> };

export function readLernpack(buf: Uint8Array): Pack {
  const files = unzipSync(buf);
  const root =
    Object.keys(files)
      .find((f) => f.endsWith('manifest.json'))
      ?.replace(/manifest\.json$/, '') ?? '';
  const mf = files[`${root}manifest.json`];
  if (!mf) throw new Error('Not a .lernpack file (manifest.json missing)');
  const manifest = JSON.parse(strFromU8(mf)) as Manifest;
  if (manifest.format !== 'lernpack') throw new Error('manifest.json is not a lernpack manifest');
  if (manifest.version > LERNPACK_VERSION)
    throw new Error(`This deck needs a newer LernLab (format v${manifest.version})`);
  const jsonl = files[`${root}cards.jsonl`];
  const json = files[`${root}cards.json`];
  const csv = files[`${root}cards.csv`] ?? files[`${root}cards.tsv`];
  const cards: NormalizedCard[] = jsonl
    ? strFromU8(jsonl)
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : json
      ? JSON.parse(strFromU8(json))
      : csv
        ? csvToCards(strFromU8(csv).replace(/^\uFEFF/, '')).cards
        : [];
  if (!jsonl && !json && !csv) throw new Error('Deck package has no cards file (expected cards.csv or cards.jsonl)');
  const media: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith(`${root}media/`) && !name.endsWith('/') && !/\.(txt|md)$/i.test(name))
      media[basename(name)] = data;
  }
  return { manifest, cards: cards.map((c: any) => ({ ...c, sourceId: c.sourceId ?? c.id })), media };
}

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
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(full, null, 2)),
    'cards.jsonl': strToU8(
      cards.map(({ sourceId, ...c }) => JSON.stringify({ id: String(sourceId ?? ''), ...c })).join('\n') + '\n',
    ),
  };
  for (const [name, data] of Object.entries(media)) files[`media/${name}`] = [data, { level: 0 }] as any;
  return zipSync(files, { level: 6 });
}
