// The deck gallery's downloads. They run in the data process, and only when the user opens the gallery
// or installs a deck from it (principle 4): nothing here runs at start-up.
import { createHash } from 'node:crypto';
import { UserError as AppError } from '@lernlab/core/errors';
import {
  GALLERY_INDEX_URL,
  GALLERY_LIMITS,
  GalleryIndexError,
  isGalleryUrl,
  parseGalleryIndex,
  type GalleryDeck,
  type GalleryIndex,
} from '@lernlab/core/gallery';

/** The index address: LERNLAB_GALLERY_URL (https, or http on this computer for testing), else the default. */
export function galleryUrl(env = process.env.LERNLAB_GALLERY_URL): string {
  try {
    if (env && isGalleryUrl(new URL(env))) return new URL(env).href;
  } catch {
    // fall through to the default
  }
  return GALLERY_INDEX_URL;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: Fetch = (url, init) => fetch(url, init);
/** Tests swap the network for a fake. */
export const setGalleryFetch = (f: Fetch) => (fetcher = f);

/** The index from the last time the gallery was opened: installs only use decks listed there. */
let lastIndex: GalleryIndex | null = null;

/** Download `url`, refusing more than `maxBytes` and giving up after `timeoutMs`. */
async function download(url: string, maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  } catch {
    throw new AppError('gallery_offline', 'The deck gallery could not be reached.');
  }
  if (!res.ok || !res.body) throw new AppError('gallery_unavailable', `The deck gallery answered ${res.status}.`);
  if (Number(res.headers.get('content-length')) > maxBytes) throw tooBig();
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        void reader.cancel();
        throw tooBig();
      }
      parts.push(value);
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('gallery_offline', 'The download stopped before it finished.');
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
const tooBig = () => new AppError('gallery_too_big', 'The file is bigger than the gallery allows.');

/** Fetch and check the gallery index. */
export async function loadGallery(): Promise<GalleryIndex & { url: string }> {
  const url = galleryUrl();
  const bytes = await download(url, GALLERY_LIMITS.indexBytes, GALLERY_LIMITS.indexTimeoutMs);
  try {
    lastIndex = parseGalleryIndex(new TextDecoder().decode(bytes), url);
  } catch (e) {
    if (e instanceof GalleryIndexError) throw new AppError('gallery_bad_index', e.message);
    throw e;
  }
  if (lastIndex.rejected.length) console.warn(`[gallery] left out ${lastIndex.rejected.length} bad entries`);
  return { ...lastIndex, url };
}

export const sha256Hex = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

/** Download one deck listed in the last index and check its size and SHA-256 before anything reads it. */
export async function downloadGalleryDeck(id: string): Promise<{ deck: GalleryDeck; data: Uint8Array }> {
  const deck = lastIndex?.decks.find((d) => d.id === id);
  if (!deck) throw new AppError('gallery_unknown_deck', 'That deck is not in the gallery.');
  const data = await download(deck.url, deck.size, GALLERY_LIMITS.deckTimeoutMs);
  if (data.length !== deck.size || sha256Hex(data) !== deck.sha256)
    throw new AppError('gallery_checksum', 'The downloaded deck does not match the gallery, so it was not installed.');
  return { deck, data };
}
