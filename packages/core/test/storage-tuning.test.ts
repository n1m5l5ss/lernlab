// Storage tuning from docs/ARCHITECTURE.md §5 (#56): the connection pragmas and the indexes the study
// queries need, so the data process answers quickly even with a large collection.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@lernlab/storage-sqlite';
import type { DB } from '../src/host';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-tuning-'));
after(() => cleanupTempDir(dir));

const pragma = (d: DB, name: string) => Object.values(d.prepare(`PRAGMA ${name}`).get()!)[0];
const plan = (d: DB, sql: string, ...args: (string | number)[]) =>
  d
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...args)
    .map((r) => String(r.detail))
    .join('\n');

test('the database opens with the recommended pragmas', () => {
  const d = openDb(join(dir, 'pragmas', 'lernlab.db'));
  try {
    assert.equal(pragma(d, 'journal_mode'), 'wal');
    assert.equal(Number(pragma(d, 'synchronous')), 1, 'synchronous = NORMAL');
    assert.equal(Number(pragma(d, 'foreign_keys')), 1);
    assert.equal(Number(pragma(d, 'busy_timeout')), 5000);
    assert.equal(Number(pragma(d, 'temp_store')), 2, 'temp_store = MEMORY');
    assert.equal(Number(pragma(d, 'cache_size')), -20000);
  } finally {
    d.close();
  }
});

test('the due queue and the daily attempt lookups use an index', () => {
  const d = openDb(join(dir, 'indexes', 'lernlab.db'));
  try {
    const names = d
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((r) => r.name);
    for (const name of ['srs_due', 'attempts_day_item', 'items_deck']) assert.ok(names.includes(name), name);
    assert.match(plan(d, 'SELECT item_id FROM srs WHERE due <= ? ORDER BY due', '2026-01-01'), /srs_due/);
    assert.match(
      plan(d, 'SELECT COUNT(*) FROM attempts WHERE day = ? AND item_id = ?', '2026-01-01', 1),
      /attempts_day_item/,
    );
  } finally {
    d.close();
  }
});
