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

/**
 * A stamp that changes whenever the data may have changed: every row this connection writes
 * (total_changes) and every commit from another connection (data_version).
 */
export function dataStamp(d: DB): string {
  const r = d.prepare('SELECT total_changes() AS c, data_version AS v FROM pragma_data_version').get()!;
  return `${r.c}:${r.v}`;
}

const memo = new WeakMap<DB, Map<string, { stamp: string; value: unknown }>>();

/**
 * `compute()`, or its result from the last call with the same key on this connection when no data has
 * changed since. Only for results that depend on nothing but the data and the key (put the day in it).
 */
export function whileUnchanged<T>(d: DB, key: string, compute: () => T): T {
  let byKey = memo.get(d);
  if (!byKey) memo.set(d, (byKey = new Map()));
  const stamp = dataStamp(d);
  const hit = byKey.get(key);
  if (hit && hit.stamp === stamp) return hit.value as T;
  const value = compute();
  byKey.set(key, { stamp, value });
  return value;
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
