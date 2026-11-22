// Study together (#224) through the app's requests: a second learner studies the owner's deck with their
// own progress; the owner's progress and cards stay as they were.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-together-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
type Channel = import('./handlers').Channel;
type OutputOf<C extends Channel> = import('./handlers').OutputOf<C>;
const { closeLearners } = await import('@lernlab/storage-sqlite/learners');
const { getDb } = await import('@lernlab/core/db');
after(() => {
  closeLearners();
  cleanupTempDir(dir);
});

const ok = async <C extends Channel>(channel: C, input?: unknown): Promise<OutputOf<C>> => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as OutputOf<C>;
};
const fails = async (channel: Channel, input: unknown) => {
  const r = await handle(channel, input);
  return r.ok ? 'ok' : r.error.code;
};
const count = (table: string) => Number(getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);

test('add a person by name, study as them, and only their progress changes', async () => {
  assert.deepEqual((await ok('state.get')).learners, []);
  const deck = await ok('decks.create', { name: 'Capitals' });
  await ok('import.text', {
    text: 'Peru\tLima\nChile\tSantiago\nKenya\tNairobi\nJapan\tTokyo',
    fieldSep: '\t',
    deckId: deck.id,
  });
  assert.equal(await fails('learners.add', { name: '   ' }), 'learner_name_required');
  const ben = await ok('learners.add', { name: ' <b>Ben</b> ' });
  assert.equal(ben.name, 'Ben');
  assert.equal(await fails('learners.add', { name: 'BEN' }), 'learner_exists');
  assert.deepEqual((await ok('state.get')).learners, [ben]);

  const as = (channel: string, input?: unknown) => ({ learnerId: ben.id, channel, input });
  const plan = (await ok('together.as', as('session.plan', { length: 'mini', deckId: deck.id }))) as {
    id: string;
    blocks: unknown[];
    items: Record<string, { id: number }>;
  };
  assert.ok(plan.blocks.length > 0);
  const itemId = Object.values(plan.items)[0].id;
  const answer = { sessionId: plan.id, itemId, responseMs: 700, xp: 2 };
  await ok('together.as', as('attempt.record', { ...answer, format: 'intro', correct: true }));
  await ok('together.as', as('attempt.record', { ...answer, format: 'typed', correct: true }));
  const done = (await ok(
    'together.as',
    as('session.finish', {
      sessionId: plan.id,
      length: 'mini',
      seconds: 50,
      answers: 1,
      correct: 1,
      bossWon: null,
      bestGenderCombo: 0,
      perfectBlocks: 0,
      startedAt: new Date().toISOString(),
    }),
  )) as { twinOffer: unknown };
  assert.equal(done.twinOffer, null);
  assert.ok(existsSync(join(dir, 'learners', ben.id, 'lernlab.db')));

  // The owner: nothing studied, nothing scheduled, the same new cards as before.
  assert.deepEqual([count('srs'), count('attempts'), count('sessions')], [0, 0, 0]);
  const state = await ok('state.get');
  assert.equal(state.newLeftToday, 4);
  assert.equal(state.streak.current, 0);

  // Only what a session needs can be done as someone else; never card edits, settings or deleting.
  for (const channel of [
    'cards.add',
    'settings.save',
    'data.deleteAll',
    'decks.delete',
    'together.as',
    'learners.remove',
  ])
    assert.equal(await fails('together.as', as(channel, {})), 'invalid_input', channel);
  assert.equal(await fails('together.as', as('attempt.record', { itemId: 'x' })), 'invalid_input');
  assert.equal(
    await fails('together.as', { learnerId: '../x', channel: 'session.plan', input: {} }),
    'learner_not_found',
  );

  await ok('settings.save', { ...state.settings, learnerName: ' <i>Ana</i> ' + 'x'.repeat(100) });
  assert.equal((await ok('state.get')).settings.learnerName.length, 40);

  await ok('learners.remove', { id: ben.id });
  assert.ok(!existsSync(join(dir, 'learners', ben.id)));
  assert.equal(await fails('together.as', as('session.plan', {})), 'learner_not_found');
  assert.equal(await fails('learners.remove', { id: ben.id }), 'learner_not_found');
  assert.equal(count('items'), 4, 'the cards stay');
});
