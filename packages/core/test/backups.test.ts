// Backups, restore, export everything, delete all data (#33): the user never loses progress and stays in control.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-backups-'));
process.env.LERNLAB_DATA = dir;
const storage = await import('@lernlab/storage-sqlite');
storage.installNodeHost();
const { dailyBackup, listBackups, restoreBackup, exportAllData, importAllData, deleteAllData } =
  await import('@lernlab/storage-sqlite/backups');
const { importFile } = await import('../src/importer');
const { createDeck } = await import('../src/library');
const { getDb } = await import('../src/db');
const { unpackDataBundle, packDataBundle, bundlePath } = await import('../src/formats/databundle');
const { UserError } = await import('../src/errors');
after(() => cleanupTempDir(dir));

const backups = () => readdirSync(join(dir, 'backups')).sort();
const deckCount = () => Number(getDb().prepare('SELECT COUNT(*) AS n FROM decks').get()!.n);
const day = (d: number) => new Date(2026, 0, d, 9, 0, 0);

importFile('World.csv', strToU8('front,back\nParis,France\nBerlin,Germany\n'));

test('one automatic backup a day, and only the newest 7 daily ones are kept', () => {
  assert.match(dailyBackup(day(1))!, /^lernlab-20260101-daily-v\d+\.db$/);
  assert.equal(dailyBackup(day(1)), null, 'a second start the same day makes no second copy');
  storage.backupAppDb(undefined, 'before-update', day(1)); // kept: not a daily one
  for (let d = 2; d <= 10; d++) dailyBackup(day(d));
  const daily = backups().filter((f) => f.includes('-daily-'));
  assert.equal(daily.length, 7);
  assert.ok(daily[0].startsWith('lernlab-20260104-'), 'the oldest daily copies go first');
  assert.ok(
    backups().some((f) => f.includes('-before-update-')),
    'pre-update backups are never pruned',
  );
});

test('the backup list shows each date and what it holds, read without changing it', () => {
  const list = listBackups();
  assert.equal(list.length, 8);
  const daily = list.find((b) => b.label === 'daily')!;
  assert.deepEqual(daily.counts, { decks: 1, cards: 2, reviews: 0 });
  assert.ok(!Number.isNaN(Date.parse(daily.date)));
  assert.equal(list.find((b) => b.label === 'before-update')!.label, 'before-update');
  writeFileSync(join(dir, 'backups', 'lernlab-20260101-broken-v2.db'), 'not sqlite');
  writeFileSync(join(dir, 'backups', 'notes.txt'), 'ignored');
  const again = listBackups();
  assert.equal(again.length, 9, 'other files are not listed');
  assert.equal(again.find((b) => b.label === 'broken')!.counts, null, 'an unreadable copy is listed without counts');
});

test('restoring a backup brings its data back, after saving the current data', () => {
  const name = listBackups().find((b) => b.label === 'daily')!.file;
  createDeck('Added later', null);
  assert.equal(deckCount(), 2);
  const r = restoreBackup(name);
  assert.equal(deckCount(), 1, 'the open database is the restored one');
  assert.deepEqual(r.counts, { decks: 1, cards: 2, reviews: 0 });
  assert.match(r.safety, /-before-restore-v\d+\.db$/);
  restoreBackup(r.safety);
  assert.equal(deckCount(), 2, 'the safety copy undoes the restore');
  for (const bad of ['../lernlab.db', 'lernlab-20260101-gone-v2.db', 'lernlab-20260101-broken-v2.db'])
    assert.throws(() => restoreBackup(bad), UserError);
  assert.equal(deckCount(), 2, 'a failed restore changes nothing');
});

test('export everything as one zip, and import it back', () => {
  mkdirSync(join(dir, 'media'), { recursive: true });
  writeFileSync(join(dir, 'media', 'pic.png'), new Uint8Array([1, 2, 3]));
  mkdirSync(join(dir, 'progress'), { recursive: true });
  writeFileSync(join(dir, 'progress', '2026-01-01.json'), '{"xp":5}');
  const out = exportAllData(day(11));
  assert.equal(out.name, 'lernlab-data-20260111.zip');
  const bundle = unpackDataBundle(out.data);
  assert.deepEqual(bundle.manifest.counts, { decks: 2, cards: 2, reviews: 0 });
  assert.deepEqual([...bundle.media['pic.png']], [1, 2, 3]);

  const before = backups().length;
  deleteAllData();
  assert.equal(deckCount(), 0);
  const r = importAllData(out.data);
  assert.equal(deckCount(), 2);
  assert.deepEqual(r.counts, { decks: 2, cards: 2, reviews: 0 });
  assert.deepEqual([...readFileSync(join(dir, 'media', 'pic.png'))], [1, 2, 3]);
  assert.equal(readFileSync(join(dir, 'progress', '2026-01-01.json'), 'utf8'), '{"xp":5}');
  assert.ok(backups().length >= before + 2, 'delete and import each backed up first');
});

test('an imported zip is untrusted: odd paths, other zips and bombs are refused', () => {
  const db = unpackDataBundle(exportAllData().data).db;
  const manifest = strToU8(JSON.stringify({ format: 'lernlab-data', version: 1 }));
  for (const evil of [
    '../evil.sh',
    'media/../../evil',
    'media/a/b.png',
    '/etc/passwd',
    'progress/x.sh',
    'C:\\x',
    'media/a\u0001b',
    'media/c:d.png',
  ])
    assert.throws(
      () => unpackDataBundle(zipSync({ 'manifest.json': manifest, 'lernlab.db': db, [evil]: strToU8('x') })),
      UserError,
      evil,
    );
  assert.throws(() => bundlePath('media/..'), UserError);
  assert.throws(() => unpackDataBundle(zipSync({ 'cards.csv': strToU8('a,b') })), UserError, 'a deck zip');
  assert.throws(() => unpackDataBundle(strToU8('not a zip')), UserError);
  assert.throws(() => unpackDataBundle(zipSync({ 'manifest.json': manifest, 'lernlab.db': strToU8('x') })), UserError);
  const big = packDataBundle({
    manifest: unpackDataBundle(exportAllData().data).manifest,
    db,
    media: { 'a.bin': new Uint8Array(4096) },
    progress: {},
  });
  assert.throws(() => unpackDataBundle(big, 1024), /too large/);
  const newer = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format: 'lernlab-data', version: 99 })),
    'lernlab.db': db,
  });
  assert.throws(
    () => unpackDataBundle(newer),
    (e: InstanceType<typeof UserError>) => e.code === 'data_export_too_new',
  );
  assert.equal(deckCount(), 2);
});

test('delete all data clears decks, media and progress, and keeps a last backup', () => {
  const { backup } = deleteAllData();
  assert.match(backup, /-before-delete-all-v\d+\.db$/);
  assert.equal(deckCount(), 0);
  assert.ok(!existsSync(join(dir, 'media', 'pic.png')));
  assert.ok(!existsSync(join(dir, 'progress')));
  assert.ok(existsSync(join(dir, 'backups', backup)));
  restoreBackup(backup);
  assert.equal(deckCount(), 2, 'and that backup can bring everything back');
});
