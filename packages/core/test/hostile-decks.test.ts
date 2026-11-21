// Deck files built to freeze or exhaust LernLab (security review, #158). Each one must fail fast with a
// clear error, or be handled in linear time.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { strToU8, zipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';
import { compress as zstdCompress } from './zstd-test-helper';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-hostile-'));
process.env.LERNLAB_DATA = dir;
const { readApkg } = await import('../src/formats/apkg');
const { parseCloze, clozeText, replaceClozes } = await import('../src/cards');
const { codeTask } = await import('../src/code');
const { UserError } = await import('../src/errors');
const { installNodeHost, openRaw } = await import('@lernlab/storage-sqlite');
installNodeHost();
after(() => cleanupTempDir(dir));

const MODELS = JSON.stringify({
  7: {
    id: 7,
    flds: [
      { name: 'Front', ord: 0 },
      { name: 'Back', ord: 1 },
    ],
  },
});

/** An Anki package whose collection is built by `schema` (SQL run on an empty database). */
function apkg(schema: string, files: Record<string, Uint8Array> = {}, media: Record<string, string> = {}) {
  const colFile = join(dir, `col-${Math.random()}.db`);
  const db = openRaw(colFile);
  db.exec(`CREATE TABLE col (models TEXT, decks TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);`);
  db.prepare('INSERT INTO col VALUES (?, ?)').run(MODELS, JSON.stringify({ 5: { id: 5, name: 'Evil' } }));
  db.exec(schema);
  db.close();
  return zipSync({
    'collection.anki2': new Uint8Array(readFileSync(colFile)),
    media: strToU8(JSON.stringify(media)),
    ...files,
  });
}

function failsWith(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof UserError) return e.code;
    throw e;
  }
  return 'no error';
}

test('an Anki collection whose notes are an endless view is refused at once', () => {
  const evil = apkg(`CREATE VIEW notes AS
    WITH RECURSIVE r(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM r)
    SELECT id, 7 AS mid, '' AS tags, 'a' || char(31) || 'b' AS flds FROM r;`);
  const started = Date.now();
  assert.equal(
    failsWith(() => readApkg(evil)),
    'anki_damaged',
  );
  assert.ok(Date.now() - started < 2000, 'answers within 2 s');
});

test('triggers in an Anki collection are refused too', () => {
  const evil = apkg(`CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TRIGGER t AFTER INSERT ON notes BEGIN SELECT 1; END;`);
  assert.equal(
    failsWith(() => readApkg(evil)),
    'anki_damaged',
  );
});

test('a zstd media bomb in an Anki package is stopped at the size limit for its kind', () => {
  // 25 MB of zeros packs into a few hundred bytes; an image may be 20 MB.
  const bomb = zstdCompress(new Uint8Array(25 * 1024 * 1024));
  assert.ok(bomb.length < 10_000);
  const evil = apkg(
    `CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
     INSERT INTO notes VALUES (1, 7, '', 'France' || char(31) || '<img src="map.png">');
     INSERT INTO cards VALUES (10, 1, 5, 0);`,
    { '0': bomb },
    { 0: 'map.png' },
  );
  assert.equal(
    failsWith(() => readApkg(evil)),
    'zip_too_big',
  );
});

test('cloze parsing is linear: a card full of unclosed {{c1:: no longer freezes a session', () => {
  const evil = '{{c1::'.repeat(20_000) + '}}'.padStart(3, 'x');
  const started = Date.now();
  parseCloze(evil);
  clozeText(evil);
  replaceClozes(evil, (c) => c.answer, true);
  codeTask({ kind: 'code', meaning: '', extra: { code: evil } });
  assert.ok(Date.now() - started < 500, `took ${Date.now() - started} ms`);
});

// The scanner must match exactly what the old regexes matched, on ordinary and odd text.
const OLD_ONE_LINE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;
const OLD_MULTILINE = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
const piece = fc.constantFrom('{{c1::', '{{c12::', '::', '}}', '}', '{', 'a', 'b ', '\n', '\r', '<b>', 'c1', ':');

test('cloze scanner gives the same answers as the old regex', () => {
  fc.assert(
    fc.property(fc.array(piece, { maxLength: 30 }), (parts) => {
      const s = parts.join('');
      assert.equal(clozeText(s), s.replace(OLD_ONE_LINE, '$2'));
      assert.equal(
        replaceClozes(s, (c) => `[${c.answer}|${c.hint ?? '-'}]`),
        s.replace(OLD_ONE_LINE, (_m, _n, a: string, h?: string) => `[${a}|${h ?? '-'}]`),
      );
      assert.equal(replaceClozes(s, undefined, true), s.replace(OLD_MULTILINE, '$1'));
      const old = new RegExp(OLD_ONE_LINE.source).exec(s);
      const now = parseCloze(s);
      assert.equal(now === null, old === null);
    }),
    { numRuns: 2000 },
  );
});
