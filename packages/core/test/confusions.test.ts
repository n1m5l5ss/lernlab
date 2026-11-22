// Learn from your own mix-ups (#200): a wrong answer that is another card's answer is logged as a confusion
// pair. The pair's cards become each other's preferred wrong choice and sit next to each other in a session,
// and after repeated mix-ups the app offers a compare (twin) card: both side by side, self-checked.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-confusions-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { confusionMap, dismissTwin, keepClose, makeTwin, twinOffer, TWIN_AFTER } = await import('../src/confusions');
const { isTwin, TWIN_MAX_LENGTH } = await import('../src/twin');
const gen = await import('../src/exercises');
const { guessable } = await import('../src/guess');
const { buildExam } = await import('../src/examplan');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { bulkCards } = await import('../src/browse');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const WORDS = [
  ['affect', 'to influence'],
  ['effect', 'a result'],
  ['accept', 'to receive'],
  ['except', 'not including'],
  ['advice', 'a suggestion'],
  ['advise', 'to recommend'],
  ['allusion', 'an indirect reference'],
  ['illusion', 'a false impression'],
  ['principal', 'the head of a school'],
  ['principle', 'a basic rule'],
  ['stationary', 'not moving'],
  ['stationery', 'writing paper'],
];
const deck = createDeck('Look-alikes', null);
upsertCards(
  deck,
  WORDS.map(([front, back]) => ({ front, back, tags: ['english'] })),
);
const items = allItems(getDb(), deck.id);
const card = (front: string) => items.find((i) => i.target === front)!;
const [affect, effect, accept, except] = ['affect', 'effect', 'accept', 'except'].map(card);
const attempt = (itemId: number, given: string, o: object = {}, when = new Date(2026, 10, 2, 10)) =>
  recordAttempt(
    { sessionId: 's', itemId, format: 'typed', correct: false, responseMs: 3000, xp: 0, given, ...o },
    getDb(),
    when,
  );
const pairs = () =>
  getDb()
    .prepare('SELECT a, b, count FROM confusions ORDER BY a, b')
    .all()
    .map((r) => [Number(r.a), Number(r.b), Number(r.count)]);
const pair = (x: { id: number }, y: { id: number }) => [Math.min(x.id, y.id), Math.max(x.id, y.id)];

test('a wrong answer that is another card’s answer is logged as a confusion pair; other answers are not', () => {
  attempt(affect.id, 'xyzzy');
  attempt(affect.id, 'to influence', { correct: true });
  attempt(affect.id, '(timeout)');
  assert.deepEqual(pairs(), []);
  attempt(affect.id, ' A Result. '); // typed the back of "effect"
  assert.deepEqual(pairs(), [[...pair(affect, effect), 1]]);
  attempt(effect.id, 'to influence', { format: 'mc', practice: true }); // picked that wrong choice, in practice
  assert.deepEqual(pairs(), [[...pair(affect, effect), 2]], 'one pair, whichever card was asked');
  assert.deepEqual(confusionMap(getDb()).get(affect.id), [effect.id]);
  assert.deepEqual(confusionMap(getDb()).get(effect.id), [affect.id]);
  const srs = getDb().prepare('SELECT 1 FROM srs WHERE item_id = ?').get(effect.id);
  assert.equal(srs, undefined, 'a wrong choice in practice never introduces or grades a card');
});

test('cards you mixed up are each other’s wrong choice, in both directions', () => {
  const mixups = confusionMap(getDb());
  for (let k = 0; k < 30; k++) {
    const a = gen.mc(affect, items, 'de2en', mixups.get(affect.id));
    assert.ok(a.type === 'mc' && a.options.includes('a result'), 'front → back');
    const b = gen.mc(effect, items, 'en2de', mixups.get(effect.id));
    assert.ok(b.type === 'mc' && b.options.includes('affect'), 'back → front');
  }
  const session = planSession('standard', getDb(), new Date(2026, 10, 2, 11), deck.id, { practice: true });
  const mcs = session.blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])).filter((e) => e.type === 'mc');
  for (const e of mcs) {
    if (e.type !== 'mc' || e.itemId !== affect.id) continue;
    assert.ok(e.options.includes(e.direction === 'de2en' ? 'a result' : 'effect'));
  }
});

test('keepClose puts a mixed-up card right after its partner and keeps everything else in order', () => {
  const m = new Map([
    [1, [5]],
    [5, [1]],
    [3, [9]],
  ]);
  assert.deepEqual(keepClose([1, 2, 3, 4, 5, 6], m), [1, 5, 2, 3, 4, 6]);
  assert.deepEqual(keepClose([4, 5, 2, 1], m), [4, 5, 1, 2]);
  assert.deepEqual(keepClose([2, 4], m), [2, 4]);
});

test('a session asks the two cards of a pair next to each other', () => {
  for (let k = 0; k < 5; k++) {
    const plan = planSession('long', getDb(), new Date(2026, 10, 2, 12), deck.id, { practice: true });
    const reviews = plan.blocks.flatMap((b) => (b.kind === 'drill' && 'exercises' in b ? [b.exercises] : []));
    const ids = reviews.map((r) => r.map((e) => ('itemId' in e ? e.itemId : 0))).find((r) => r.includes(affect.id))!;
    assert.equal(Math.abs(ids.indexOf(affect.id) - ids.indexOf(effect.id)), 1, 'in one block, side by side');
  }
});

