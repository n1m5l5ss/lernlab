// Hardened importers (#25): any reasonable file imports, bad files fail with a clear code, and the
// import report says what happened to every row and media file.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';
import { compress as zstdCompress } from './zstd-test-helper';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-imp-'));
process.env.LERNLAB_DATA = dir;
const { importFile, importPasted, IMPORT_REPORT_CODES } = await import('../src/importer');
const { mediaProblem, unzstd, unsafeZipPath, IMPORT_LIMITS } = await import('../src/formats/zip');
const { writeLernpack } = await import('../src/formats/lernpack');
const { installNodeHost, openRaw } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { getDb } = await import('../src/db');
const { recordAttempt } = await import('../src/learn');
const { UserError } = await import('../src/errors');
after(() => cleanupTempDir(dir));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const MP3 = strToU8('ID3-audio-bytes');
const EXE = strToU8('MZ-this-is-a-program');

/** The error code a call fails with. */
function failsWith(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof UserError, `expected a UserError, got ${String(e)}`);
    return e.code;
  }
  assert.fail('expected the import to fail');
}

test('CSV: skipped rows are listed by their line in the file, with a reason', () => {
  const csv = [
    'front,back,notes', // line 1
    '# a comment line', // 2
    'Hund,dog,', // 3
    ',orphan back,', // 4: no front
    '', // 5
    '"Katze","cat, the animal",', // 6
    'Hund,dog,', // 7: same card again
    '"Maus","mouse', // 8: a quoted newline …
    'still the mouse",', // 9
    ',,only notes', // 10: neither front nor back: not a card at all
  ].join('\n');
  const r = importFile('animals.csv', strToU8(csv));
  assert.equal(r.format, 'csv');
  assert.equal(r.added, 3);
  assert.deepEqual(r.skipped, [
    { row: 4, code: 'row_no_front' },
    { row: 7, code: 'row_duplicate' },
  ]);
  assert.equal(r.skippedCount, 2);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.missingMedia, []);
});

test('CSV/TSV in other encodings: UTF-16 from Excel and Windows-1252', () => {
  const tsv = 'Brot\tbread\nKäse\tcheese\n';
  const utf16 = new Uint8Array([
    0xff,
    0xfe,
    ...new Uint8Array(new Uint16Array([...tsv].map((c) => c.charCodeAt(0))).buffer),
  ]);
  const a = importFile('excel.txt', utf16);
  assert.equal(a.format, 'tsv');
  assert.equal(a.added, 2);
  assert.ok(getDb().prepare("SELECT 1 FROM items WHERE target = 'Käse'").get());

  const latin = new Uint8Array([...strToU8('front,back\nM'), 0xfc, ...strToU8('he,effort\n')]); // "Mühe" in Windows-1252
  const b = importFile('old.csv', latin);
  assert.equal(b.added, 1);
  assert.deepEqual(b.warnings, [{ code: 'encoding_guessed', file: 'old.csv' }]);
  assert.ok(getDb().prepare("SELECT 1 FROM items WHERE target = 'Mühe'").get());
});

test('a CSV whose first card is a cloze is still a CSV, not broken JSON', () => {
  const r = importFile('cloze.txt', strToU8('{{c1::Paris}} is the capital of France,geography\n'));
  assert.equal(r.format, 'csv');
  assert.equal(r.added, 1);
});

test('JSON: an array or {deck, cards}; bad entries are skipped, bad JSON fails clearly', () => {
  const r = importFile(
    'gen.json',
    strToU8(
      JSON.stringify({
        deck: { name: 'Generated', language: 'fr' },
        cards: [
          { id: 'a', front: 'chat', back: 'cat', tags: 'animal pet' },
          'not a card',
          { front: 'chien', back: 'dog', tags: [1] },
          null,
        ],
      }),
    ),
  );
  assert.equal(r.format, 'json');
  assert.equal(r.deck.name, 'Generated');
  assert.equal(r.deck.language, 'fr');
  assert.equal(r.added, 2);
  assert.deepEqual(r.skipped, [
    { row: 2, code: 'row_invalid' },
    { row: 4, code: 'row_invalid' },
  ]);
  assert.equal(
    failsWith(() => importFile('broken.json', strToU8('{"cards": [ {"front": '))),
    'bad_json',
  );
  assert.equal(
    failsWith(() => importFile('empty.json', strToU8('{"cards": []}'))),
    'no_cards',
  );
});

