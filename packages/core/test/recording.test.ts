// Recording your own audio on a card: only small, compressed Opus recordings are kept.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-recording-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
(await import('../src/db')).getDb(); // opens the data folder, as the app does at startup
const { saveRecording, RECORDING_MAX_BYTES } = await import('../src/recording');
const { mediaKind, readMedia } = await import('../src/library');
const { UserError } = await import('../src/errors');
after(() => cleanupTempDir(dir));

const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6]);
const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0]);

test('a WebM recording is saved in media/ as a new audio file', () => {
  const a = saveRecording(webm);
  const b = saveRecording(webm);
  assert.match(a, /^recording-[\w-]+\.weba$/);
  assert.notEqual(a, b, 'every recording gets its own file, so re-recording never overwrites another card');
  assert.equal(mediaKind(a), 'audio');
  assert.deepEqual([...(readMedia(a) ?? [])], [...webm]);
});

test('an Ogg recording keeps the .ogg extension', () => {
  assert.match(saveRecording(ogg), /^recording-[\w-]+\.ogg$/);
});

test('anything that is not a WebM or Ogg recording, or is too big or empty, is refused', () => {
  const code = (data: Uint8Array) => {
    try {
      saveRecording(data);
      return 'saved';
    } catch (e) {
      assert.ok(e instanceof UserError);
      return e.code;
    }
  };
  assert.equal(code(new Uint8Array([0x4d, 0x5a, 0, 0])), 'unsupported_media');
  assert.equal(code(new TextEncoder().encode('<html><script>')), 'unsupported_media');
  assert.equal(code(new Uint8Array(0)), 'unsupported_media');
  const big = new Uint8Array(RECORDING_MAX_BYTES + 1);
  big.set(webm);
  assert.equal(code(big), 'recording_too_long');
});
