// Ports: everything the engine needs from the platform it runs on.
// The desktop app plugs in @lernlab/storage-sqlite (node:sqlite + files on disk).
// A phone or Tauri version supplies its own host and reuses the engine unchanged.

/** A value SQLite can store or return. */
export type SqlValue = string | number | bigint | null | Uint8Array;
/** One result row, by column name. */
export type Row = Record<string, SqlValue>;

/** A prepared SQLite statement. */
export type Statement = {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): Row | undefined;
  all(...params: SqlValue[]): Row[];
};

/** A synchronous SQLite connection. Any SQLite binding can implement this. */
export type DB = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
};

/** Where card media (images, audio, video) is kept, by file name. */
export interface MediaStore {
  /** Size in bytes, or null if there is no such file. */
  size(name: string): number | null;
  read(name: string): Uint8Array | null;
  write(name: string, data: Uint8Array): void;
}

export interface Host {
  /** The app's database, opened and migrated (see `migrate` in schema.ts). */
  db(): DB;
  /** Open a read-only copy of another SQLite file (an Anki collection). Close it when done. */
  openSqliteBytes(bytes: Uint8Array): DB;
  media: MediaStore;
  /** Write a readable copy of the day's summary next to the database. Best-effort. */
  saveProgressSnapshot(day: string, json: string): void;
  /** A random unique id (UUID). */
  randomId(): string;
}

let current: Host | null = null;

export function setHost(h: Host): void {
  current = h;
}

export function host(): Host {
  if (!current) throw new Error('LernLab core has no storage host. Call setHost() before using the engine.');
  return current;
}
