// Numbered migrations: a fresh database, a real v0.2 database, and a migration that fails.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, openRaw } from '@lernlab/storage-sqlite';
import { LATEST_VERSION, MIGRATIONS, MigrationError, schemaVersion, type Migration } from '../src/migrate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-mig-'));
after(() => cleanupTempDir(dir));

const V02_SQL = readFileSync(new URL('./fixtures/v0.2.sql', import.meta.url), 'utf8');

/** A v0.2 database file, as the prototype left it on a user's disk. */
function v02Db(name: string): string {
  const file = join(dir, name, 'lernlab.db');
  mkdirSync(join(dir, name), { recursive: true });
  const raw = openRaw(file);
  raw.exec('PRAGMA foreign_keys = OFF'); // the dump lists tables alphabetically, not in key order
  raw.exec(V02_SQL);
  raw.close();
  return file;
}

const count = (file: string, table: string) => {
  const d = openRaw(file);
  try {
    return Number(d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);
  } finally {
    d.close();
  }
};

test('migration files are numbered 1, 2, 3… and named NNN-name', () => {
  MIGRATIONS.forEach((m, i) => {
    assert.equal(m.version, i + 1);
    assert.match(m.name, new RegExp(`^${String(i + 1).padStart(3, '0')}-[a-z0-9-]+$`));
  });
});

test('a fresh database gets every migration and no backup', () => {
  const file = join(dir, 'fresh', 'lernlab.db');
  const d = openDb(file);
  assert.equal(schemaVersion(d), LATEST_VERSION);
  d.close();
  assert.ok(!existsSync(join(dir, 'fresh', 'backups')), 'nothing to back up');
});

test('a v0.2 database is backed up, then migrated with all its data', () => {
  const file = v02Db('v02');
  const before = { items: count(file, 'items'), attempts: count(file, 'attempts'), srs: count(file, 'srs') };
  assert.ok(before.items > 0 && before.attempts > 0);
  const d = openDb(file);
  assert.equal(schemaVersion(d), LATEST_VERSION);
  assert.equal(Number(d.prepare('SELECT COUNT(*) AS n FROM items').get()!.n), before.items);
  assert.equal(Number(d.prepare('SELECT COUNT(*) AS n FROM attempts').get()!.n), before.attempts);
  assert.equal(d.prepare("SELECT target FROM items WHERE target = 'der Hund'").get()!.target, 'der Hund');
  d.close();
  const backups = readdirSync(join(dir, 'v02', 'backups'));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^lernlab-\d{8}-v0\.db$/);
  assert.equal(count(join(dir, 'v02', 'backups', backups[0]), 'items'), before.items, 'backup has the cards');

  // Opening again: nothing pending, no second backup.
  openDb(file).close();
  assert.equal(readdirSync(join(dir, 'v02', 'backups')).length, 1);
});

test('a failed migration restores the backup and explains what happened', () => {
  const file = v02Db('broken');
  const before = count(file, 'items');
  const broken: Migration = {
    version: LATEST_VERSION + 1,
    name: `${String(LATEST_VERSION + 1).padStart(3, '0')}-broken`,
    up: (d) => {
      d.exec("UPDATE items SET target = 'lost'");
      throw new Error('disk on fire');
    },
  };
  assert.throws(
    () => openDb(file, [...MIGRATIONS, broken]),
    (e: unknown) => {
      assert.ok(e instanceof MigrationError);
      assert.equal(e.migration, broken.name);
      assert.match(e.message, /could not update your data/);
      assert.match(e.message, /disk on fire/);
      assert.match(e.message, /Nothing was lost/);
      assert.ok(e.backupFile && existsSync(e.backupFile));
      return true;
    },
  );
  assert.equal(count(file, 'items'), before, 'cards are back');
  const d = openRaw(file);
  assert.ok(!d.prepare("SELECT 1 FROM items WHERE target = 'lost'").get(), 'the half-done change is gone');
  assert.equal(schemaVersion(d), 0, 'database is exactly as before the update');
  d.close();
});