test('binary files and fake zips fail with a clear reason', () => {
  assert.equal(
    failsWith(() => importFile('photo.csv', new Uint8Array([0x89, 0x50, 0, 0, 0, 1, 2]))),
    'not_text',
  );
  assert.equal(
    failsWith(() => importFile('deck.apkg', strToU8('front,back\na,b'))),
    'zip_damaged',
  );
  const truncated = zipSync({ 'cards.csv': strToU8('front,back\na,b\n') }).slice(0, 30);
  assert.equal(
    failsWith(() => importFile('cut.zip', truncated)),
    'zip_damaged',
  );
  assert.equal(
    failsWith(() => importFile('empty.csv', strToU8('\n\n# only a comment\n'))),
    'no_cards',
  );
});

test('zip with a CSV and media: stored, missing, unsafe and nested files are all reported', () => {
  const zip = zipSync({
    'words/words.csv': strToU8(
      'front,back,image,audio\nrot,red,img/rot.png,rot.mp3\nblau,blue,blau.png,\ngrün,green,evil.png,\nnotes,pdf,doc.pdf,\n',
    ),
    'words/img/rot.png': PNG,
    'words/rot.mp3': MP3,
    'words/evil.png': EXE,
    'words/doc.pdf': strToU8('%PDF-1.4'),
    'words/more.zip': zipSync({ 'x.csv': strToU8('a,b') }),
    '__MACOSX/words/._rot.png': strToU8('junk'),
  });
  const r = importFile('words.zip', zip);
  assert.equal(r.format, 'csv+media');
  assert.equal(r.deck.name, 'words');
  assert.equal(r.added, 4);
  assert.equal(r.media, 2);
  assert.deepEqual(r.missingMedia, ['blau.png']);
  assert.equal(r.mediaMissing, 1);
  assert.deepEqual(r.warnings.map((w) => `${w.code}:${w.file}`).sort(), [
    'media_unsupported:doc.pdf',
    'media_wrong_type:evil.png',
    'nested_zip_ignored:more.zip',
  ]);
  const rot = getDb().prepare("SELECT image, audio FROM items WHERE target = 'rot'").get()!;
  assert.equal(rot.image, 'rot.png');
  assert.equal(rot.audio, 'rot.mp3');
  assert.equal(getDb().prepare("SELECT image FROM items WHERE target = 'grün'").get()!.image, null);
  assert.ok(!readdirSync(join(dir, 'media')).includes('evil.png'), 'the program was never written');
});

test('zip path traversal is rejected before anything is unpacked', () => {
  assert.ok(unsafeZipPath('../evil.csv'));
  assert.ok(unsafeZipPath('media/../../evil.png'));
  assert.ok(unsafeZipPath('/etc/passwd'));
  assert.ok(unsafeZipPath('C:\\Windows\\evil.dll'));
  assert.ok(unsafeZipPath('..\\evil.png'));
  assert.ok(!unsafeZipPath('media/images/rot..png'));
  for (const bad of ['../cards.csv', 'deck/../../x.png', '/abs.csv']) {
    const zip = zipSync({ 'cards.csv': strToU8('front,back\na,b\n'), [bad]: PNG });
    assert.equal(
      failsWith(() => importFile('evil.zip', zip)),
      'zip_unsafe_path',
      bad,
    );
  }
  const pack = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format: 'lernpack', version: 1, deck: { name: 'Evil' } })),
    'cards.csv': strToU8('front,back\na,b\n'),
    'media/../../../outside.png': PNG,
  });
  assert.equal(
    failsWith(() => importFile('evil.lernpack', pack)),
    'zip_unsafe_path',
  );
  assert.equal(getDb().prepare("SELECT 1 FROM decks WHERE name = 'Evil'").get(), undefined, 'no deck was made');
});

