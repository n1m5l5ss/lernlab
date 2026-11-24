// The usual-hour suggestion (#204) reads session start times from the local study log.
process.env.TZ = 'Europe/Berlin';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-studyplan-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { recentSessionStarts, usualStudyTime } = await import('../src/studyplan');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const at = (d: number, h: number, mi = 0) => new Date(2026, 10, d, h, mi);

test('session starts are read from the local study log, newest first, and bad rows are skipped', () => {
  const d = getDb();
  const add = (id: string, startedAt: string) =>
    d
      .prepare('INSERT INTO sessions(id, day, started_at, length) VALUES (?, ?, ?, ?)')
      .run(id, startedAt.slice(0, 10), startedAt, 'mini');
  assert.deepEqual(recentSessionStarts(d), []);
  add('a', at(2, 19).toISOString());
  add('b', at(3, 19, 5).toISOString());
  add('c', 'garbage');
  add('d', at(4, 18, 55).toISOString());
  const starts = recentSessionStarts(d);
  assert.deepEqual(
    starts.map((s) => s.getTime()),
    [at(4, 18, 55), at(3, 19, 5), at(2, 19)].map((s) => s.getTime()),
  );
  assert.equal(recentSessionStarts(d, 3).length, 2, 'the limit counts rows, bad ones included');
  assert.equal(usualStudyTime(starts), '19:00');
});
