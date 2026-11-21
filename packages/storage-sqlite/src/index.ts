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
import { LATEST_VERSION, migrate, schemaVersion, type Migration } from '@lernlab/core/migrate';
import { UserError } from '@lernlab/core/errors';

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

/** The day part of a backup's name: YYYYMMDD in local time. */
export const backupStamp = (now: Date) => `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

/**
 * Copy the database next to it in backups/ (before migrating, before deleting, daily…). VACUUM INTO
 * writes a consistent, compact copy even while the database is in WAL mode. `label` (e.g. "daily")
 * goes into the name: lernlab-YYYYMMDD[-HHMMSS[-n]][-label]-vN.db.
 */
export function backupDb(d: DB, file: string, fromVersion: number, now = new Date(), label?: string): string {
  const dir = resolve(dirname(file), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = backupStamp(now);
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const tag = label ? `-${label}` : '';
  let out = resolve(dir, `lernlab-${stamp}${tag}-v${fromVersion}.db`);
  // Several backups can be taken in the same second (two deletes in a row): number them.
  for (let n = 1; existsSync(out); n++)
    out = resolve(dir, `lernlab-${stamp}-${time}${n > 1 ? `-${n}` : ''}${tag}-v${fromVersion}.db`);
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
 * Connection settings from docs/ARCHITECTURE.md §5: WAL with NORMAL sync (safe and fast in WAL), foreign
 * keys, wait up to 5 s for a lock, temporary tables in memory and a page cache of about 20 MB.
 */
const PRAGMAS = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -20000;
`;

/** Let SQLite refresh its query planner statistics where they are stale. Cheap; run hourly and on close. */
export function optimizeDb(d: DB): void {
  d.exec('PRAGMA optimize');
}

/**
 * Open a database file with LernLab's schema, running pending migrations with a backup first.
 * Throws MigrationError (from @lernlab/core/migrate) after restoring the backup if a migration fails.
 */
export function openDb(file: string, migrations?: Migration[]): DB {
  mkdirSync(dirname(file), { recursive: true });
  const d = new Ctor(file) as DB;
  d.exec(PRAGMAS);
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

/**
 * The app database opened read-only, for the AI assistant's process (#148, docs/ARCHITECTURE.md §1). It
 * never migrates or writes: SQLite refuses any write on it. A database another version made (older: open
 * LernLab once to update it; newer: update this app) is refused, so the assistant never reads a shape it
 * does not know. The caller closes it.
 */
export function openAppDbReadonly(file = resolve(dataDir(), 'lernlab.db')): DB {
  if (!existsSync(file)) throw new UserError('assistant_no_data', 'Open LernLab once first: there is no data yet.');
  const d = openReadonly(file);
  try {
    d.exec('PRAGMA busy_timeout = 5000');
    const version = schemaVersion(d);
    if (version !== LATEST_VERSION)
      throw new UserError(
        'assistant_version',
        version < LATEST_VERSION
          ? 'Open LernLab once so it can update your data, then try again.'
          : 'Your data is from a newer LernLab. Update LernLab, then try again.',
      );
    return d;
  } catch (e) {
    d.close();
    throw e;
  }
}

/** Close the app database (to swap its file); the next getAppDb() opens it again. */
export function closeAppDb(): void {
  try {
    if (db) optimizeDb(db);
  } catch {
    // Only statistics: never stand in the way of closing.
  }
  db?.close();
  db = null;
}

/** Back up the app database now (e.g. before an app update is installed). Returns the backup's path. */
export function backupAppDb(file = resolve(dataDir(), 'lernlab.db'), label?: string, now = new Date()): string {
  const d = getAppDb(file);
  return backupDb(d, file, schemaVersion(d), now, label);
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

/** A new SQLite file in a temp folder, filled by `build`; returns its bytes and removes the folder. */
function buildSqliteBytes(build: (db: DB) => void): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), 'apkg-out-'));
  try {
    const file = join(dir, 'col.db');
    const d = openRaw(file);
    try {
      build(d);
    } finally {
      d.close();
    }
    return new Uint8Array(readFileSync(file));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const mediaPath = (name: string) => resolve(mediaDir(), basename(name));

export const nodeHost: Host = {
  db: () => getAppDb(),
  openSqliteBytes,
  buildSqliteBytes,
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
