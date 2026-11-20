// Keeping the user's data safe and in their hands: the daily backup, restoring a backup, exporting
// and importing everything as one zip, and deleting all data. Every step that replaces or removes
// the database takes a backup first, so it can be undone from backups/.
//
// Retention: only automatic daily backups ("-daily-") are pruned, to the newest 7. Backups made by
// the user, before an update, before a migration or before a delete/restore/import are never
// removed by the app.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { DB } from '@lernlab/core/host';
import { LATEST_VERSION, schemaVersion } from '@lernlab/core/migrate';
import { UserError } from '@lernlab/core/errors';
import { BUNDLE_FORMAT, BUNDLE_VERSION, packDataBundle, unpackDataBundle } from '@lernlab/core/formats/databundle';
import { backupAppDb, backupStamp, closeAppDb, dataDir, getAppDb, mediaDir, openReadonly } from './index';

export const DAILY_KEEP = 7;
const appFile = () => resolve(dataDir(), 'lernlab.db');
export const backupsDir = () => resolve(dataDir(), 'backups');
const progressDir = () => resolve(dataDir(), 'progress');

/** lernlab-YYYYMMDD[-HHMMSS[-n]][-label]-vN.db */
const NAME = /^lernlab-(\d{8})(?:-\d{6}(?:-\d+)?)?(?:-([a-z][a-z-]*))?-v(\d+)\.db$/;

export type Counts = { decks: number; cards: number; reviews: number };
export type BackupInfo = {
  file: string;
  /** When the copy was written (ISO time). */
  date: string;
  /** Why it was made: daily, before-update, before-delete… or null for a manual / pre-migration copy. */
  label: string | null;
  size: number;
  schemaVersion: number;
  counts: Counts | null;
};

const count = (d: DB, table: string) =>
  d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
    ? Number(d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n)
    : 0;

export const countsOf = (d: DB): Counts => ({
  decks: count(d, 'decks'),
  cards: count(d, 'items'),
  reviews: count(d, 'attempts'),
});

const notBackup = () => new UserError('not_a_backup', 'This file is not a LernLab backup.');

