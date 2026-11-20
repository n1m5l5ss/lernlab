// Local database using Node's built-in SQLite (no install needed; Node >= 22.13).
import * as sqlite from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Node 22–25 call the class DatabaseSync; newer releases may call it Database.
const Ctor: any = (sqlite as any).DatabaseSync ?? (sqlite as any).Database;

// Read lazily so the desktop app can point LERNLAB_DATA at the OS app-data folder before first use.
export const dataDir = () => resolve(process.env.LERNLAB_DATA ?? 'data');
export const mediaDir = () => resolve(dataDir(), 'media');

export type DB = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...p: any[]): any;
    get(...p: any[]): any;
    all(...p: any[]): any[];
  };
  close(): void;
};

let db: DB | null = null;

export function getDb(file = resolve(dataDir(), 'lernlab.db')): DB {
  if (db) return db;
  mkdirSync(dirname(file), { recursive: true });
  mkdirSync(mediaDir(), { recursive: true });
  db = new Ctor(file) as DB;
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

/** A plain SQLite handle without LernLab's schema (for reading/writing other apps' files). */
export function openRaw(file: string): DB {
  return new Ctor(file) as DB;
}

export function openReadonly(file: string): DB {
  return new Ctor(file, { readOnly: true }) as DB;
}

export function openDb(file: string): DB {
  const d = new Ctor(file) as DB;
  migrate(d);
  return d;
}

function migrate(d: DB) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      deck TEXT NOT NULL,
      kind TEXT NOT NULL,
      target TEXT NOT NULL,
      article TEXT,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      sentence_html TEXT NOT NULL,
      sentence TEXT NOT NULL,
      sentence_meaning TEXT NOT NULL,
      grammar TEXT NOT NULL,
      notes TEXT NOT NULL,
      audio TEXT,
      rank INTEGER NOT NULL,
      tags TEXT NOT NULL,
      grp TEXT,
      ord INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS srs (
      item_id INTEGER PRIMARY KEY REFERENCES items(id),
      card TEXT NOT NULL,
      due TEXT NOT NULL,
      introduced_day TEXT NOT NULL,
      last_graded_day TEXT,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS item_state (
      item_id INTEGER PRIMARY KEY REFERENCES items(id),
      mastery INTEGER NOT NULL DEFAULT 0,
      seen INTEGER NOT NULL DEFAULT 0,
      right INTEGER NOT NULL DEFAULT 0,
      wrong INTEGER NOT NULL DEFAULT 0,
      gender_seen INTEGER NOT NULL DEFAULT 0,
      gender_right INTEGER NOT NULL DEFAULT 0,
      last_wrong_day TEXT,
      spoken_days TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      day TEXT NOT NULL,
      session_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      format TEXT NOT NULL,
      correct INTEGER NOT NULL,
      near_miss INTEGER NOT NULL DEFAULT 0,
      article_error INTEGER NOT NULL DEFAULT 0,
      used_hint INTEGER NOT NULL DEFAULT 0,
      response_ms INTEGER NOT NULL,
      given TEXT,
      xp INTEGER NOT NULL DEFAULT 0,
      grade INTEGER
    );
    CREATE INDEX IF NOT EXISTS attempts_day ON attempts(day);
    CREATE INDEX IF NOT EXISTS attempts_item ON attempts(item_id);
    CREATE TABLE IF NOT EXISTS days (
      day TEXT PRIMARY KEY,
      xp INTEGER NOT NULL DEFAULT 0,
      sessions INTEGER NOT NULL DEFAULT 0,
      seconds INTEGER NOT NULL DEFAULT 0,
      goal_met INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      length TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      seconds INTEGER NOT NULL DEFAULT 0,
      summary TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      language TEXT,
      description TEXT NOT NULL DEFAULT '',
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);
  // v0.2: cards belong to decks and may carry images, video/GIF, a category and free-form extras.
  const cols = new Set(d.prepare('PRAGMA table_info(items)').all().map((c: any) => c.name));
  const add = (name: string, type: string) => { if (!cols.has(name)) d.exec(`ALTER TABLE items ADD COLUMN ${name} ${type}`); };
  add('deck_id', 'INTEGER');
  add('image', 'TEXT');
  add('video', 'TEXT');
  add('category', 'TEXT');
  add('extra', "TEXT NOT NULL DEFAULT '{}'");
  add('starred', 'INTEGER NOT NULL DEFAULT 0');
  const scols = new Set(d.prepare('PRAGMA table_info(srs)').all().map((c: any) => c.name));
  if (!scols.has('prev_card')) d.exec('ALTER TABLE srs ADD COLUMN prev_card TEXT');
  if (!scols.has('prev_due')) d.exec('ALTER TABLE srs ADD COLUMN prev_due TEXT');
  d.exec('CREATE INDEX IF NOT EXISTS items_deck ON items(deck_id)');
  migrateLegacyDeck(d);
}

/** v0.1 stored one German deck without a decks table: give those cards a proper deck. */
function migrateLegacyDeck(d: DB) {
  const orphan = d.prepare('SELECT COUNT(*) AS n FROM items WHERE deck_id IS NULL').get();
  if (!Number(orphan.n)) return;
  const settings = getMeta<any>(d, 'settings', {});
  const source = settings.deck ?? 'Lang::German';
  const german = /german|deutsch/i.test(source);
  const name = german ? 'German' : source.split('::').pop();
  d.prepare(
    `INSERT OR IGNORE INTO decks(name, language, settings, created_at) VALUES (?, ?, ?, ?)`,
  ).run(name, german ? 'de' : null, JSON.stringify({
    newPerDay: settings.newPerDay ?? 10,
    ankiSource: source,
    goal: german ? { label: 'Goethe B1', words: 2400, hoursLow: 260, hoursHigh: 490, tag: 'exam_goethe_b1' } : undefined,
  }), new Date().toISOString());
  const deck = d.prepare('SELECT id FROM decks WHERE name = ?').get(name);
  d.prepare('UPDATE items SET deck_id = ? WHERE deck_id IS NULL').run(deck.id);
  if (!getMeta(d, 'activeDeck', null)) setMeta(d, 'activeDeck', Number(deck.id));
}

export function getMeta<T>(d: DB, key: string, fallback: T): T {
  const row = d.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? (JSON.parse(row.value) as T) : fallback;
}

export function setMeta(d: DB, key: string, value: unknown) {
  d.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    JSON.stringify(value),
  );
}

export function tx<T>(d: DB, fn: () => T): T {
  d.exec('BEGIN');
  try {
    const r = fn();
    d.exec('COMMIT');
    return r;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}
