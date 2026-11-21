// The gallery index is untrusted: bad entries are left out, a bad index is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GALLERY_INDEX_URL, GalleryIndexError, parseGalleryIndex, searchGallery } from './gallery';

const INDEX = 'https://raw.githubusercontent.com/n1m5l5ss/lernlab-decks/main/index.json';
const good = {
  id: 'german-colours',
  title: 'German colours',
  description: 'Twelve colours with pictures',
  language: 'de',
  cards: 12,
  licence: 'CC-BY-4.0',
  author: 'LernLab',
  url: 'decks/german-colours.lernpack',
  sha256: 'a'.repeat(64),
  size: 4096,
  tags: ['beginner'],
};
const index = (decks: unknown[], extra: object = {}) =>
  JSON.stringify({ format: 'lernlab-gallery', version: 1, updated: '2026-11-21', decks, ...extra });

test('the default index lives in the lernlab-decks repo on GitHub', () => {
  assert.equal(GALLERY_INDEX_URL, INDEX);
});

test('a good entry is read, with its file URL made absolute', () => {
  const { decks, rejected, updated } = parseGalleryIndex(index([good]), INDEX);
  assert.deepEqual(rejected, []);
  assert.equal(updated, '2026-11-21');
  assert.equal(
    decks[0].url,
    'https://raw.githubusercontent.com/n1m5l5ss/lernlab-decks/main/decks/german-colours.lernpack',
  );
  assert.equal(decks[0].licence, 'CC-BY-4.0');
  const subject = parseGalleryIndex(index([{ ...good, language: null, licence: 'CC0-1.0 OR MIT' }]), INDEX);
  assert.equal(subject.decks[0].language, null);
});

test('bad entries are left out and the rest of the index still loads', () => {
  const bad = [
    { ...good, id: 'no-licence', licence: undefined },
    { ...good, id: 'bad-licence', licence: '<script>' },
    { ...good, id: 'short-sha', sha256: 'abc' },
    { ...good, id: 'plain-http', url: 'http://example.com/x.lernpack' },
    { ...good, id: 'other-site', url: 'https://example.com/x.lernpack' },
    { ...good, id: 'file-url', url: 'file:///etc/passwd' },
    { ...good, id: 'no-size', size: 0 },
    { ...good, id: 'no-cards', cards: -1 },
    { ...good, id: 'Bad Id' },
    { ...good, id: 'no-author', author: ' ' },
    { ...good, id: 'bad-language', language: 'German!' },
    'not an object',
    { ...good }, // duplicate of the first good one
  ];
  const { decks, rejected } = parseGalleryIndex(index([good, ...bad]), INDEX);
  assert.deepEqual(
    decks.map((d) => d.id),
    ['german-colours'],
  );
  assert.equal(rejected.length, bad.length);
  assert.deepEqual(
    rejected.map((r) => r.reason),
    [
      'licence',
      'licence',
      'sha256',
      'url',
      'url',
      'url',
      'size',
      'cards',
      'id',
      'author',
      'language',
      'entry',
      'duplicate id',
    ],
  );
});

test('a file on GitHub is allowed even when the index is elsewhere; http only on this computer', () => {
  const local = 'http://127.0.0.1:5285/index.json';
  const r = parseGalleryIndex(
    index([
      { ...good, url: 'decks/a.lernpack' },
      { ...good, id: 'release', url: 'https://github.com/n1m5l5ss/lernlab-decks/releases/download/v1/b.lernpack' },
    ]),
    local,
  );
  assert.deepEqual(
    r.decks.map((d) => d.url),
    [
      'http://127.0.0.1:5285/decks/a.lernpack',
      'https://github.com/n1m5l5ss/lernlab-decks/releases/download/v1/b.lernpack',
    ],
  );
});

test('an index that is not a gallery index, or a newer version, is refused', () => {
  assert.throws(() => parseGalleryIndex('not json', INDEX), GalleryIndexError);
  assert.throws(() => parseGalleryIndex(JSON.stringify({ decks: [] }), INDEX), GalleryIndexError);
  assert.throws(() => parseGalleryIndex(index([], { version: 2 }), INDEX), /version 2/);
});

test('search matches every word in title, description, author, language and tags, ignoring accents', () => {
  const { decks } = parseGalleryIndex(
    index([
      good,
      { ...good, id: 'anatomy', title: 'Anatomie du cœur', language: 'fr', tags: ['medicine'], description: '' },
    ]),
    INDEX,
  );
  assert.equal(searchGallery(decks, '').length, 2);
  assert.deepEqual(
    searchGallery(decks, 'ANATOMIE medicine').map((d) => d.id),
    ['anatomy'],
  );
  assert.deepEqual(
    searchGallery(decks, 'colours de').map((d) => d.id),
    ['german-colours'],
  );
  assert.deepEqual(searchGallery(decks, 'coeur').length, 0); // œ is a letter, not an accent
  assert.deepEqual(
    searchGallery(decks, 'anatomíe').map((d) => d.id),
    ['anatomy'],
  );
});