/** Rewrite the unpacked size a zip declares for every entry (local and central headers). */
function declareSize(zip: Uint8Array, size: number) {
  const out = zip.slice();
  const dv = new DataView(out.buffer);
  for (let i = 0; i < out.length - 4; i++) {
    const sig = dv.getUint32(i, true);
    if (sig === 0x04034b50) dv.setUint32(i + 22, size, true);
    if (sig === 0x02014b50) dv.setUint32(i + 24, size, true);
  }
  return out;
}

test('zip bombs are rejected: huge declared sizes and extreme compression ratios', () => {
  const zip = zipSync({ 'a.csv': strToU8('front,back\na,b\n'), 'b.mp3': MP3, 'c.mp3': MP3 });
  assert.equal(
    failsWith(() => importFile('bomb.zip', declareSize(zip, 0xffffffff))),
    'zip_too_big',
  );
  // A real high-ratio entry: 8 MB of zeros packs into a few KB.
  const zeros = zipSync(
    { 'cards.csv': strToU8('front,back\na,b\n'), 'z.png': new Uint8Array(8 * 1024 * 1024) },
    { level: 9 },
  );
  assert.equal(
    failsWith(() => importFile('zeros.zip', zeros)),
    'zip_too_big',
  );
  // zstd inside Anki packages: limited while decompressing, and by the size its header asks for.
  const big = zstdCompress(new Uint8Array(4 * 1024 * 1024));
  assert.equal(
    failsWith(() => unzstd(big, 1024 * 1024)),
    'zip_too_big',
  );
  assert.equal(unzstd(big, 8 * 1024 * 1024).length, 4 * 1024 * 1024);
});

test('too many cards in one file fails before a deck is made', () => {
  const rows = Array.from({ length: IMPORT_LIMITS.cards + 1 }, (_, i) => `w${i},m${i}`).join('\n');
  assert.equal(
    failsWith(() => importFile('huge.csv', strToU8(rows))),
    'too_many_cards',
  );
  assert.equal(getDb().prepare("SELECT 1 FROM decks WHERE name = 'huge'").get(), undefined);
});

test('media checks: by size per kind and by content, not by name', () => {
  assert.equal(mediaProblem('a.png', PNG), null);
  assert.equal(mediaProblem('a.mp3', MP3), null);
  assert.equal(mediaProblem('a.m4a', strToU8('\0\0\0\x20ftypM4A ')), null);
  assert.equal(mediaProblem('a.mp4', strToU8('\0\0\0\x20ftypisom')), null);
  assert.equal(mediaProblem('a.png', MP3), 'media_wrong_type');
  assert.equal(mediaProblem('a.png', EXE), 'media_wrong_type');
  assert.equal(mediaProblem('a.svg', strToU8('<!doctype html><script>alert(1)</script>')), 'media_wrong_type');
  assert.equal(mediaProblem('a.exe', EXE), 'media_unsupported');
  assert.equal(mediaProblem('a.png', new Uint8Array(IMPORT_LIMITS.image + 1)), 'media_too_large');
});

