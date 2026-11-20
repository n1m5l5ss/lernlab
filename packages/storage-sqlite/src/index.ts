// Storage host for Node and Electron: the database on node:sqlite (built into Node 22.13+, nothing
// to compile) and media / progress files in the data folder.
import * as sqlite from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setHost, type DB, type Host } from '@lernlab/core/host';
import { migrate } from '@lernlab/core/schema';

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

/** Open a database file with LernLab's schema. */
export function openDb(file: string): DB {
  const d = new Ctor(file) as DB;
  migrate(d);
  return d;
}

let db: DB | null = null;

/** The app database in the data folder, opened once. */
export function getAppDb(file = resolve(dataDir(), 'lernlab.db')): DB {
  if (db) return db;
  mkdirSync(dirname(file), { recursive: true });
  mkdirSync(mediaDir(), { recursive: true });
  db = new Ctor(file) as DB;
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
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
