// Storage host for Node and Electron: the database on node:sqlite (built into Node 22.13+, nothing
// to compile) and media / progress files in the data folder.
import * as sqlite from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setHost, type DB, type Host } from '@lernlab/core/host';
import { migrate, schemaVersion, type Migration } from '@lernlab/core/migrate';

// Node 22–25 call the class DatabaseSync; newer releases may call it Database.
type SqliteCtor = new (file: string, options?: { readOnly?: boolean }) => DB;
const mod = sqlite as unknown as Record<string, SqliteCtor | undefined>;
const Ctor = (mod.DatabaseSync ?? mod.Database)!;

// Read lazily so the desktop app can point LERNLAB_DATA at the OS app-data folder before first use.
export const dataDir = () => resolve(process.env.LERNLAB_DATA ?? 'data');
export const mediaDir = () => resolve(dataDir(), 'media');

/** A plain SQLite handle without LernLab's schema (for reading/writing other apps' files). */
export function openRaw(file: string): DB {
  return new Ctor(file) as DB;
}

export function openReadonly(file: string): DB {
  return new Ctor(file, { readOnly: true }) as DB;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Copy the database next to it in backups/ before migrating. VACUUM INTO writes a consistent,
 * compact copy even while the database is in WAL mode.
 */
export function backupDb(d: DB, file: string, fromVersion: number, now = new Date()): string {
  const dir = resolve(dirname(file), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  let out = resolve(dir, `lernlab-${stamp}-v${fromVersion}.db`);
  // Several backups can be taken in the same second (two deletes in a row): number them.
  for (let n = 1; existsSync(out); n++)
    out = resolve(dir, `lernlab-${stamp}-${time}${n > 1 ? `-${n}` : ''}-v${fromVersion}.db`);
  d.prepare('VACUUM INTO ?').run(out);
  return out;
}

/** Put a backup back in place of the database file. Closes `d`. */
function restoreDb(d: DB, file: string, backupFile: string) {
  d.close();
  for (const suffix of ['-wal', '-shm']) rmSync(file + suffix, { force: true });
  copyFileSync(backupFile, file);
}

/**
 * Open a database file with LernLab's schema, running pending migrations with a backup first.
 * Throws MigrationError (from @lernlab/core/migrate) after restoring the backup if a migration fails.
 */
export function openDb(file: string, migrations?: Migration[]): DB {
  mkdirSync(dirname(file), { recursive: true });
  const d = new Ctor(file) as DB;
  d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(d, {
    migrations,
    backup: (fromVersion) => backupDb(d, file, fromVersion),
    restore: (backupFile) => restoreDb(d, file, backupFile),
  });
  return d;
}

let db: DB | null = null;

/** The app database in the data folder, opened once. */
export function getAppDb(file = resolve(dataDir(), 'lernlab.db')): DB {
  if (db) return db;
  mkdirSync(mediaDir(), { recursive: true });
  db = openDb(file);
  return db;
}

/** Back up the app database now (e.g. before an app update is installed). Returns the backup's path. */
export function backupAppDb(file = resolve(dataDir(), 'lernlab.db')): string {
  const d = getAppDb(file);
  return backupDb(d, file, schemaVersion(d));
}

/** Read-only copy of SQLite bytes, kept in a temp folder that is removed on close. */
function openSqliteBytes(bytes: Uint8Array): DB {
  const dir = mkdtempSync(join(tmpdir(), 'apkg-'));
  const remove = () => rmSync(dir, { recursive: true, force: true });
  try {
    const file = join(dir, 'col.db');
    writeFileSync(file, bytes);
    const d = openReadonly(file);
    return {
      exec: (sql) => d.exec(sql),
      prepare: (sql) => d.prepare(sql),
      close: () => {
        d.close();
        remove();
      },
    };
  } catch (e) {
    remove();
    throw e;
  }
}

const mediaPath = (name: string) => resolve(mediaDir(), basename(name));

export const nodeHost: Host = {
  db: () => getAppDb(),
  openSqliteBytes,
  media: {
    size: (name) => (existsSync(mediaPath(name)) ? statSync(mediaPath(name)).size : null),
    read: (name) => (existsSync(mediaPath(name)) ? readFileSync(mediaPath(name)) : null),
    write: (name, data) => writeFileSync(mediaPath(name), data),
  },
  saveProgressSnapshot(day, json) {
    const dir = resolve(dataDir(), 'progress');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${day}.json`), json);
  },
  randomId: () => randomUUID(),
};

/** Use this package as the engine's storage. Call once at startup. */
export function installNodeHost(): void {
  setHost(nodeHost);
}