test(`after ${TWIN_AFTER} mix-ups the app offers a compare card once; "not now" is remembered`, () => {
  assert.equal(twinOffer(getDb()), null, 'two mix-ups are not enough');
  attempt(affect.id, 'a result', {}, new Date(2026, 10, 3, 10));
  const offer = twinOffer(getDb())!;
  assert.equal(offer.count, 3);
  assert.deepEqual([offer.a, offer.b].map((c) => `${c.front}=${c.back}`).sort(), [
    'affect=to influence',
    'effect=a result',
  ]);
  for (let k = 0; k < TWIN_AFTER; k++) attempt(accept.id, 'not including');
  dismissTwin(accept.id, except.id, getDb());
  dismissTwin(except.id, accept.id, getDb());
  assert.deepEqual(pair(twinOffer(getDb())!.a, twinOffer(getDb())!.b), pair(affect, effect));
  assert.throws(() => makeTwin(affect.id, card('advice').id, '', getDb()), /mixed up/);
});

test('the compare card shows both cards, is self-checked like a flip card and stays out of games', () => {
  const made = makeTwin(effect.id, affect.id, '<b>Both</b> are about change. Affect is the verb.', getDb());
  assert.equal(twinOffer(getDb()), null, 'offered once');
  assert.equal(makeTwin(affect.id, effect.id, 'again', getDb()).id, made.id, 'never a second card for one pair');
  const all = allItems(getDb(), deck.id);
  const twin = all.find((i) => i.id === made.id)!;
  assert.ok(isTwin(twin));
  assert.equal(twin.meaning, '<b>Both</b> are about change. Affect is the verb.', 'typed text stays text');
  const ex = gen.recall(twin);
  assert.equal(ex.type, 'twin');
  assert.ok(ex.type === 'twin' && [ex.left, ex.right].sort().join('|') === 'affect: to influence|effect: a result');
  assert.equal(guessable(twin), false);
  for (let k = 0; k < 5; k++) {
    const plan = planSession('standard', getDb(), new Date(2026, 10, 3, 11), deck.id);
    for (const b of plan.blocks) {
      if ('itemIds' in b) assert.ok(!b.itemIds.includes(twin.id), b.title);
      if (!('exercises' in b)) continue;
      for (const e of b.exercises) {
        if ('itemId' in e && e.itemId === twin.id) assert.equal(e.type, 'twin', b.title);
        if (e.type === 'mc' || e.type === 'truefalse') assert.ok(!JSON.stringify(e).includes('Both are about'));
      }
    }
  }
  assert.ok(buildExam(deck.id, getDb()).questions.every((q) => q.itemId !== twin.id));
  // A real recall: the first answer of the day grades it, a second one does not.
  const a = { sessionId: 't', itemId: twin.id, format: 'flip' as const, correct: true, responseMs: 9000, xp: 1 };
  assert.equal(recordAttempt(a, getDb(), new Date(2027, 0, 3, 12)).grade, 3);
  assert.equal(recordAttempt(a, getDb(), new Date(2027, 0, 3, 13)).grade, null);
  attempt(twin.id, 'to influence', { format: 'typed' }, new Date(2027, 0, 4, 10));
  assert.equal(confusionMap(getDb()).get(twin.id), undefined, 'a compare card is never part of a pair');
});

test('.lernpack, CSV and JSON carry compare cards; hostile text is cleaned and capped', () => {
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const cards = strFromU8(pack['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const t = cards.find((c) => c.type === 'twin');
  assert.ok(t.twin && !t.extra?.twin, 'a field, not an extra');
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /,twin,/);
  const again = importFile('Again.csv', strToU8(csv));
  const back = allItems(getDb(), again.deck.id).filter(isTwin);
  assert.deepEqual([back.length, back[0].extra.twin], [1, t.twin]);
  const hostile = [
    {
      front: 'A',
      back: 'x',
      twin: `<script>alert(1)</script><img src=x onerror=alert(1)>B&lt;i&gt;${'z'.repeat(900)}`,
    },
    { front: 'Q', back: 'x', type: 'mcq', choices: 'a|b', correct: '1', twin: 'B' },
    { front: 'Plain', back: 'x', twin: '   ' },
  ];
  const json = importFile('j.json', strToU8(JSON.stringify(hostile)));
  const got = allItems(getDb(), json.deck.id);
  const a = got.find((i) => i.target === 'A')!;
  assert.ok(isTwin(a) && a.extra.twin.length <= TWIN_MAX_LENGTH && !/[<>]/.test(a.extra.twin.replace(/^B<i>/, '')));
  assert.ok(!a.extra.twin.includes('alert'));
  assert.deepEqual(
    got.filter((i) => i.target !== 'A').map((i) => isTwin(i)),
    [false, false],
    'only a basic card with a second side is a compare card',
  );
  const ex = gen.recall(a);
  assert.ok(ex.type === 'twin' && !/<(?!\/?(b|i|code|br)\b)/.test(ex.right), 'shown escaped');
});

test('deleting a card forgets its mix-ups', () => {
  attempt(card('advice').id, 'to recommend');
  assert.ok(confusionMap(getDb()).has(card('advise').id));
  bulkCards([card('advise').id], { kind: 'delete' }, getDb());
  assert.ok(!confusionMap(getDb()).has(card('advice').id));
});
