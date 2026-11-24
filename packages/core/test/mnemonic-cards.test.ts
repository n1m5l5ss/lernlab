// Fading mnemonics (#221): a card's mnemonic travels in deck files, and cards loaded for study know how many
// times in a row they were recalled since their last miss, which decides whether the mnemonic still shows.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-mnemonic-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { allItems, itemsByIds, recordAttempt, overrideToCorrect } = await import('../src/learn');
const { mnemonicOf, showsMnemonic } = await import('../src/mnemonic');
const { csvToCards } = await import('../src/formats/csv');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const deck = createDeck('Space', null);
upsertCards(deck, [
  {
    sourceId: 'a',
    front: 'Order of the planets?',
    back: 'Mercury, Venus, Earth…',
    mnemonic: 'My Very Educated Mother…',
  },
  { sourceId: 'b', front: 'Largest planet?', back: 'Jupiter', notes: 'A note that always shows' },
]);
const [withAid, without] = allItems();
const answer = (itemId: number, correct: boolean, format = 'typed', at = new Date()) =>
  recordAttempt(
    { sessionId: 's', itemId, format, correct, responseMs: 1, xp: 0, practice: true } as never,
    getDb(),
    at,
  );
const run = () => itemsByIds([withAid.id])[withAid.id].mnemonicRun;

test('a card loaded for study carries its run: absent until a miss, then correct recalls since', () => {
  assert.equal(mnemonicOf(withAid), 'My Very Educated Mother…');
  assert.equal(run(), undefined);
  answer(withAid.id, true);
  assert.equal(run(), undefined, 'never missed');
  answer(withAid.id, false);
  assert.equal(run(), 0);
  assert.ok(showsMnemonic(withAid, run(), { attempted: true }));
  answer(withAid.id, true, 'match');
  assert.equal(run(), 0, 'a game is not a recall');
  answer(withAid.id, true);
  assert.equal(run(), 1);
  answer(withAid.id, true, 'flip');
  assert.equal(run(), 2);
  assert.ok(!showsMnemonic(withAid, run(), { attempted: true }), 'faded after two in a row');
  assert.equal(allItems().find((i) => i.id === withAid.id)?.mnemonicRun, 2, 'the session pool carries it too');
});

test('a card without a mnemonic gets no run, whatever its history', () => {
  answer(without.id, false);
  assert.ok(!('mnemonicRun' in itemsByIds([without.id])[without.id]));
});

test('"I was right" takes the miss back', () => {
  const d = getDb();
  const day = new Date('2026-12-01T10:00:00Z');
  recordAttempt({ sessionId: 's2', itemId: withAid.id, format: 'intro', correct: true, responseMs: 1, xp: 0 }, d, day);
  recordAttempt({ sessionId: 's2', itemId: withAid.id, format: 'typed', correct: false, responseMs: 1, xp: 0 }, d, day);
  assert.equal(run(), 0);
  assert.ok(overrideToCorrect(withAid.id, d, day).ok);
  assert.equal(run(), 3);
});

test('deck files: CSV and .lernpack carry the mnemonic; a "mnemonic" column is no longer a note', () => {
  const read = csvToCards('front,back,mnemonic,notes\nQ,A,Remember **this**,and a note\n').cards[0];
  assert.deepEqual([read.mnemonic, read.notes], ['Remember **this**', 'and a note']);
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /(^|,)mnemonic(,|$)/);
  assert.match(csv, /My Very Educated Mother…/);
  const pack = exportDeck(deck.id, 'lernpack');
  const jsonl = strFromU8(unzipSync(pack.data)['cards.jsonl']);
  assert.equal(JSON.parse(jsonl.split('\n')[0]).mnemonic, 'My Very Educated Mother…');
  const copy = importFile('copy.lernpack', pack.data, { deckName: 'Space copy' });
  const again = allItems().filter((i) => i.deckId === copy.deck.id);
  assert.deepEqual(again.map(mnemonicOf), ['My Very Educated Mother…', '']);
  assert.equal(again[1].notes, 'A note that always shows');
  // An older file without the field imports as before.
  const old = importFile('old.csv', strToU8('front,back\nQ,A\n'), { deckName: 'Old' });
  assert.equal(old.added, 1);
});
