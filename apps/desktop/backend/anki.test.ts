// Import from a running Anki (#26), against a fake AnkiConnect on this computer (no real Anki, no network).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';

const PORT = 8797;
const dir = mkdtempSync(join(tmpdir(), 'lernlab-anki-'));
process.env.LERNLAB_DATA = dir;
process.env.ANKICONNECT_URL = `http://127.0.0.1:${PORT}`;
const { handle } = await import('./handlers');
const { ankiUrl, deckQuery, topLevelDecks } = await import('./anki');
const { startMockAnki } = await import('../test/mock-anki');
after(() => cleanupTempDir(dir));

const value = async <T>(channel: string, input?: unknown) => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as T;
};
type Info = { anki: boolean; ankiState: string; ankiDecks: { name: string; cards: number | null }[] };
type Status = {
  running: boolean;
  results: { source: string; report?: { total: number; media: number; added: number }; error?: { code: string } }[];
};
const close = (s: Server) => new Promise((r) => s.close(r));

test('AnkiConnect is only ever looked for on this computer', () => {
  assert.equal(ankiUrl('http://127.0.0.1:9000'), 'http://127.0.0.1:9000');
  assert.equal(ankiUrl('http://localhost:8765/'), 'http://localhost:8765');
  assert.equal(ankiUrl('http://example.com:8765'), 'http://127.0.0.1:8765');
  assert.equal(ankiUrl('https://127.0.0.1:8765'), 'http://127.0.0.1:8765');
  assert.equal(ankiUrl('not a url'), 'http://127.0.0.1:8765');
  assert.equal(deckQuery('Say "hi"::a_b*'), 'deck:"Say \\"hi\\"::a\\_b\\*"');
  assert.deepEqual(topLevelDecks(['Lang::German', 'Lang::German::Tier1', 'Spanish', 'Spanish']), [
    'Lang::German',
    'Spanish',
  ]);
});

test('Anki closed: a clear state for the help text, and import is refused with a code', async () => {
  const info = await value<Info>('import.ankiInfo');
  assert.deepEqual([info.anki, info.ankiState, info.ankiDecks], [false, 'not_running', []]);
  const r = await handle('import.anki', { sources: ['Lang'] });
  assert.equal(!r.ok && r.error.code, 'anki_unreachable');
});

test('another program on the AnkiConnect port is told apart from Anki being closed', async () => {
  const other = createServer((_, res) => res.end('<html>not anki</html>'));
  await new Promise<void>((r) => other.listen(PORT, '127.0.0.1', r));
  try {
    assert.equal((await value<Info>('import.ankiInfo')).ankiState, 'not_ankiconnect');
  } finally {
    await close(other);
  }
});

test('lists decks with counts and imports the selected decks with media', async () => {
  const server = await startMockAnki(PORT);
  try {
    const info = await value<Info>('import.ankiInfo');
    assert.equal(info.ankiState, 'ready');
    const count = (name: string) => info.ankiDecks.find((d) => d.name === name)?.cards;
    assert.equal(count('Lang::German'), 38);
    assert.equal(count('Lang::German::AboutMe'), 2);
    assert.deepEqual(
      info.ankiDecks.map((d) => d.name),
      ['Lang', 'Lang::German', 'Lang::German::AboutMe', 'Lang::German::Tier1'],
    );

    // The subdeck comes along with its parent, so it is not imported twice.
    assert.deepEqual(await value('import.anki', { sources: ['Lang::German::Tier1', 'Lang::German'] }), {
      started: true,
    });
    let status = await value<Status>('import.status');
    for (let i = 0; status.running && i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50));
      status = await value<Status>('import.status');
    }
    assert.equal(status.running, false);
    assert.equal(status.results.length, 1);
    const [first] = status.results;
    assert.equal(first.source, 'Lang::German');
    assert.deepEqual([first.report?.total, first.report?.added, first.report?.media], [38, 38, 38]);
  } finally {
    await close(server);
  }
});
