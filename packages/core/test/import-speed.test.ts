// Importing a big deck writes its pages once (#140). Without care, the commit at the end of an import
// also runs SQLite's automatic checkpoint: it copies every page again from the write-ahead log into the
// database file and flushes both to disk, which is slow and very uneven on Windows. The import leaves
// that to the storage host, which does it soon after, outside the import.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-import-speed-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost, openDb, checkpointNow } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { setMeta } = await import('../src/db');
after(() => cleanupTempDir(dir));

const csv = (n: number, prefix: string) => {
  const rows = ['front,back,tags'];
  for (let i = 0; i < n; i++) rows.push(`${prefix} ${i},meaning number ${i} of this card,t${i % 40}`);
  return new TextEncoder().encode(`${rows.join('\n')}\n`);
};
const size = (file: string) => statSync(file).size;
const autoCheckpoint = (d: ReturnType<typeof openDb>) =>
  Number(Object.values(d.prepare('PRAGMA wal_autocheckpoint').get()!)[0]);

test('a big import does not checkpoint: the database file is written later, once (#140)', () => {
  const file = join(dir, 'speed', 'lernlab.db');
  const d = openDb(file);
  try {
    // A small automatic checkpoint, so this import would cross it many times over.
    d.exec('PRAGMA wal_autocheckpoint = 50');
    d.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    const before = size(file);

    const report = importFile('Big.csv', csv(3000, 'big'), { deckName: 'Big' }, d);
    assert.equal(report.added, 3000);
    assert.equal(size(file), before, 'the import wrote only to the write-ahead log');
    assert.ok(size(`${file}-wal`) > 0);
    // A small write right after the import (the handler saves the chosen deck) does not checkpoint either.
    setMeta(d, 'currentDeck', report.deck.id);
    assert.equal(size(file), before, 'the next commit did not checkpoint');

    // A crash now loses nothing: a copy of the files as they are opens with every card.
    const crash = join(dir, 'crash');
    mkdirSync(crash);
    copyFileSync(file, join(crash, 'lernlab.db'));
    copyFileSync(`${file}-wal`, join(crash, 'lernlab.db-wal'));
    const copy = openDb(join(crash, 'lernlab.db'));
    try {
      assert.equal(Number(copy.prepare('SELECT COUNT(*) AS n FROM items').get()!.n), 3000);
    } finally {
      copy.close();
    }

    // The host's checkpoint copies the pages in and turns automatic checkpoints back on as they were.
    checkpointNow();
    assert.ok(size(file) > before, 'the checkpoint wrote the database file');
    assert.equal(autoCheckpoint(d), 50);
    assert.equal(Number(d.prepare('SELECT COUNT(*) AS n FROM items').get()!.n), 3000);
  } finally {
    d.close();
  }
});

test('the checkpoint runs by itself soon after an import (#140)', async () => {
  const file = join(dir, 'later', 'lernlab.db');
  const d = openDb(file);
  try {
    d.exec('PRAGMA wal_autocheckpoint = 50');
    d.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    const before = size(file);
    importFile('Later.csv', csv(1000, 'later'), { deckName: 'Later' }, d);
    assert.equal(size(file), before);
    const deadline = Date.now() + 10_000;
    while (size(file) === before && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    assert.ok(size(file) > before, 'the checkpoint ran');
    assert.equal(autoCheckpoint(d), 50);
  } finally {
    d.close();
  }
});

test('a pending checkpoint on a connection that has been closed is skipped (#140)', () => {
  const file = join(dir, 'closed', 'lernlab.db');
  const d = openDb(file);
  importFile('Closed.csv', csv(200, 'closed'), { deckName: 'Closed' }, d);
  d.close();
  assert.doesNotThrow(() => checkpointNow());
  const again = openDb(file);
  try {
    assert.equal(Number(again.prepare('SELECT COUNT(*) AS n FROM items').get()!.n), 200);
  } finally {
    again.close();
  }
});
