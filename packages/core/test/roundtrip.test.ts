// Export, then import into a fresh deck: the cards come back the same, in CSV and in .lernpack.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-roundtrip-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { createDeck, storeMedia, upsertCards } = await import('../src/library');
const { CSV_TEMPLATE } = await import('../src/csvtemplate');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const deck = createDeck('Biology', null);
storeMedia('heart.png', png);
upsertCards(deck, [
  {
    sourceId: 'heart',
    front: 'The **heart** has # four chambers',
    back: 'two atria, two ventricles',
    altAnswers: '4|four',
    example: 'The <b>heart</b> pumps blood.',
    exampleTranslation: 'Das Herz pumpt Blut.',
    explanation: 'Atria receive, ventricles pump.',
    notes: 'Think: 2 + 2',
    category: 'Organs',
    tags: ['bio', 'cardio'],
    image: 'heart.png',
    subdeck: 'Biology::Cardio',
    group: 'G01',
    rank: 3,
    extra: { reading: 'hɑːt' },
  },
  {
    front: 'Which TWO are organelles?',
    back: '',
    type: 'mcq',
    choices: 'Mitochondrion|Heart|Ribosome|Lung',
    correct: '1|3',
    explanation: 'Organelles live inside cells.',
    rank: 1,
  },
  { front: 'Order mitosis', back: '', type: 'order', steps: 'Prophase|Metaphase|Anaphase|Telophase', rank: 2 },
  { front: 'The {{c1::mitochondrion}} makes ATP', back: 'Cell biology', rank: 4 },
  { front: '#1 rule, "quoted", with commas', back: 'line one\nline two', rank: 5 },
]);

/** Every stored card field except the row's own id, deck, order and timestamps; the deck's own name reads <deck>. */
const cardsOf = (deckId: number, deckName: string) =>
  getDb()
    .prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((r) => {
      const { id: _id, deck_id: _deckId, ord: _ord, updated_at: _at, deck: sub, ...card } = r;
      return { ...card, subdeck: sub === deckName ? '<deck>' : sub };
    });
const original = cardsOf(deck.id, 'Biology');

test('.lernpack: export then import into a new deck gives identical cards, with media', () => {
  const pack = exportDeck(deck.id, 'lernpack');
  assert.equal(pack.name, 'Biology.lernpack');
  const r = importFile(pack.name, pack.data, { deckName: 'Biology copy' });
  assert.equal(r.added, 5);
  assert.equal(r.media, 1);
  assert.equal(r.mediaMissing, 0);
  assert.deepEqual(cardsOf(r.deck.id, 'Biology copy'), original);
});

test('CSV: export then import into a new deck gives identical cards (media files travel in .lernpack)', () => {
  const csv = exportDeck(deck.id, 'csv');
  assert.equal(csv.name, 'Biology.csv');
  const r = importFile('Fresh.csv', csv.data);
  assert.equal(r.deck.name, 'Fresh');
  assert.equal(r.added, 5);
  const copy = cardsOf(r.deck.id, 'Fresh');
  // A plain CSV carries the file name of a picture, not the picture itself.
  assert.equal(r.mediaMissing, 1);
  const withoutMedia = original.map((c) => ({ ...c, image: null }));
  assert.deepEqual(copy, withoutMedia);
});

test('the CSV template imports as three example cards', () => {
  const lines = CSV_TEMPLATE.trim().split('\n');
  assert.equal(lines.length, 4, 'a header and three example rows');
  assert.match(lines[0], /^front,back,/);
  const r = importFile('template.csv', strToU8(CSV_TEMPLATE));
  assert.equal(r.added, 3);
  const kinds = getDb()
    .prepare('SELECT kind FROM items WHERE deck_id = ? ORDER BY ord')
    .all(r.deck.id)
    .map((x) => x.kind);
  assert.ok(kinds.includes('mcq'), kinds.join());
});
