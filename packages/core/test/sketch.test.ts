// The sketch pad (#220): a learner's own drawing is kept as a picture cue for one card. It is the learner's,
// not the deck's: it never changes a grade and never travels in a deck export.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-sketch-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { itemsByIds, recordAttempt } = await import('../src/learn');
const { planSession } = await import('../src/session');
const { deleteDeck } = await import('../src/library');
const { getDb } = await import('../src/db');
const { SKETCH, removeSketch, saveSketch, sketchOf } = await import('../src/sketch');
const { fakePng } = await import('../src/sketch-samples');
after(() => cleanupTempDir(dir));

const { deck } = importFile('Animals.csv', strToU8('front,back\nder Hund,dog\ndie Katze,cat\ndas Pferd,horse\n'));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const media = () => readdirSync(join(dir, 'media')).filter((f) => f.startsWith('sketch-'));
const snapshot = () =>
  JSON.stringify([
    getDb().prepare('SELECT * FROM item_state ORDER BY item_id').all(),
    getDb().prepare('SELECT * FROM attempts ORDER BY id').all(),
  ]);

test('a sketch is saved as a PNG in the media folder and comes back with the card', () => {
  recordAttempt({ sessionId: 's', itemId: ids[0], format: 'intro', correct: true, responseMs: 1, xp: 0 });
  const before = snapshot();
  const saved = saveSketch(ids[0], fakePng(480, 320), '  a dog\nwith a bone ');
  assert.match(saved.file, /^sketch-[\w-]+\.png$/);
  assert.equal(saved.text, 'a dog with a bone');
  assert.ok(existsSync(join(dir, 'media', saved.file)));
  assert.deepEqual(sketchOf(ids[0]), saved);
  assert.deepEqual(itemsByIds([ids[0], ids[1]])[ids[0]].sketch, saved);
  assert.equal(itemsByIds([ids[0], ids[1]])[ids[1]].sketch, undefined);
  assert.equal(snapshot(), before, 'no grade, schedule or answer changes');
});

test('the session plan carries the sketch', () => {
  const plan = planSession('mini', getDb(), new Date(), deck.id);
  assert.equal({ ...plan.items, ...plan.extras }[ids[0]]?.sketch?.file, sketchOf(ids[0])?.file);
});

test('drawing again replaces the picture and its file', () => {
  const first = sketchOf(ids[0])!;
  const second = saveSketch(ids[0], fakePng(240, 160), '');
  assert.notEqual(second.file, first.file);
  assert.deepEqual(media(), [second.file]);
  assert.equal(second.text, '');
});

test('a description alone is a cue too; nothing at all is not', () => {
  assert.deepEqual(saveSketch(ids[1], null, 'a cat on a warm roof'), { file: '', text: 'a cat on a warm roof' });
  assert.throws(() => saveSketch(ids[2], null, '   '), { code: 'invalid_input' });
  assert.throws(() => saveSketch(ids[2], new Uint8Array(0), ''), { code: 'invalid_input' });
  assert.equal(sketchOf(ids[2]), null);
});

test('a bad picture is refused and nothing is written', () => {
  const files = media();
  assert.throws(() => saveSketch(ids[2], strToU8('<svg onload="x()"/>'), 'x'), { code: 'unsupported_media' });
  assert.throws(() => saveSketch(ids[2], fakePng(480, 320, SKETCH.maxBytes), 'x'), { code: 'sketch_too_big' });
  assert.throws(() => saveSketch(999_999, fakePng(480, 320), 'x'), { code: 'card_not_found' });
  assert.deepEqual(media(), files);
  assert.equal(sketchOf(ids[2]), null);
});

test('a sketch never travels in a deck export', () => {
  const file = sketchOf(ids[0])!.file;
  const csv = exportDeck(deck.id, 'csv');
  assert.ok(!strFromU8(csv.data).includes('sketch'));
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  for (const [name, data] of Object.entries(pack)) {
    assert.ok(!name.includes(file), name);
    if (/\.(json|csv)$/.test(name)) assert.ok(!strFromU8(data).includes('sketch-'), name);
  }
  const apkg = unzipSync(exportDeck(deck.id, 'apkg').data);
  assert.ok(!strFromU8(apkg.media).includes('sketch-'));
});

test('removing a sketch deletes the row and the file', () => {
  const file = sketchOf(ids[0])!.file;
  assert.deepEqual(removeSketch(ids[0]), { ok: true });
  assert.equal(sketchOf(ids[0]), null);
  assert.ok(!existsSync(join(dir, 'media', file)));
  assert.deepEqual(removeSketch(ids[0]), { ok: true }); // nothing left: still fine
});

test('deleting the deck drops its sketches', () => {
  saveSketch(ids[2], fakePng(480, 320), 'a horse');
  deleteDeck(deck.id);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM sketches').get()!.n, 0);
});
