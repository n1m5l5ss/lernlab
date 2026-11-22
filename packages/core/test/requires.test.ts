// Prerequisite links (#207): a card can say what it requires (cards by their front, or tags). New cards are met
// after their prerequisites were recalled, as an order and never a lock; cards tagged key-term come first; a
// card that keeps lapsing gets its weak basics looked at first. Hostile links (circles, unknown names) are safe.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-requires-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { basicsFirst, cleanRequires, requiresGraph, REQUIRES_MAX, REQUIRE_MAX_LENGTH } = await import('../src/requires');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const deck = createDeck('Calculus', null);
upsertCards(deck, [
  { front: 'Chain rule', back: 'Outer derivative times inner derivative', requires: 'Derivative|#functions', rank: 1 },
  { front: 'Filler one', back: 'one', rank: 2 },
  { front: 'Derivative', back: 'The slope of a function at a point', requires: 'Limit', rank: 3 },
  { front: 'Limit', back: 'The value a function approaches', requires: 'Chain rule|Nothing like this', rank: 4 },
  { front: 'Function', back: 'A rule that gives one output per input', tags: ['functions'], rank: 5 },
  { front: 'Filler two', back: 'two', rank: 6 },
  { front: 'Epsilon', back: 'A small positive number', tags: ['key-term'], rank: 7 },
]);
const items = allItems(getDb(), deck.id);
const id = (front: string) => items.find((i) => i.target === front)!.id;
const name = (n: number) => items.find((i) => i.id === n)!.target;

test('requires names cards or tags of the deck; unknown names are ignored and a circle is cut', () => {
  const g = requiresGraph(items);
  assert.deepEqual(g.get(id('Chain rule'))!.map(name).sort(), ['Derivative', 'Function']);
  assert.deepEqual(g.get(id('Derivative'))!.map(name), ['Limit']);
  assert.deepEqual(
    g.get(id('Limit')) ?? [],
    [],
    'Limit → Chain rule would close a circle; the unknown name is dropped',
  );
  const self = [{ ...items[0], extra: { requires: items[0].target } }];
  assert.equal(requiresGraph(self).size, 0, 'a card never requires itself');
  // A long hostile chain that ends in a circle neither overflows the stack nor hangs.
  const chain = Array.from({ length: 5000 }, (_, i) => ({
    ...items[0],
    id: i + 1,
    target: `c${i}`,
    tags: [],
    extra: { requires: `c${(i + 1) % 5000}` },
  }));
  const cg = requiresGraph(chain);
  assert.equal([...cg.values()].flat().length, 4999);
  assert.equal(
    basicsFirst(
      chain.map((c) => c.id),
      cg,
      () => false,
    ).length,
    5000,
  );
});

test('the requires line is cleaned: plain text, no repeats, at most ten names', () => {
  assert.equal(cleanRequires(' <b>Limit</b> | limit ||#functions'), 'Limit|#functions');
  const many = cleanRequires(Array.from({ length: 30 }, (_, i) => `n${i}${'x'.repeat(400)}`).join('|')).split('|');
  assert.ok(many.length === REQUIRES_MAX && many.every((n) => n.length <= REQUIRE_MAX_LENGTH));
  assert.equal(cleanRequires('<script>alert(1)</script>'), '');
});

test('basics first: key terms, then each card after what it needs; cards whose basics are not ready wait at the end', () => {
  const g = requiresGraph(items);
  const order = (ready: (n: number) => boolean) =>
    basicsFirst(
      items.map((i) => i.id),
      g,
      ready,
      (n) => name(n) === 'Epsilon',
    ).map(name);
  assert.deepEqual(
    order(() => false),
    ['Epsilon', 'Limit', 'Function', 'Filler one', 'Filler two', 'Derivative', 'Chain rule'],
  );
  const known = new Set(['Limit', 'Function', 'Derivative'].map(id));
  assert.equal(order((n) => known.has(n))[1], 'Chain rule', 'recalled basics: back in the deck order');
  assert.deepEqual(
    basicsFirst([3, 1, 2], new Map(), () => true),
    [3, 1, 2],
  );
});

