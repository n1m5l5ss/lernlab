// LernLab's MCP server (#148): every tool, the switch that turns them all off, input checks, read-only data.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-mcp-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
type Channel = import('./handlers').Channel;
type OutputOf<C extends Channel> = import('./handlers').OutputOf<C>;
const { openAppDbReadonly } = await import('@lernlab/storage-sqlite');
const { callTool, createMcpServer, TOOLS, toolList } = await import('./mcp');
after(() => cleanupTempDir(dir));

const ok = async <C extends Channel>(channel: C, input?: unknown): Promise<OutputOf<C>> => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as OutputOf<C>;
};
/** The text of a tool result's first content block. */
const textOf = (res: unknown) => {
  const [first] = (res as CallToolResult).content;
  assert.equal(first.type, 'text');
  return (first as { text: string }).text;
};
const deps = { openDb: () => openAppDbReadonly(), now: () => new Date(2026, 10, 21, 12) };
const setAssistant = async (on: boolean) =>
  ok('settings.save', { ...(await ok('state.get')).settings, aiAssistant: on });

/** Each tool with input that works, so every one is called in both states. */
let deckId = 0;
let cardId = 0;
const sample = (): Record<keyof typeof TOOLS, unknown> => ({
  get_overview: {},
  list_decks: {},
  get_due: { deckId },
  search_cards: { query: 'Lima' },
  get_card: { id: cardId },
  get_stats: { period: 'week', date: '2026-11-18' },
  get_session_history: { period: 'all' },
  get_weak_cards: { deckId },
  quiz_cards: { from: 'random', count: 2 },
  propose_new_deck: { deck: { name: 'Rivers', language: 'en' }, cards: [{ front: 'Nile', back: 'Africa' }] },
  propose_cards: { deckId, cards: [{ front: 'Ecuador', back: 'Quito' }], note: 'From the atlas PDF' },
  list_requests: {},
});

before(async () => {
  const deck = await ok('decks.create', { name: 'Capitals', language: 'es' });
  deckId = deck.id;
  await ok('import.text', { text: 'Peru\tLima\nChile\tSantiago', fieldSep: '\t', deckId });
  cardId = (await ok('cards.find', { q: 'Peru' })).rows[0].id;
  const answer = { sessionId: 's1', itemId: cardId, responseMs: 900, xp: 1 };
  await ok('attempt.record', { ...answer, format: 'intro', correct: true });
  await ok('attempt.record', { ...answer, format: 'typed', correct: false, given: 'Cusco' });
});

test('off by default: every tool refuses until the user turns it on', async () => {
  assert.equal((await ok('state.get')).settings.aiAssistant, false);
  for (const [name, args] of Object.entries(sample())) {
    const r = await callTool(name, args, deps);
    assert.equal(!r.ok && r.code, 'assistant_off', name);
  }
  assert.equal((await ok('state.get')).aiRequests, 0, 'nothing was proposed while off');
});

test('every tool answers once it is on', async () => {
  await setAssistant(true);
  // As the assistant gets them: JSON.
  const results: Record<string, ReturnType<typeof JSON.parse>> = {};
  for (const [name, args] of Object.entries(sample())) {
    const r = await callTool(name, args, deps);
    assert.ok(r.ok, `${name}: ${!r.ok && r.message}`);
    results[name] = JSON.parse(JSON.stringify(r.value));
  }
  assert.equal(results.get_overview.decks, 1);
  assert.deepEqual(results.get_overview.studyLanguages, [{ code: 'es', name: 'Spanish' }]);
  assert.equal(results.list_decks[0].cards, 2);
  assert.equal(results.get_due.newToday, 1, 'Peru was met already');
  assert.equal(results.search_cards.total, 1);
  assert.equal(results.search_cards.cards[0].back, 'Lima');
  assert.deepEqual(
    results.get_card.wrongAnswers.map((w: { given: string }) => w.given),
    ['Cusco'],
  );
  assert.equal(results.get_stats.from, '2026-11-16');
  assert.ok(Array.isArray(results.get_session_history));
  assert.equal(results.get_weak_cards[0].front, 'Peru');
  assert.equal(results.quiz_cards.recorded, false);
  assert.equal(results.quiz_cards.cards.length, 2);
  assert.equal(results.propose_new_deck.status, 'waiting');
  assert.deepEqual(
    // Requests made in the same millisecond have no set order.
    results.list_requests.map((r: { summary: string }) => r.summary).sort(),
    ['New deck "Rivers" with 1 cards', `1 cards for deck ${deckId}`].sort(),
  );
  assert.equal((await ok('cards.find', { q: 'Quito' })).total, 0, 'a proposal changes nothing');
});

