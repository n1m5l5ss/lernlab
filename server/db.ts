// Local database using Node's built-in SQLite (no install needed; Node >= 22.13).
import * as sqlite from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Node 22–25 call the class DatabaseSync; newer releases may call it Database.
const Ctor: any = (sqlite as any).DatabaseSync ?? (sqlite as any).Database;

export const DATA_DIR = resolve(process.env.LERNLAB_DATA ?? 'data');
export const MEDIA_DIR = resolve(DATA_DIR, 'media');

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

export function getDb(file = resolve(DATA_DIR, 'lernlab.db')): DB {
  if (db) return db;
  mkdirSync(dirname(file), { recursive: true });
  mkdirSync(MEDIA_DIR, { recursive: true });
  db = new Ctor(file) as DB;
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
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
  `);
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
