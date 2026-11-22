// Other people who study on this computer (#224). Each has a name and their own data set in
// learners/<id>/: a progress database (schedule, answers, streak, XP), daily summaries and backups.
//
// The cards stay in one place, the app database. A learner's connection attaches it read-only and reads
// `items` and `decks` from there through temporary views, so the engine runs unchanged on it and can never
// write the app database: the views refuse writes, and so does the read-only attachment. Nothing about the
// app database changes when this feature is used, and nothing here runs when it is not.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DB } from '@lernlab/core/host';
import { schemaVersion } from '@lernlab/core/migrate';
import { UserError } from '@lernlab/core/errors';
import { stripHtml } from '@lernlab/core/text';
import { actAs, backupDb, backupStamp, dataDir, getAppDb, onAppDbClose, openDb } from './index';

export type Learner = { id: string; name: string; createdAt: string };
/** At most this many other learners: a household, not a class. */
export const LEARNERS_MAX = 5;
export const LEARNER_NAME_MAX = 40;
const DAILY_KEEP = 7;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const learnersDir = () => resolve(dataDir(), 'learners');
const listFile = () => join(learnersDir(), 'learners.json');
const learnerDir = (id: string) => join(learnersDir(), id);
const learnerFile = (id: string) => join(learnerDir(id), 'lernlab.db');

/** A name as plain text on one line. */
export const cleanLearnerName = (name: string) =>
  stripHtml(String(name)).replace(/\s+/g, ' ').trim().slice(0, LEARNER_NAME_MAX).trim();

/** The other learners on this computer. The list file may have been edited by hand: only sound entries count. */
export function listLearners(): Learner[] {
  let saved: unknown;
  try {
    saved = JSON.parse(readFileSync(listFile(), 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(saved)) return [];
  const out: Learner[] = [];
  for (const l of saved as Partial<Learner>[]) {
    const name = typeof l?.name === 'string' ? cleanLearnerName(l.name) : '';
    if (typeof l?.id !== 'string' || !ID.test(l.id) || !name || out.some((o) => o.id === l.id)) continue;
    out.push({ id: l.id, name, createdAt: String(l.createdAt ?? '').slice(0, 40) });
    if (out.length === LEARNERS_MAX) break;
  }
  return out;
}

function save(list: Learner[]) {
  mkdirSync(learnersDir(), { recursive: true });
  // Written beside the list and moved over it, so a crash never leaves half a list.
  writeFileSync(`${listFile()}.tmp`, JSON.stringify(list, null, 2));
  renameSync(`${listFile()}.tmp`, listFile());
}

export function addLearner(name: string, now = new Date()): Learner {
  const clean = cleanLearnerName(name);
  if (!clean) throw new UserError('learner_name_required', 'Name required');
  const list = listLearners();
  if (list.length >= LEARNERS_MAX)
    throw new UserError('learners_full', `At most ${LEARNERS_MAX} other people can be added.`);
  if (list.some((l) => l.name.toLowerCase() === clean.toLowerCase()))
    throw new UserError('learner_exists', 'There is already someone with this name.');
  const learner = { id: randomUUID(), name: clean, createdAt: now.toISOString() };
  save([...list, learner]);
  return learner;
}

const open = new Map<string, DB>();

function close(id?: string) {
  for (const [key, d] of open) {
    if (id && key !== id) continue;
    try {
      d.close();
    } catch {
      // Already closed.
    }
    open.delete(key);
  }
}
// A learner's connection reads the app database: when that file is swapped (restore, import, delete), it goes first.
onAppDbClose(() => close());

const need = (id: string): Learner => {
  const learner = ID.test(id) ? listLearners().find((l) => l.id === id) : undefined;
  if (!learner) throw new UserError('learner_not_found', 'This person is no longer on this computer.');
  return learner;
};

/**
 * A learner's database with the app's cards in view. Opening runs pending migrations on the learner's own
 * file, with a backup beside it first, like the app database. `fresh` opens it anew, so nothing remembered
 * on the connection is older than the cards.
 */
export function learnerDb(id: string, fresh = false): DB {
  need(id);
  if (fresh) close(id);
  const had = open.get(id);
  if (had) return had;
  const appFile = resolve(dataDir(), 'lernlab.db');
  getAppDb(appFile); // the cards exist and are migrated before anyone reads them
  const d = openDb(learnerFile(id));
  try {
    // The learner's own tables point at cards in the other file, which SQLite's foreign keys cannot follow.
    d.exec('PRAGMA foreign_keys = OFF');
    try {
      d.prepare('ATTACH DATABASE ? AS lib').run(`${pathToFileURL(appFile).href}?mode=ro`);
    } catch {
      d.prepare('ATTACH DATABASE ? AS lib').run(appFile);
    }
    d.exec('CREATE TEMP VIEW items AS SELECT * FROM lib.items; CREATE TEMP VIEW decks AS SELECT * FROM lib.decks;');
  } catch (e) {
    d.close();
    throw e;
  }
  open.set(id, d);
  return d;
}

/** Run one engine request as this learner: it reads the shared cards and writes only their own progress. */
export function asLearner<T>(id: string, fn: () => T, fresh = false): T {
  return actAs({ db: learnerDb(id, fresh), dir: learnerDir(id) }, fn);
}

/** Remove a learner with their progress, daily summaries and backups. This cannot be undone. */
export function removeLearner(id: string): { ok: true } {
  need(id);
  close(id);
  save(listLearners().filter((l) => l.id !== id));
  rmSync(learnerDir(id), { recursive: true, force: true });
  return { ok: true };
}

/** Close every learner connection (before the learners folder is deleted). */
export const closeLearners = () => close();

/**
 * Today's automatic backup of each learner's progress, in their own backups/ folder (the newest 7 daily
 * copies are kept). A learner who has never studied has no database yet and is skipped.
 */
export function dailyLearnerBackups(now = new Date()): number {
  let made = 0;
  for (const { id } of listLearners()) {
    if (!existsSync(learnerFile(id))) continue;
    const dir = join(learnerDir(id), 'backups');
    const daily = () => (existsSync(dir) ? readdirSync(dir) : []).filter((f) => f.includes('-daily-')).sort();
    if (!daily().some((f) => f.startsWith(`lernlab-${backupStamp(now)}-`))) {
      // A plain connection to their file: the copy is made without the app's cards in view.
      const d = openDb(learnerFile(id));
      try {
        backupDb(d, learnerFile(id), schemaVersion(d), now, 'daily');
      } finally {
        d.close();
      }
      made++;
    }
    const all = daily();
    for (const f of all.slice(0, Math.max(0, all.length - DAILY_KEEP))) rmSync(join(dir, f), { force: true });
  }
  return made;
}