test('input is checked with the app validators; unknown tools and missing things are errors, not throws', async () => {
  await setAssistant(true);
  const code = async (name: string, args: unknown) => {
    const r = await callTool(name, args, deps);
    return !r.ok && r.code;
  };
  assert.equal(await code('delete_deck', { id: deckId }), 'unknown_tool');
  assert.equal(await code('get_card', { id: '1; DROP TABLE items' }), 'invalid_input');
  assert.equal(await code('get_card', { id: 999_999 }), 'card_not_found');
  assert.equal(await code('get_due', { deckId: 999 }), 'deck_not_found');
  assert.equal(await code('search_cards', { limit: 5000 }), 'invalid_input');
  assert.equal(await code('search_cards', { query: 'x'.repeat(501) }), 'invalid_input');
  assert.equal(await code('get_stats', { period: 'day' }), 'invalid_input');
  assert.equal(await code('get_stats', { period: 'decade' }), 'invalid_input');
  assert.equal(await code('quiz_cards', { from: 'due', count: 0 }), 'invalid_input');
  assert.equal(await code('propose_cards', { deckId: 999, cards: [] }), 'deck_not_found');
  assert.equal(
    await code('propose_cards', { deckId, cards: [{ front: 'x'.repeat(2001), back: '' }] }),
    'invalid_input',
  );
  const many = Array.from({ length: 501 }, () => ({ front: 'a', back: 'b' }));
  assert.equal(await code('propose_new_deck', { deck: { name: 'Big' }, cards: many }), 'invalid_input');
});

test('no tool deletes, and the connection it gets cannot write at all', async () => {
  assert.ok(Object.keys(TOOLS).every((name) => !/delete|remove|drop/i.test(name)));
  const db = openAppDbReadonly();
  try {
    assert.throws(() => db.exec('DELETE FROM items'), /readonly/);
  } finally {
    db.close();
  }
  const before = (await ok('cards.find', {})).total;
  await callTool('quiz_cards', { from: 'random', count: 5 }, deps);
  assert.equal((await ok('cards.find', {})).total, before);
});

test('over MCP: tools are listed with JSON Schema, results are JSON text, refusals are tool errors', async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([createMcpServer(deps).connect(a), client.connect(b)]);
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name),
    toolList().map((t) => t.name),
  );
  const stats = tools.find((t) => t.name === 'get_stats')!;
  assert.deepEqual(stats.inputSchema.required, ['period']);
  await setAssistant(true);
  const res = await client.callTool({ name: 'list_decks', arguments: {} });
  assert.equal(JSON.parse(textOf(res))[0].name, 'Capitals');
  await setAssistant(false);
  const off = await client.callTool({ name: 'list_decks', arguments: {} });
  assert.equal(off.isError, true);
  assert.match(textOf(off), /^assistant_off: .*Settings/);
  await client.close();
});

test('the stdio server: an MCP client starts it as a command and talks over stdin/stdout', async () => {
  await setAssistant(true);
  const tsx = createRequire(import.meta.url).resolve('tsx/cli');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsx, join(import.meta.dirname, 'mcp-stdio.ts')],
    env: { ...(process.env as Record<string, string>), LERNLAB_DATA: dir },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'stdio-test', version: '1' });
  await client.connect(transport);
  try {
    assert.equal(client.getServerVersion()?.name, 'lernlab');
    const res = await client.callTool({ name: 'get_due', arguments: {} });
    assert.equal(JSON.parse(textOf(res)).newToday, 1);
  } finally {
    await client.close();
  }
});