test('.lernpack: unreadable lines are skipped, a bad manifest fails clearly', () => {
  const zip = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format: 'lernpack', version: 1, deck: { name: 'Pack lines' } })),
    'cards.jsonl': strToU8(
      '{"id":"1","front":"eins","back":"one"}\n{broken\n\n{"id":"3","front":"drei","back":"three","image":"drei.png"}\n',
    ),
  });
  const r = importFile('lines.lernpack', zip);
  assert.equal(r.added, 2);
  assert.deepEqual(r.skipped, [{ row: 2, code: 'row_invalid' }]);
  assert.deepEqual(r.missingMedia, ['drei.png']);
  const bad = zipSync({ 'manifest.json': strToU8('{not json'), 'cards.csv': strToU8('a,b') });
  assert.equal(
    failsWith(() => importFile('bad.lernpack', bad)),
    'not_lernpack',
  );
  const manifest = (m: object) =>
    zipSync({ 'manifest.json': strToU8(JSON.stringify(m)), 'cards.csv': strToU8('front,back\na,b\n') });
  const noDeck = importFile('No deck.lernpack', manifest({ format: 'lernpack', version: 1 }));
  assert.equal(noDeck.deck.name, 'No deck', 'without a deck object the file name names the deck');
  assert.equal(noDeck.added, 1);
  for (const deck of ['oops', [1], 7])
    assert.equal(
      failsWith(() => importFile('odd.lernpack', manifest({ format: 'lernpack', version: 1, deck }))),
      'not_lernpack',
    );
});

/** A small legacy Anki package; `missing` leaves a media file out of the zip. */
function apkg(opts: { garbage?: boolean; missing?: boolean; back?: string } = {}) {
  const colFile = join(dir, `col-${Math.random()}.db`);
  const db = openRaw(colFile);
  db.exec(`CREATE TABLE col (models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);`);
  db.prepare('INSERT INTO col VALUES (?, ?)').run(
    JSON.stringify({
      7: {
        id: 7,
        flds: [
          { name: 'Front', ord: 0 },
          { name: 'Back', ord: 1 },
        ],
      },
    }),
    JSON.stringify({ 5: { id: 5, name: 'Geo' } }),
  );
  db.prepare('INSERT INTO notes VALUES (?, 7, ?, ?)').run(1, '', `France\x1f${opts.back ?? 'Paris'} [sound:paris.mp3]`);
  db.prepare('INSERT INTO notes VALUES (?, 7, ?, ?)').run(2, '', 'Spain\x1fMadrid <img src="madrid%20map.png">');
  db.exec('INSERT INTO cards VALUES (10, 1, 5, 0), (20, 2, 5, 0)');
  db.close();
  const files: Record<string, Uint8Array> = {
    'collection.anki2': opts.garbage ? strToU8('this is not sqlite at all') : new Uint8Array(readFileSync(colFile)),
    media: strToU8(JSON.stringify({ 0: 'paris.mp3', 1: 'madrid map.png' })),
    '0': MP3,
  };
  if (!opts.missing) files['1'] = PNG;
  return zipSync(files);
}

test('Anki .apkg: missing media is listed, a damaged collection fails clearly', () => {
  const r = importFile('geo.apkg', apkg({ missing: true }), { deckName: 'Geo apkg' });
  assert.equal(r.format, 'apkg');
  assert.equal(r.added, 2);
  assert.equal(r.media, 1);
  assert.deepEqual(r.missingMedia, ['madrid map.png']);
  assert.equal(
    failsWith(() => importFile('broken.apkg', apkg({ garbage: true }))),
    'anki_damaged',
  );
  const notAnki = zipSync({ 'collection.anki21b': strToU8('nope') });
  assert.equal(
    failsWith(() => importFile('fake.colpkg', notAnki)),
    'anki_damaged',
  );
});

