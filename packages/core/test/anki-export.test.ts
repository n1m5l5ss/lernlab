// Anki export (#49): a deck becomes an .apkg (a zip with a schema 11 collection.anki2 and its media)
// that Anki imports, and that LernLab's own Anki importer reads back to the same cards and media.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-ankiexport-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost, openReadonly } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { createDeck, storeMedia, upsertCards } = await import('../src/library');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const mp3 = strToU8('ID3-beat');
const mp4 = new Uint8Array([0, 0, 0, 0x18, ...strToU8('ftypisom'), 1, 2, 3]);
const deck = createDeck('Capitals', 'fr');
storeMedia('paris.png', png);
storeMedia('paris.mp3', mp3);
storeMedia('seine.mp4', mp4);
upsertCards(deck, [
  {
    front: 'la capitale de la France',
    back: 'Paris & suburbs',
    example: 'J’habite à <b>Paris</b>.',
    exampleTranslation: 'I live in Paris.',
    explanation: 'Capital cities take no article.',
    notes: 'Think of the Eiffel tower',
    tags: ['europe', 'big city'],
    image: 'paris.png',
    audio: 'paris.mp3',
    subdeck: 'Capitals::Europe',
  },
  { front: 'la Seine', back: 'the Seine', video: 'seine.mp4' },
  { front: '{{c1::Berlin}} is the capital of {{c2::Germany}}', back: 'Since 1990' },
]);

const cardsOf = (deckId: number) =>
  getDb()
    .prepare(
      `SELECT kind, target, meaning, sentence_html, sentence_meaning, grammar, notes, image, audio, video, tags
       FROM items WHERE deck_id = ? ORDER BY target`,
    )
    .all(deckId)
    .map((r) => ({ ...r }));

/** Open the collection inside an exported package, read-only. */
function collection(files: Record<string, Uint8Array>) {
  const file = join(dir, `col-${Math.random()}.anki2`);
  writeFileSync(file, files['collection.anki2']);
  return openReadonly(file);
}

test('the .apkg holds a schema 11 collection with a Basic and a Cloze note type, plus the media', () => {
  const out = exportDeck(deck.id, 'apkg');
  assert.equal(out.name, 'Capitals.apkg');
  const files = unzipSync(out.data);
  const map = JSON.parse(strFromU8(files.media)) as Record<string, string>;
  assert.deepEqual(Object.values(map).sort(), ['paris.mp3', 'paris.png', 'seine.mp4']);
  for (const [k, name] of Object.entries(map))
    assert.deepEqual(files[k], { 'paris.png': png, 'paris.mp3': mp3, 'seine.mp4': mp4 }[name]);

  const db = collection(files);
  const col = db.prepare('SELECT ver, models, decks, dconf, conf FROM col').get()!;
  assert.equal(col.ver, 11);
  const models = Object.values(JSON.parse(String(col.models))) as { type: number; flds: { name: string }[] }[];
  assert.deepEqual(models.map((m) => m.type).sort(), [0, 1], 'a standard and a cloze note type');
  for (const m of models) assert.ok(m.flds.length >= 2);
  const deckNames = (Object.values(JSON.parse(String(col.decks))) as { name: string }[]).map((x) => x.name).sort();
  assert.deepEqual(deckNames, ['Capitals', 'Capitals::Europe', 'Default']);
  assert.ok(JSON.parse(String(col.dconf))['1'], 'the default options group');

  const notes = db.prepare('SELECT id, guid, mid, flds, tags, sfld, csum FROM notes').all();
  assert.equal(notes.length, 3);
  const paris = notes.find((n) => String(n.flds).startsWith('la capitale'))!;
  const fields = String(paris.flds).split('\x1f');
  assert.equal(fields[1], 'Paris &amp; suburbs', 'plain text is escaped for Anki’s HTML fields');
  assert.ok(fields.includes('<img src="paris.png">'));
  assert.ok(fields.includes('[sound:paris.mp3]'));
  assert.equal(String(paris.tags).trim(), 'europe big_city', 'Anki tags have no spaces');
  assert.equal(paris.sfld, 'la capitale de la France');
  assert.ok(Number(paris.csum) > 0);
  assert.equal(new Set(notes.map((n) => n.guid)).size, 3);

  // A cloze note with two gaps gives two cards; the others one each. All new.
  const cards = db.prepare('SELECT nid, did, ord, type, queue FROM cards ORDER BY nid, ord').all();
  assert.equal(cards.length, 4);
  const cloze = notes.find((n) => String(n.flds).includes('{{c1::'))!;
  assert.deepEqual(
    cards.filter((c) => c.nid === cloze.id).map((c) => c.ord),
    [0, 1],
  );
  assert.ok(cards.every((c) => c.type === 0 && c.queue === 0));
  db.close();
});

test('.apkg: export then import with the Anki importer gives the same cards and media', () => {
  const out = exportDeck(deck.id, 'apkg');
  // Anki decks have no language: the import is told, as the import screen does.
  const r = importFile(out.name, out.data, { deckName: 'Capitals copy', language: 'fr' });
  assert.equal(r.format, 'apkg');
  assert.equal(r.added, 3);
  assert.equal(r.media, 3);
  assert.equal(r.mediaMissing, 0);
  const tagsFixed = cardsOf(deck.id).map((c) => ({
    ...c,
    tags: JSON.stringify((JSON.parse(String(c.tags)) as string[]).map((t) => t.replace(/ /g, '_'))),
  }));
  assert.deepEqual(cardsOf(r.deck.id), tagsFixed);
  const sub = getDb().prepare('SELECT deck FROM items WHERE deck_id = ? AND image IS NOT NULL').get(r.deck.id);
  assert.equal(sub?.deck, 'Capitals::Europe', 'sub-decks come back');
});

test('.apkg: importing the export into the same deck updates the cards in place', () => {
  const out = exportDeck(deck.id, 'apkg');
  const r = importFile(out.name, out.data, { deckId: deck.id });
  assert.equal(r.added, 0);
  assert.equal(r.updated, 3);
  assert.equal(r.total, 3);
});

test('.apkg: the plain-text back of a code card is escaped, its line breaks kept', () => {
  const typed = createDeck('Typed answers', null);
  upsertCards(typed, [
    { type: 'code', front: 'What does this print?', code: 'print("<b>x</b> & y")', back: '<b>x</b> & y\nok' },
    { type: 'order', front: 'Order', back: '', steps: '<b>one</b>|two' },
  ]);
  const db = collection(unzipSync(exportDeck(typed.id, 'apkg').data));
  const backs = db
    .prepare('SELECT flds FROM notes')
    .all()
    .map((n) => String(n.flds).split('\x1f').slice(0, 2));
  db.close();
  const back = (front: string) => backs.find((f) => f[0] === front)?.[1];
  assert.equal(back('What does this print?'), '&lt;b&gt;x&lt;/b&gt; &amp; y<br>ok');
  assert.equal(back('Order'), '1. <b>one</b><br>2. two', 'formatted steps keep their HTML');
});
