// Safe reading of untrusted deck files: zip paths, zip bombs, zstd bombs and media checks.
// Every limit is listed in IMPORT_LIMITS and documented in docs/FORMAT.md ("Limits").
import { unzipSync } from 'fflate';
import { Decompress } from 'fzstd';
import { extname } from '../paths';
import { mediaKind } from '../library';
import { UserError } from '../errors';

const MB = 1024 * 1024;

export const IMPORT_LIMITS = {
  /** Largest file the window may send (checked by the request table). */
  fileBytes: 500 * MB,
  /** Everything inside a zip, unpacked, as the zip itself declares it. */
  unpackedBytes: 2048 * MB,
  /** Entries in one zip. */
  zipEntries: 20_000,
  /** One entry may not unpack to more than this many times its packed size (zip bombs). */
  maxRatio: 1000,
  /** An Anki collection after zstd decompression. */
  collectionBytes: 1024 * MB,
  /** Cards in one import. */
  cards: 100_000,
  /** Media files, per kind. */
  image: 20 * MB,
  audio: 50 * MB,
  video: 200 * MB,
} as const;

export type ZipEntry = { name: string; size: number; originalSize: number };

/** A path inside a zip that could point outside the folder it is unpacked to. */
export function unsafeZipPath(name: string): boolean {
  return (
    name.includes('\0') ||
    /^[/\\]/.test(name) ||
    /^[a-zA-Z]:/.test(name) ||
    name.split(/[/\\]/).some((part) => part === '..')
  );
}

export const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
export const isNestedZip = (name: string) => /\.(zip|apkg|colpkg|lernpack)$/i.test(name);

/** List a zip without unpacking it, and reject unsafe paths and zip bombs. */
export function listZip(data: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  try {
    unzipSync(data, {
      filter: (f) => {
        entries.push({ name: f.name, size: f.size, originalSize: f.originalSize });
        return false;
      },
    });
  } catch {
    throw new UserError('zip_damaged', 'This file is damaged or not a complete zip file');
  }
  if (entries.length > IMPORT_LIMITS.zipEntries)
    throw new UserError('zip_too_many_files', 'The zip contains too many files', { max: IMPORT_LIMITS.zipEntries });
  let total = 0;
  for (const e of entries) {
    if (unsafeZipPath(e.name))
      throw new UserError('zip_unsafe_path', `Unsafe path inside the zip: ${e.name}`, { file: e.name });
    total += e.originalSize;
    const bomb = e.originalSize > MB && e.originalSize > Math.max(e.size, 1) * IMPORT_LIMITS.maxRatio;
    if (bomb || total > IMPORT_LIMITS.unpackedBytes)
      throw new UserError('zip_too_big', 'The zip unpacks to too much data', {
        mb: IMPORT_LIMITS.unpackedBytes / MB,
      });
  }
  return entries;
}

/** Unpack the entries `want` accepts, after the checks in listZip. Each entry is at most its declared size. */
export function readZip(data: Uint8Array, want: (name: string) => boolean = () => true): Record<string, Uint8Array> {
  listZip(data);
  try {
    return unzipSync(data, { filter: (f) => !f.name.endsWith('/') && want(f.name) });
  } catch {
    throw new UserError('zip_damaged', 'This file is damaged or not a complete zip file');
  }
}

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd];
export const isZstd = (b: Uint8Array) => ZSTD.every((x, i) => b[i] === x);

/** The buffer a zstd frame asks the decoder to allocate up front (its window, or its whole size). */
function zstdWindow(b: Uint8Array): number {
  const flags = b[4] ?? 0;
  const single = (flags >> 5) & 1;
  const sizeFlag = flags >> 6;
  const at = 6 - single + [0, 1, 2, 4][flags & 3];
  const sizeBytes = sizeFlag ? 1 << sizeFlag : single;
  let size = 0;
  for (let i = 0; i < sizeBytes; i++) size += (b[at + i] ?? 0) * 2 ** (8 * i);
  if (sizeFlag === 1) size += 256;
  if (single) return size;
  const base = 2 ** (10 + ((b[5] ?? 0) >> 3));
  return base + (base / 8) * ((b[5] ?? 0) & 7);
}

/** Decompress zstd data (or pass plain data through), stopping once it grows past `max` bytes. */
export function unzstd(b: Uint8Array, max: number): Uint8Array {
  if (!isZstd(b)) return b;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const tooBig = () => new UserError('zip_too_big', 'The file unpacks to too much data', { mb: Math.round(max / MB) });
  if (zstdWindow(b) > max) throw tooBig();
  try {
    new Decompress((chunk) => {
      size += chunk.length;
      if (size > max) throw tooBig();
      chunks.push(chunk);
    }).push(b, true);
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError('zip_damaged', 'This file is damaged or not a complete zip file');
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/** What the first bytes say a file is. null when they say nothing we know. */
export function sniff(b: Uint8Array): 'image' | 'audio' | 'video' | 'av' | 'unsafe' | null {
  if (starts(b, [0x89, 0x50, 0x4e, 0x47]) || starts(b, [0xff, 0xd8, 0xff]) || ascii(b, 0, 4) === 'GIF8') return 'image';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return 'audio';
  if (ascii(b, 0, 3) === 'ID3' || ascii(b, 0, 4) === 'fLaC' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))
    return 'audio';
  if (ascii(b, 4, 4) === 'ftyp') return /^avi[fs]/.test(ascii(b, 8, 4)) ? 'image' : 'av';
  if (ascii(b, 0, 4) === 'OggS' || starts(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'av';
  // Programs, archives, documents and web pages are never media.
  if (ascii(b, 0, 2) === 'MZ' || starts(b, [0x7f, 0x45, 0x4c, 0x46]) || starts(b, [0xcf, 0xfa, 0xed, 0xfe]))
    return 'unsafe';
  if (ascii(b, 0, 2) === 'PK' || ascii(b, 0, 4) === '%PDF' || ascii(b, 0, 2) === '#!') return 'unsafe';
  if (/^\s*<(!doctype html|html|script)/i.test(ascii(b, 0, 64))) return 'unsafe';
  return null;
}

export type MediaProblem = 'media_unsupported' | 'media_too_large' | 'media_wrong_type';

/** Why a media file must not be stored, or null when it is fine. The type is checked by content, not name. */
export function mediaProblem(name: string, data: Uint8Array): MediaProblem | null {
  const kind = mediaKind(name);
  if (!kind) return 'media_unsupported';
  if (data.length > IMPORT_LIMITS[kind]) return 'media_too_large';
  const seen = sniff(data);
  if (extname(name).toLowerCase() === '.svg') return seen ? 'media_wrong_type' : null;
  if (seen === 'unsafe' || (seen && seen !== kind && !(seen === 'av' && kind !== 'image'))) return 'media_wrong_type';
  return null;
}
