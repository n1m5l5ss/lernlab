// "Export everything": one zip with the database, media and daily progress files. Importing it treats
// the zip as untrusted: only known paths with plain file names are accepted, and sizes are capped
// before anything is unpacked.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { UserError } from '../errors';

export const BUNDLE_FORMAT = 'lernlab-data';
export const BUNDLE_VERSION = 1;
/** Unpacked size limit, so a tiny zip can't expand to fill the disk. */
export const MAX_BUNDLE_BYTES = 4 * 1024 * 1024 * 1024;

export type BundleManifest = {
  format: typeof BUNDLE_FORMAT;
  version: number;
  createdAt: string;
  schemaVersion: number;
  counts: { decks: number; cards: number; reviews: number };
};

export type DataBundle = {
  manifest: BundleManifest;
  /** The SQLite database file. */
  db: Uint8Array;
  /** Card media by file name. */
  media: Record<string, Uint8Array>;
  /** Daily progress summaries by file name (YYYY-MM-DD.json). */
  progress: Record<string, Uint8Array>;
};

const SQLITE_MAGIC = 'SQLite format 3\u0000';
/** A plain file name: no folders, no "..", no control characters. */
const plainName = (name: string) =>
  name.length <= 200 && name !== '.' && name !== '..' && /^[^/\\:]+$/.test(name) && ![...name].some((c) => c < ' ');

const bad = (why: string) => new UserError('not_data_export', `This file is not a LernLab data export (${why}).`);

export function packDataBundle(b: DataBundle): Uint8Array {
  const files: Zippable = {
    'manifest.json': strToU8(JSON.stringify(b.manifest, null, 2)),
    'lernlab.db': [b.db, { level: 6 }],
  };
  // Media is usually compressed already; store it as is.
  for (const [name, data] of Object.entries(b.media)) files[`media/${name}`] = [data, { level: 0 }];
  for (const [name, data] of Object.entries(b.progress)) files[`progress/${name}`] = data;
  return zipSync(files);
}

/** Where a zip entry belongs, or null for folder entries. Throws on anything unexpected. */
export function bundlePath(path: string): { kind: 'manifest' | 'db' | 'media' | 'progress'; name: string } | null {
  if (path === 'manifest.json') return { kind: 'manifest', name: path };
  if (path === 'lernlab.db') return { kind: 'db', name: path };
  if (path === 'media/' || path === 'progress/') return null;
  const m = /^(media|progress)\/(.+)$/.exec(path);
  if (m && plainName(m[2]) && (m[1] === 'media' || /^[\w-]+\.json$/.test(m[2])))
    return { kind: m[1] as 'media' | 'progress', name: m[2] };
  throw bad(`unexpected file ${JSON.stringify(path.slice(0, 100))}`);
}

export function unpackDataBundle(bytes: Uint8Array, maxBytes = MAX_BUNDLE_BYTES): DataBundle {
  let files: Record<string, Uint8Array>;
  let total = 0;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (!bundlePath(f.name)) return false;
        total += f.originalSize;
        if (total > maxBytes) throw bad('too large');
        return true;
      },
    });
  } catch (e) {
    throw e instanceof UserError ? e : bad('not a zip');
  }
  const out: DataBundle = {
    manifest: null as unknown as BundleManifest,
    db: new Uint8Array(),
    media: {},
    progress: {},
  };
  for (const [path, data] of Object.entries(files)) {
    const p = bundlePath(path)!;
    if (p.kind === 'manifest') {
      try {
        out.manifest = JSON.parse(strFromU8(data)) as BundleManifest;
      } catch {
        throw bad('unreadable manifest');
      }
    } else if (p.kind === 'db') out.db = data;
    else out[p.kind][p.name] = data;
  }
  if (out.manifest?.format !== BUNDLE_FORMAT) throw bad('no manifest');
  if (!(out.manifest.version <= BUNDLE_VERSION))
    throw new UserError('data_export_too_new', 'This export needs a newer version of LernLab.');
  if (strFromU8(out.db.subarray(0, 16)) !== SQLITE_MAGIC) throw bad('no database');
  return out;
}