/** Open a database file read-only and check it is LernLab data this version can use. */
function inspect(file: string): { schemaVersion: number; counts: Counts } {
  let d: DB;
  try {
    d = openReadonly(file);
  } catch {
    throw notBackup();
  }
  try {
    const version = schemaVersion(d);
    if (!d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'items'").get()) throw notBackup();
    if (version > LATEST_VERSION)
      throw new UserError('backup_too_new', 'This backup needs a newer version of LernLab.');
    return { schemaVersion: version, counts: countsOf(d) };
  } catch (e) {
    throw e instanceof UserError ? e : notBackup();
  } finally {
    d.close();
  }
}

/** Every backup, newest first, with its date and what is in it (read without changing it). */
export function listBackups(): BackupInfo[] {
  const dir = backupsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((file) => ({ file, m: NAME.exec(file) }))
    .filter((x): x is { file: string; m: RegExpExecArray } => !!x.m)
    .map(({ file, m }) => {
      const st = statSync(join(dir, file));
      let found: ReturnType<typeof inspect> | null = null;
      try {
        found = inspect(join(dir, file));
      } catch {
        // Listed without counts; restoring it explains the problem.
      }
      return {
        file,
        date: st.mtime.toISOString(),
        label: m[2] ?? null,
        size: st.size,
        schemaVersion: found?.schemaVersion ?? Number(m[3]),
        counts: found?.counts ?? null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.file.localeCompare(a.file));
}

/**
 * Take today's automatic backup unless there is one already, then keep only the newest `keep` daily
 * backups. Returns the new backup's name, or null if today's existed.
 */
export function dailyBackup(now = new Date(), keep = DAILY_KEEP): string | null {
  const dir = backupsDir();
  const daily = () => (existsSync(dir) ? readdirSync(dir) : []).filter((f) => NAME.exec(f)?.[2] === 'daily').sort();
  const today = `lernlab-${backupStamp(now)}-`;
  const made = daily().some((f) => f.startsWith(today)) ? null : basename(backupAppDb(appFile(), 'daily', now));
  const all = daily();
  for (const f of all.slice(0, Math.max(0, all.length - keep))) rmSync(join(dir, f), { force: true });
  return made;
}

/** Put another database file in place of the app's, then open it (running migrations if it is older). */
function swapIn(source: string, safety: string) {
  const file = appFile();
  const put = (from: string) => {
    closeAppDb();
    for (const suffix of ['-wal', '-shm']) rmSync(file + suffix, { force: true });
    copyFileSync(from, file);
    getAppDb(file);
  };
  try {
    put(source);
  } catch (e) {
    put(safety);
    throw e;
  }
}

/** Restore a backup from backups/. The current data is backed up first; returns that backup's name. */
export function restoreBackup(name: string): { safety: string; counts: Counts } {
  if (!NAME.test(name) || !existsSync(join(backupsDir(), name)))
    throw new UserError('backup_not_found', 'That backup no longer exists.');
  const source = join(backupsDir(), name);
  const { counts } = inspect(source);
  const safety = backupAppDb(appFile(), 'before-restore');
  swapIn(source, safety);
  return { safety: basename(safety), counts };
}

const files = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()) : []);

/** Everything in one zip: the database, media and daily progress files. */
export function exportAllData(now = new Date()): { name: string; data: Uint8Array; type: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'lernlab-export-'));
  try {
    const snapshot = join(tmp, 'lernlab.db');
    const d = getAppDb(appFile());
    d.prepare('VACUUM INTO ?').run(snapshot);
    const read = (dir: string) => Object.fromEntries(files(dir).map((f) => [f, readFileSync(join(dir, f))]));
    const data = packDataBundle({
      manifest: {
        format: BUNDLE_FORMAT,
        version: BUNDLE_VERSION,
        createdAt: now.toISOString(),
        schemaVersion: schemaVersion(d),
        counts: countsOf(d),
      },
      db: readFileSync(snapshot),
      media: read(mediaDir()),
      progress: Object.fromEntries(Object.entries(read(progressDir())).filter(([f]) => f.endsWith('.json'))),
    });
    return { name: `lernlab-data-${backupStamp(now)}.zip`, data, type: 'application/zip' };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Replace all data with an export made by exportAllData. The current data is backed up first. */
export function importAllData(bytes: Uint8Array): { safety: string; counts: Counts } {
  const bundle = unpackDataBundle(bytes);
  const tmp = mkdtempSync(join(tmpdir(), 'lernlab-import-'));
  try {
    const source = join(tmp, 'lernlab.db');
    writeFileSync(source, bundle.db);
    const { counts } = inspect(source);
    const safety = backupAppDb(appFile(), 'before-import');
    swapIn(source, safety);
    mkdirSync(progressDir(), { recursive: true });
    // Names were checked to be plain file names; basename() is a second guard.
    for (const [name, data] of Object.entries(bundle.media)) writeFileSync(join(mediaDir(), basename(name)), data);
    for (const [name, data] of Object.entries(bundle.progress))
      writeFileSync(join(progressDir(), basename(name)), data);
    return { safety: basename(safety), counts };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Delete decks, cards, progress, settings, media and daily summaries, and start empty. A last backup
 * is kept in backups/ so this can be undone; delete that folder to remove everything.
 */
export function deleteAllData(): { backup: string } {
  const backup = basename(backupAppDb(appFile(), 'before-delete-all'));
  closeAppDb();
  for (const suffix of ['', '-wal', '-shm']) rmSync(appFile() + suffix, { force: true });
  rmSync(mediaDir(), { recursive: true, force: true });
  rmSync(progressDir(), { recursive: true, force: true });
  getAppDb(appFile());
  return { backup };
}
