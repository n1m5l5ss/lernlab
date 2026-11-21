// The deck gallery goes online only when it is opened, and installs only a file whose SHA-256 matches.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-gallery-'));
process.env.LERNLAB_DATA = dir;
delete process.env.LERNLAB_GALLERY_URL;
const requests: string[] = [];
let respond: (url: string) => Response = () => new Response('not found', { status: 404 });
const { galleryUrl, setGalleryFetch } = await import('./gallery');
setGalleryFetch(async (url) => {
  requests.push(url);
  return respond(url);
});
const { handle } = await import('./handlers');
after(() => cleanupTempDir(dir));

const pack = new Uint8Array(
  readFileSync(join(import.meta.dirname, '../../../examples/chemistry-first-20-elements.lernpack')),
);
const sha = createHash('sha256').update(pack).digest('hex');
const INDEX = 'https://raw.githubusercontent.com/n1m5l5ss/lernlab-decks/main/index.json';
const entry = (over: object = {}) => ({
  id: 'chemistry',
  title: 'Chemistry: first 20 elements',
  description: 'Symbols and names',
  language: null,
  cards: 20,
  licence: 'CC0-1.0',
  author: 'LernLab',
  url: 'decks/chemistry.lernpack',
  sha256: sha,
  size: pack.length,
  ...over,
});
const serve = (decks: object[], file: Uint8Array = pack) =>
  (respond = (url) =>
    url === INDEX
      ? new Response(JSON.stringify({ format: 'lernlab-gallery', version: 1, decks }))
      : new Response(file as BodyInit));
const code = (r: Awaited<ReturnType<typeof handle>>) => (r.ok ? 'ok' : r.error.code);

test('nothing goes online until the gallery is opened', async () => {
  serve([entry()]);
  for (const channel of ['state.get', 'app.info', 'stats.get', 'progress.get', 'backup.list'])
    assert.equal(code(await handle(channel, undefined)), 'ok', channel);
  assert.equal(code(await handle('gallery.install', { id: 'chemistry' })), 'gallery_unknown_deck');
  assert.deepEqual(requests, []);

  const list = await handle('gallery.list', undefined);
  assert.ok(list.ok);
  assert.deepEqual(requests, [INDEX]);
  assert.equal(galleryUrl(), INDEX);
});

test('a deck whose SHA-256 does not match is refused and nothing is imported', async () => {
  serve([entry({ sha256: 'f'.repeat(64) })]);
  await handle('gallery.list', undefined);
  const before = (await handle('state.get', undefined)) as { ok: true; value: { decks: unknown[] } };
  assert.equal(code(await handle('gallery.install', { id: 'chemistry' })), 'gallery_checksum');
  const now = (await handle('state.get', undefined)) as { ok: true; value: { decks: unknown[] } };
  assert.equal(now.value.decks.length, before.value.decks.length);
});

test('a file bigger than the index says is refused while downloading', async () => {
  const bigger = new Uint8Array(pack.length + 10);
  serve([entry()], bigger);
  await handle('gallery.list', undefined);
  assert.equal(code(await handle('gallery.install', { id: 'chemistry' })), 'gallery_too_big');
});

test('a matching deck installs through the .lernpack importer under its gallery title', async () => {
  serve([entry()]);
  await handle('gallery.list', undefined);
  const r = await handle('gallery.install', { id: 'chemistry' });
  assert.ok(r.ok, JSON.stringify(r));
  const report = r.value as { format: string; added: number; deck: { name: string } };
  assert.equal(report.format, 'lernpack');
  assert.equal(report.deck.name, 'Chemistry: first 20 elements');
  assert.ok(report.added > 0);
});

test('offline, an error page and a broken index come back as error codes', async () => {
  setGalleryFetch(async () => {
    throw new TypeError('fetch failed');
  });
  assert.equal(code(await handle('gallery.list', undefined)), 'gallery_offline');
  setGalleryFetch(async () => new Response('nope', { status: 503 }));
  assert.equal(code(await handle('gallery.list', undefined)), 'gallery_unavailable');
  setGalleryFetch(async () => new Response('{"format":"something"}'));
  assert.equal(code(await handle('gallery.list', undefined)), 'gallery_bad_index');
});

test('the index address can point at this computer for testing, never at plain http elsewhere', () => {
  assert.equal(galleryUrl('http://127.0.0.1:5285/index.json'), 'http://127.0.0.1:5285/index.json');
  assert.equal(galleryUrl('http://example.com/index.json'), INDEX);
  assert.equal(galleryUrl('not a url'), INDEX);
});
