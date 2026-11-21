// The "AI requests" list (#148): what an assistant proposes waits in ai-requests/ until the user accepts
// (possibly edited) or declines it. Files there are untrusted: anything malformed is ignored.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-ai-requests-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
const store = await import('@lernlab/storage-sqlite/airequests');
type Channel = import('./handlers').Channel;
type OutputOf<C extends Channel> = import('./handlers').OutputOf<C>;
after(() => cleanupTempDir(dir));

const ok = async <C extends Channel>(channel: C, input?: unknown): Promise<OutputOf<C>> => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as OutputOf<C>;
};
const fails = async (channel: Channel, input: unknown) => {
  const r = await handle(channel, input);
  return !r.ok && r.error.code;
};

test('a proposed deck is listed, edited by the user and accepted; its cards start new', async () => {
  const { id } = store.addAiRequest({
    kind: 'create_deck',
    deck: { name: 'Planets' },
    cards: [
      { front: 'Mars', back: 'Red planet' },
      { front: 'Venus', back: 'Hottest planet' },
    ],
    note: 'From the astronomy PDF',
  });
  assert.equal((await ok('state.get')).aiRequests, 1);
  const { requests } = await ok('aiRequests.list');
  assert.equal(requests[0].note, 'From the astronomy PDF');
  // The user renames the deck, fixes a card and leaves one out.
  const result = await ok('aiRequests.accept', {
    id,
    request: { deck: { name: 'Solar system' }, cards: [{ front: 'Mars', back: 'The red planet' }] },
  });
  assert.equal(result.added, 1);
  const found = await ok('cards.find', { deckId: result.deckId });
  assert.deepEqual(
    found.rows.map((r) => [r.front, r.back, r.state]),
    [['Mars', 'The red planet', 'new']],
  );
  assert.equal((await ok('state.get')).aiRequests, 0, 'an accepted request is gone');
  assert.equal(await fails('aiRequests.accept', { id }), 'request_not_found');
});

test('declining changes nothing; edits are checked like the assistant input', async () => {
  const deck = await ok('decks.create', { name: 'Moons' });
  const { id } = store.addAiRequest({ kind: 'add_cards', deckId: deck.id, cards: [{ front: 'Io', back: 'Jupiter' }] });
  assert.equal(
    await fails('aiRequests.accept', { id, request: { deckId: deck.id, cards: [{ front: 1, back: 'x' }] } }),
    'invalid_input',
  );
  assert.equal((await ok('aiRequests.decline', { id })).ok, true);
  assert.equal((await ok('cards.find', { deckId: deck.id })).total, 0);
  assert.equal((await ok('aiRequests.list')).requests.length, 0);
});

test('a fix comes with the card as it is now; the user can change it and leave cards out of a tidy-up', async () => {
  const deck = await ok('decks.create', { name: 'Rivers' });
  const add = store.addAiRequest({
    kind: 'add_cards',
    deckId: deck.id,
    cards: [
      { front: 'Nile', back: 'Afrika' },
      { front: 'Rhine', back: 'Europe' },
    ],
  });
  await ok('aiRequests.accept', { id: add.id });
  const [nile, rhine] = (await ok('cards.find', { deckId: deck.id })).rows.map((r) => r.id);

  const fix = store.addAiRequest({ kind: 'edit_card', cardId: nile, changes: { back: 'Africa' }, note: 'Typo' });
  const tidy = store.addAiRequest({ kind: 'organise_cards', cardIds: [nile, rhine], action: { kind: 'star' } });
  const list = await ok('aiRequests.list');
  assert.deepEqual(
    list.cards.map((c) => [c.id, c.back, c.starred]),
    [
      [nile, 'Afrika', false],
      [rhine, 'Europe', false],
    ],
  );
  // The user writes the fix their own way, and stars only the Rhine.
  await ok('aiRequests.accept', { id: fix.id, request: { cardId: nile, changes: { back: 'Africa (Egypt)' } } });
  const done = await ok('aiRequests.accept', { id: tidy.id, request: { cardIds: [rhine], action: { kind: 'star' } } });
  assert.equal(done.updated, 1);
  const rows = (await ok('cards.find', { deckId: deck.id })).rows;
  assert.deepEqual(
    rows.map((r) => [r.back, r.starred]),
    [
      ['Africa (Egypt)', false],
      ['Europe', true],
    ],
  );
  const bad = store.addAiRequest({ kind: 'organise_cards', cardIds: [nile], action: { kind: 'star' } });
  assert.equal(
    await fails('aiRequests.accept', { id: bad.id, request: { cardIds: [nile], action: { kind: 'delete' } } }),
    'invalid_input',
  );
  await ok('aiRequests.decline', { id: bad.id });
});

