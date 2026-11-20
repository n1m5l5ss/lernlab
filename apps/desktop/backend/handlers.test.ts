// The request table behind the desktop bridge: validation, errors as values, and a round trip.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-ipc-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
after(() => cleanupTempDir(dir));

const ok = async (channel: string, input?: unknown) => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as any;
};

test('unknown channels and bad input come back as errors, never as throws', async () => {
  assert.deepEqual(await handle('fs.readFile', { path: '/etc/passwd' }), {
    ok: false,
    error: { code: 'unknown_channel', message: 'Unknown request' },
  });
  assert.deepEqual(await handle('toString', undefined), {
    ok: false,
    error: { code: 'unknown_channel', message: 'Unknown request' },
  });
  const bad = await handle('decks.delete', { id: '1; DROP TABLE decks' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  const empty = await handle('decks.create', { name: '   ' });
  assert.equal(!empty.ok && empty.error.code, 'name_required');
  const notFound = await handle('decks.activate', { id: 999 });
  assert.equal(!notFound.ok && notFound.error.code, 'not_found');
});

test('create a deck, add and edit a card, import a file, plan a session', async () => {
  const deck = await ok('decks.create', { name: 'Capitals', language: null });
  const { id } = await ok('cards.add', { deckId: deck.id, card: { front: 'France', back: 'Paris', tags: 'geo eu' } });
  await ok('cards.update', { id, card: { front: 'France', back: 'Paris', starred: true, unknownField: 'ignored' } });
  const list = await ok('cards.list', { deckId: deck.id });
  assert.equal(list.total, 1);
  assert.equal(list.cards[0].meaning, 'Paris');
  assert.equal(list.cards[0].starred, true);
  const csv = new TextEncoder().encode('front,back\nGermany,Berlin\nItaly,Rome\n');
  const imp = await ok('import.file', { name: 'more.csv', data: csv, deckId: deck.id });
  assert.equal(imp.added, 2);
  const exp = await ok('decks.export', { id: deck.id, format: 'csv' });
  assert.ok(exp.data instanceof Uint8Array && new TextDecoder().decode(exp.data).includes('Berlin'));
  const plan = await ok('session.plan', { length: 'mini' });
  assert.ok(plan.blocks.length > 0);
  const state = await ok('state.get');
  assert.equal(state.itemCount, 3);
});
