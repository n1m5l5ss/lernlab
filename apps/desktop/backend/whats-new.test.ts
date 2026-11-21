// "What's new" through the request table (issue #58): the bundled notes, shown once per version.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { notesFromChangelog, type ReleaseNotes } from '@lernlab/core/whatsnew';
import { cleanupTempDir } from '../test/test-utils';
import bundled from './whats-new.json';
import pkg from '../package.json';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-whatsnew-ipc-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
after(() => cleanupTempDir(dir));

const ok = async <T>(channel: string, input?: unknown): Promise<T> => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as T;
};
const whatsNew = async () => (await ok<{ whatsNew: ReleaseNotes | null }>('state.get')).whatsNew;

test('the bundled whats-new.json has the shape the build step writes', () => {
  const md = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
  const fresh = notesFromChangelog(md);
  assert.ok(fresh);
  assert.match(bundled.version, /^\d+\.\d+\.\d+/);
  assert.ok(Array.isArray(bundled.added) && Array.isArray(bundled.fixed));
});

test('a brand-new user never sees it; finishing the welcome remembers the version', async () => {
  assert.equal(await whatsNew(), null);
  await ok('welcome.finish', { choice: 'skip' });
  assert.equal(await whatsNew(), null);
  const info = await ok<{ version: string; lastSeenVersion: string | null }>('app.info');
  assert.equal(info.lastSeenVersion, pkg.version);
});

test('after an update it shows once, until dismissed for this version', async () => {
  // Pretend the last version this person saw was older than the bundled notes.
  const db = (await import('./storage')).getDb();
  const { markVersionSeen } = await import('@lernlab/core/whatsnew');
  markVersionSeen(db, '0.0.1');
  const notes = await whatsNew();
  assert.equal(notes?.version, bundled.version);
  assert.ok(notes!.added.length <= 5 && notes!.fixed.length <= 5);
  await ok('whatsNew.seen');
  assert.equal(await whatsNew(), null);
  const info = await ok<{ lastSeenVersion: string | null }>('app.info');
  assert.equal(info.lastSeenVersion, pkg.version);
});
