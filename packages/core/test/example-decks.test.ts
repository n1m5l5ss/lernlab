// The example decks in examples/ import cleanly, and each .lernpack is in step with its folder in examples/decks/.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-examples-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { csvToCards } = await import('../src/formats/csv');
const { rowToItem } = await import('../src/learn');
const { qa } = await import('../src/cards');
const { checkAnswer } = await import('../src/text');
const { planSession } = await import('../src/session');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const examples = join(import.meta.dirname, '..', '..', '..', 'examples');
const read = (path: string) => new Uint8Array(readFileSync(join(examples, path)));

/** The three polished decks (a language, a certification, a science), each shipped as a folder and a .lernpack. */
const POLISHED = [
  { folder: 'spanish-first-conversations', language: 'es', kinds: ['mcq', 'cloze'] },
  { folder: 'networking-essentials', language: null, kinds: ['mcq', 'cloze', 'order'] },
  { folder: 'chemistry-first-20-elements', language: null, kinds: ['mcq', 'cloze', 'order'] },
];

function zipFolder(folder: string, base = folder, files: Zippable = {}): Zippable {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) zipFolder(path, base, files);
    else files[relative(base, path).split('\\').join('/')] = new Uint8Array(readFileSync(path));
  }
  return files;
}

const itemsOf = (deckId: number) =>
  getDb().prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord').all(deckId).map(rowToItem);

for (const { folder, language, kinds } of POLISHED) {
  test(`${folder}: the folder imports with no skipped rows, and its .lernpack updates the same cards`, () => {
    const manifest = JSON.parse(strFromU8(read(`decks/${folder}/manifest.json`)));
    const rows = csvToCards(strFromU8(read(`decks/${folder}/cards.csv`))).cards;
    assert.ok(rows.length >= 30, 'a polished deck has at least 30 cards');
    assert.ok(
      rows.every((c) => c.sourceId),
      'every row has an id, so a fixed card updates in place',
    );

    const fromFolder = importFile(`${folder}.zip`, zipSync(zipFolder(join(examples, 'decks', folder))));
    assert.equal(fromFolder.format, 'lernpack');
    assert.equal(fromFolder.skippedCount, 0, JSON.stringify(fromFolder.skipped));
    assert.equal(fromFolder.added, rows.length);
    assert.equal(fromFolder.mediaMissing, 0);
    assert.deepEqual(fromFolder.warnings, []);
    assert.equal(fromFolder.deck.name, manifest.deck.name);
    assert.equal(fromFolder.deck.language, language);

    const pack = read(`${folder}.lernpack`);
    const packed = JSON.parse(strFromU8(unzipSync(pack)['manifest.json']));
    assert.equal(packed.deck.name, manifest.deck.name);
    assert.equal(packed.cards, rows.length);
    const fromPack = importFile(`${folder}.lernpack`, pack);
    assert.equal(fromPack.format, 'lernpack');
    assert.deepEqual(
      [fromPack.added, fromPack.updated, fromPack.skippedCount],
      [0, rows.length, 0],
      'the .lernpack has the same cards as the folder: rebuild it with scripts/build-example-lernpack.ts',
    );

    const items = itemsOf(fromPack.deck.id);
    for (const kind of kinds)
      assert.ok(
        items.some((i) => i.kind === kind),
        `has a ${kind} card`,
      );
    const plan = planSession('standard', getDb(), new Date(), fromPack.deck.id);
    assert.ok(plan.blocks.length > 0, 'a session can be planned');
  });
}

test('the Spanish deck accepts answers typed without accents or ¿', () => {
  const deck = importFile('spanish.lernpack', read('spanish-first-conversations.lernpack')).deck;
  const items = itemsOf(deck.id);
  const accepts = (front: string, typed: string) => {
    const item = items.find((i) => i.target === front);
    assert.ok(item, front);
    assert.ok(checkAnswer(typed, qa(item).accepted).correct, `${typed} for ${front}`);
  };
  accepts('el día', 'el dia');
  accepts('el niño', 'el nino');
  accepts('¿Cómo te llamas?', 'como te llamas');
  accepts('¿Cuánto cuesta?', 'Cuánto cuesta?');
  accepts('perdón', 'perdon');
});

test('the template deck (folder and zip) has every column of the CSV template, with an explain card', async () => {
  const { CSV_TEMPLATE } = await import('../src/csvtemplate');
  const columns = CSV_TEMPLATE.split('\n')[0].split(',');
  const folder = strFromU8(read('decks/template/cards.csv'));
  const zipped = strFromU8(unzipSync(read('downloads/template.zip'))['template/cards.csv']);
  assert.equal(zipped, folder, 'rebuild with scripts/build_sample_decks.py');
  const header = folder.split(/\r?\n/)[0].split(',');
  for (const c of columns) assert.ok(header.includes(c), `the template deck is missing the column ${c}`);
  const r = importFile('template.zip', read('downloads/template.zip'));
  assert.equal(r.added + r.updated, 4);
});

test('every other example file in examples/ imports with no skipped rows', () => {
  const files = [
    ...readdirSync(examples).filter((f) => /\.(csv|tsv|lernpack)$/.test(f)),
    ...readdirSync(join(examples, 'downloads')).map((f) => `downloads/${f}`),
  ];
  assert.ok(files.length >= 10);
  for (const file of files) {
    const r = importFile(file.split('/').pop()!, read(file));
    assert.equal(r.skippedCount, 0, `${file}: ${JSON.stringify(r.skipped)}`);
    // The template names example media files on purpose, for people to replace.
    if (!file.includes('template')) assert.equal(r.mediaMissing, 0, `${file}: ${r.missingMedia.join(', ')}`);
    assert.ok(r.added + r.updated > 0, file);
  }
});