test('a session meets the basics before the cards that build on them, and locks nothing', () => {
  const d = getDb();
  const fresh = (when: Date) => {
    const plan = planSession('standard', d, when, deck.id);
    return plan.blocks
      .filter((b) => b.title === 'New cards')
      .flatMap((b) => ('exercises' in b ? b.exercises : []))
      .flatMap((e) => (e.type === 'intro' ? [name(e.itemId)] : []));
  };
  const day1 = new Date(2027, 1, 1, 10);
  assert.deepEqual(fresh(day1), ['Epsilon', 'Limit', 'Function', 'Filler one', 'Filler two']);
  const learn = (front: string, when: Date) => {
    for (const format of ['intro', 'typed'] as const)
      recordAttempt({ sessionId: 'r', itemId: id(front), format, correct: true, responseMs: 9000, xp: 1 }, d, when);
  };
  for (const f of ['Epsilon', 'Limit', 'Function', 'Filler one', 'Filler two']) learn(f, day1);
  const day2 = new Date(2027, 1, 2, 10);
  assert.deepEqual(
    fresh(day2),
    ['Derivative', 'Chain rule'],
    'Limit was recalled; nothing else is left, so nothing waits',
  );
  learn('Derivative', day2);
  assert.deepEqual(fresh(new Date(2027, 1, 3, 10)), ['Chain rule']);
});

test('a card that keeps lapsing gets its weak basics first: a quick look, and due basics are reviewed before it', () => {
  const d = getDb();
  recordAttempt(
    { sessionId: 'r', itemId: id('Chain rule'), format: 'intro', correct: true, responseMs: 1, xp: 0 },
    d,
    new Date(2027, 1, 3, 10),
  );
  const at = (day: number) => new Date(2027, 2, day, 10);
  const set = d.prepare('UPDATE srs SET due = ?, lapses = ?, reps = 3 WHERE item_id = ?');
  for (const i of items) set.run(new Date(2027, 11, 1).toISOString(), 0, i.id);
  set.run(at(1).toISOString(), 3, id('Chain rule'));
  d.prepare('UPDATE item_state SET mastery = 1 WHERE item_id = ?').run(id('Function'));
  const plan = planSession('standard', d, at(2), deck.id);
  const basics = plan.blocks.find((b) => b.title === 'Basics first');
  assert.ok(basics && 'exercises' in basics);
  assert.deepEqual(
    basics.exercises.map((e) => [e.type, 'itemId' in e && name(e.itemId)]),
    [['mc', 'Function']],
    'the weak one only; recognition, so nothing is graded early',
  );
  assert.ok(plan.blocks.indexOf(basics) < plan.blocks.findIndex((b) => b.title === 'Review'));
  set.run(at(1).toISOString(), 0, id('Derivative'));
  const reviews = planSession('standard', d, at(2), deck.id)
    .blocks.filter((b) => b.kind === 'drill' && (b.title === 'Review' || b.title === 'Fill the gap'))
    .flatMap((b) => ('exercises' in b ? b.exercises : []))
    .map((e) => ('itemId' in e ? name(e.itemId) : ''));
  assert.deepEqual(reviews, ['Derivative', 'Chain rule']);
});

test('.lernpack, CSV and JSON carry requires', () => {
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const cards = strFromU8(pack['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const chain = cards.find((c) => c.front === 'Chain rule');
  assert.ok(chain.requires === 'Derivative|#functions' && !chain.extra?.requires, 'a field, not an extra');
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /,requires,/);
  const again = allItems(getDb(), importFile('Again.csv', strToU8(csv)).deck.id);
  assert.equal(again.find((i) => i.target === 'Chain rule')!.extra.requires, 'Derivative|#functions');
  const json = importFile('j.json', strToU8(JSON.stringify([{ front: 'A', back: 'b', requires: 'A|<i>B</i>' }])));
  assert.equal(allItems(getDb(), json.deck.id)[0].extra.requires, 'A|B');
});