test('goals and a study plan show the current values and change on accept; an export saves nothing', async () => {
  const deck = await ok('decks.create', { name: 'Exam prep' });
  const goals = store.addAiRequest({ kind: 'set_goals', dailyGoalSessions: 2, newPerDay: 20 });
  const plan = store.addAiRequest({
    kind: 'study_plan',
    deckId: deck.id,
    plan: { examDate: '2027-01-20', newPerDay: 25 },
  });
  const exp = store.addAiRequest({ kind: 'export_deck', deckId: deck.id, format: 'lernpack' });
  const list = await ok('aiRequests.list');
  assert.deepEqual(list.goals, { dailyGoalSessions: 1, newPerDay: 10 });
  assert.equal(list.decks.find((d) => d.id === deck.id)?.plan.examDate, undefined);
  // The user agrees to two sessions but keeps fewer new cards.
  await ok('aiRequests.accept', { id: goals.id, request: { dailyGoalSessions: 2, newPerDay: 12 } });
  const { settings } = await ok('state.get');
  assert.equal(settings.dailyGoalSessions, 2);
  assert.equal(settings.newPerDay, 12);
  await ok('aiRequests.accept', { id: plan.id });
  assert.equal((await ok('aiRequests.list')).decks.find((d) => d.id === deck.id)?.plan.examDate, '2027-01-20');
  assert.equal(
    await fails('aiRequests.accept', { id: exp.id, request: { deckId: deck.id, format: 'exe' } }),
    'invalid_input',
  );
  assert.equal((await ok('aiRequests.accept', { id: exp.id })).deckId, deck.id);
});

test('malformed or foreign files in ai-requests/ are ignored, and ids cannot name other files', async () => {
  mkdirSync(store.aiRequestsDir(), { recursive: true });
  const bad = '00000000-0000-4000-8000-00000000000b';
  writeFileSync(
    join(store.aiRequestsDir(), `${bad}.json`),
    JSON.stringify({ id: bad, createdAt: 'x', kind: 'drop_db' }),
  );
  writeFileSync(join(store.aiRequestsDir(), 'notes.json'), '{}');
  writeFileSync(join(store.aiRequestsDir(), '00000000-0000-4000-8000-00000000000c.json'), 'not json');
  assert.equal((await ok('aiRequests.list')).requests.length, 0);
  assert.equal(await fails('aiRequests.accept', { id: bad }), 'request_not_found');
  assert.equal(await fails('aiRequests.accept', { id: '../lernlab' }), 'request_not_found');
  assert.equal((await ok('aiRequests.decline', { id: '../../lernlab.db' })).ok, false);
  assert.ok(readdirSync(dir).includes('lernlab.db'));
});

test('at most AI_REQUESTS_MAX wait at once', () => {
  for (const f of readdirSync(store.aiRequestsDir())) store.removeAiRequest(f.replace(/\.json$/, ''));
  const card = { kind: 'add_cards', deckId: 1, cards: [] };
  const extra = store.AI_REQUESTS_MAX - store.countAiRequests();
  for (let i = 0; i < extra; i++) store.addAiRequest(card);
  assert.throws(() => store.addAiRequest(card), /already waiting/);
});
