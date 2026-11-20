// First-run welcome: the bundled sample decks, and finishing or skipping the welcome through the request table.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';
import { SAMPLES } from './samples';
import type { Channel, OutputOf } from './handlers';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-welcome-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
after(() => cleanupTempDir(dir));

const ok = async <C extends Channel>(channel: C, input?: unknown) => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as OutputOf<C>;
};

const EXAMPLES = join(import.meta.dirname, '../../../examples/decks');
const read = (deck: string, file: string) => readFileSync(join(EXAMPLES, deck, file), 'utf8').replace(/\r\n/g, '\n');

test('the bundled samples are the decks in examples/', () => {
  for (const [sample, folder] of [
    [SAMPLES.language, 'german-a1-starter'],
    [SAMPLES.subject, 'biology-the-cell'],
  ] as const) {
    assert.equal(sample.csv, read(folder, 'cards.csv'));
    const manifest = JSON.parse(read(folder, 'manifest.json'));
    assert.equal(sample.deckName, manifest.deck.name);
    assert.equal(sample.language, manifest.deck.language);
  }
});

test('a new user sees the welcome; picking a language imports the sample and plans a 2-minute session', async () => {
  assert.equal((await ok('state.get')).welcome, true);
  const bad = await handle('welcome.finish', { choice: 'everything' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');

  const done = await ok('welcome.finish', { choice: 'language' });
  assert.ok(done.deckId);
  const state = await ok('state.get');
  assert.equal(state.welcome, false);
  assert.equal(state.activeDeck, done.deckId);
  const deck = state.decks.find((d) => d.id === done.deckId)!;
  assert.equal(deck.name, 'German A1 starter');
  assert.equal(deck.language, 'de');
  assert.equal(deck.cards, 10);

  const plan = await ok('session.plan', { length: 'mini' });
  assert.ok(plan.blocks.length > 0);
});

test('the subject sample imports, and picking it twice does not duplicate cards', async () => {
  const a = await ok('welcome.finish', { choice: 'subject' });
  const b = await ok('welcome.finish', { choice: 'subject' });
  assert.equal(a.deckId, b.deckId);
  const deck = (await ok('state.get')).decks.find((d) => d.id === a.deckId)!;
  assert.equal(deck.name, 'Biology: the cell');
  assert.equal(deck.cards, 10);
});

test('"I have my own cards" and "skip" import nothing', async () => {
  const before = (await ok('state.get')).decks.length;
  assert.deepEqual(await ok('welcome.finish', { choice: 'own' }), { deckId: null });
  assert.deepEqual(await ok('welcome.finish', { choice: 'skip' }), { deckId: null });
  assert.equal((await ok('state.get')).decks.length, before);
});
