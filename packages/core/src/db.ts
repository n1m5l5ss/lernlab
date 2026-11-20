// Database helpers for the engine. The connection itself comes from the storage host (see host.ts).
import { host, type DB } from './host';

export type { DB, Statement } from './host';

/** The app's database. */
export const getDb = (): DB => host().db();

export function getMeta<T>(d: DB, key: string, fallback: T): T {
  const row = d.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? (JSON.parse(row.value as string) as T) : fallback;
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