test('re-import updates cards and keeps their progress', () => {
  const first = importFile('Capitals.csv', strToU8('id,front,back\nfr,France,Paris\nde,Germany,Bonn\n'));
  assert.equal(first.added, 2);
  const deck = first.deck.id;
  const germany = Number(
    getDb().prepare("SELECT id FROM items WHERE deck_id = ? AND target = 'Germany'").get(deck)!.id,
  );
  const t = new Date(2026, 10, 21, 10);
  recordAttempt({ sessionId: 's', itemId: germany, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), t);
  recordAttempt(
    { sessionId: 's', itemId: germany, format: 'typed', correct: true, responseMs: 2000, xp: 5 },
    getDb(),
    t,
  );
  const srs = getDb().prepare('SELECT * FROM srs WHERE item_id = ?').get(germany);
  assert.ok(srs, 'the card has a schedule');

  const again = importFile(
    'Capitals.csv',
    strToU8('id,front,back\nfr,France,Paris\nde,Germany,Berlin\nit,Italy,Rome\n'),
  );
  assert.equal(again.deck.id, deck);
  assert.equal(again.added, 1);
  assert.equal(again.updated, 2);
  assert.equal(again.total, 3);
  const row = getDb().prepare('SELECT meaning FROM items WHERE id = ?').get(germany)!;
  assert.equal(row.meaning, 'Berlin', 'the text is updated');
  assert.deepEqual(getDb().prepare('SELECT * FROM srs WHERE item_id = ?').get(germany), srs, 'progress is kept');

  // Anki packages match by note id, deck packages by card id.
  importFile('geo.apkg', apkg(), { deckName: 'Geo again' });
  const a2 = importFile('geo.apkg', apkg({ back: 'Paris (capital)' }), { deckName: 'Geo again' });
  assert.deepEqual([a2.added, a2.updated], [0, 2]);
  assert.equal(getDb().prepare('SELECT meaning FROM items WHERE id = 1').get()!.meaning, 'Paris (capital)');
  const pack = writeLernpack(
    { deck: { name: 'Packed' }, generator: 'test' },
    [{ sourceId: 'x', front: 'eins', back: 'one' }],
    {},
  );
  importFile('p.lernpack', pack);
  const p2 = importFile('p.lernpack', pack);
  assert.deepEqual([p2.added, p2.updated], [0, 1]);
});

test('re-importing an export (CSV or .lernpack) into the same deck updates it; elsewhere it copies', async () => {
  const { exportDeck } = await import('../src/exporter');
  const { deckByName, upsertCards } = await import('../src/library');
  // Cards with every kind of id: an Anki note id, a hashed CSV id and an id from a deck package.
  const geo = deckByName('Geo again')!;
  upsertCards(geo, [
    { front: 'Portugal', back: 'Lisbon' },
    { sourceId: 'pt-id', front: 'Greece', back: 'Athens' },
  ]);
  const spain = Number(getDb().prepare("SELECT id FROM items WHERE deck_id = ? AND target = 'Spain'").get(geo.id)!.id);
  const t = new Date(2026, 10, 22, 10);
  recordAttempt({ sessionId: 's2', itemId: spain, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), t);
  recordAttempt({ sessionId: 's2', itemId: spain, format: 'typed', correct: true, responseMs: 900, xp: 5 }, getDb(), t);
  const srs = getDb().prepare('SELECT * FROM srs WHERE item_id = ?').get(spain);
  const count = () => Number(getDb().prepare('SELECT COUNT(*) AS n FROM items WHERE deck_id = ?').get(geo.id)!.n);
  const before = count();
  for (const format of ['csv', 'lernpack'] as const) {
    const exp = exportDeck(geo.id, format);
    const r = importFile(exp.name, exp.data, { deckId: geo.id });
    assert.deepEqual([r.added, r.updated, r.total], [0, before, before], format);
    assert.equal(count(), before, `${format}: no duplicates`);
    assert.deepEqual(
      getDb().prepare('SELECT * FROM srs WHERE item_id = ?').get(spain),
      srs,
      `${format}: progress kept`,
    );
    const copy = importFile(exp.name, exp.data, { deckName: `Geo copy ${format}` });
    assert.deepEqual([copy.added, copy.total], [before, before], `${format}: another deck gets a copy`);
    assert.equal(count(), before, `${format}: the copy leaves the original alone`);
  }
});

test('pasted text returns the same report', () => {
  const r = importPasted('Haus - house\nBaum - tree\n', { fieldSep: ' - ', deckName: 'Pasted test' });
  assert.equal(r.format, 'paste');
  assert.equal(r.added, 2);
  assert.deepEqual(r.skipped, []);
});

test('every report code has a message in locales/en.json', () => {
  const en = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../locales/en.json'), 'utf8'));
  for (const code of IMPORT_REPORT_CODES) assert.equal(typeof en.errors[code], 'string', `errors.${code}`);
});
