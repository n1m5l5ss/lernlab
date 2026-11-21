// Myth cards (#202): a card that states a common misconception. The session asks "True or myth?" (the answer
// is always myth), then asks why and shows the card's back. It is a real recall: one FSRS grade per card per
// day, like any other card. Games, guess rounds and pair rounds leave myth cards out.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-myths-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { cardToItem, createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { recall } = await import('../src/exercises');
const { isMyth } = await import('../src/misconceptions');
const { guessable } = await import('../src/guess');
const { buildExam } = await import('../src/examplan');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const MYTH = {
  front: 'We only use 10% of our brains.',
  back: 'Brain scans show activity all over the brain, even in sleep.',
};

test('type "myth" makes a myth card: a basic card with a flag in extra (no migration), without variants', () => {
  const plain = { id: 1, name: 'D', language: null };
  const item = cardToItem(plain, { ...MYTH, type: 'myth', variants: 'apply: Q?' })!;
  assert.equal(item.kind, 'card');
  assert.equal(item.extra.myth, '1');
  assert.ok(isMyth(item));
  assert.ok(!('variants' in item.extra), 'a myth asks in its own way');
  const german = cardToItem({ id: 2, name: 'G', language: 'de' }, { front: 'der Mythos', back: 'x', type: 'Myth' })!;
  assert.equal(german.kind, 'card', 'also in a language deck');
  assert.ok(isMyth(german));
  const kept = cardToItem(plain, { ...MYTH, extra: { myth: '1' } })!;
  assert.ok(isMyth(kept), 'a card saved without a type stays a myth');
  const basic = cardToItem(plain, { ...MYTH, type: 'basic', extra: { myth: '1' } })!;
  assert.ok(!isMyth(basic), 'another type turns it back into a normal card');
  const quiz = cardToItem(plain, {
    front: 'Q',
    back: '',
    type: 'mcq',
    choices: 'A|B',
    correct: '1',
    extra: { myth: '1' },
  })!;
  assert.ok(!isMyth(quiz));
});

const deck = createDeck('Brain myths', null);
upsertCards(deck, [
  { ...MYTH, type: 'myth', tags: ['brain'] },
  {
    front: 'Left-brained people are logical.',
    back: 'Both halves work together in everyone.',
    type: 'myth',
    tags: ['brain'],
  },
  { front: 'Neuron', back: 'a nerve cell', tags: ['brain'] },
  { front: 'Synapse', back: 'the gap between two neurons', tags: ['brain'] },
  { front: 'Cortex', back: 'the outer layer of the brain', tags: ['brain'] },
  { front: 'Glia', back: 'cells that support neurons', tags: ['brain'] },
]);
const items = allItems(getDb(), deck.id);
const myth = items.find((i) => i.target === MYTH.front)!;
const myths = new Set(items.filter(isMyth).map((i) => i.id));

test('a myth card is asked as "True or myth?", with its back as the why', () => {
  const ex = recall(myth);
  assert.deepEqual(ex, { type: 'myth', itemId: myth.id, statement: MYTH.front, why: MYTH.back });
  assert.equal(recall(myth, 1).type, 'myth', 'never in another wording');
});

test('sessions ask myth cards only as myth recalls: no pair games, guess rounds or exams', () => {
  assert.equal(guessable(myth), false);
  for (let k = 0; k < 5; k++) {
    const plan = planSession('standard', getDb(), new Date(2026, 10, 2, 10), deck.id);
    for (const b of plan.blocks) {
      if (b.kind === 'guess')
        assert.ok(
          b.itemIds.every((id) => !myths.has(id)),
          'no myth in a guess round',
        );
      if ('itemIds' in b)
        assert.ok(
          b.itemIds.every((id) => !myths.has(id)),
          b.title,
        );
      if (!('exercises' in b)) continue;
      for (const e of b.exercises) {
        if (!('itemId' in e) || !myths.has(e.itemId)) continue;
        assert.equal(e.type, 'myth', `${b.title}: ${e.type}`);
      }
    }
    const asks = plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])).filter((e) => e.type === 'myth');
    assert.ok(asks.length >= 2, 'new myth cards are asked as recalls');
    for (const e of plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises : [])))
      if (e.type === 'mc' || e.type === 'truefalse')
        assert.ok(!JSON.stringify(e).includes('10% of our brains'), 'never a distractor');
  }
  const exam = buildExam(deck.id, getDb());
  assert.ok(exam.questions.every((q) => !myths.has(q.itemId)));
  assert.ok(exam.questions.every((q) => !q.choices.some((c) => c.includes('activity all over'))));
});

test('a myth answer is a real recall: it introduces the card and grades it once per day', () => {
  const day = new Date(2026, 10, 3, 10);
  const a = (correct: boolean) =>
    recordAttempt({ sessionId: 'm', itemId: myth.id, format: 'flip', correct, responseMs: 900, xp: 1 }, getDb(), day);
  assert.notEqual(a(true).grade, null, 'the first answer of the day grades');
  assert.equal(a(false).grade, null, 'a second one the same day does not');
  assert.ok(getDb().prepare('SELECT introduced_day FROM srs WHERE item_id = ?').get(myth.id)?.introduced_day);
});

test('.lernpack, CSV and JSON carry the myth type; Anki gets a basic card', () => {
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const cards = strFromU8(pack['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const exported = cards.find((c) => c.front === MYTH.front);
  assert.equal(exported.type, 'myth');
  assert.ok(!exported.extra?.myth, 'a type, not an extra field');
  assert.ok(cards.filter((c) => c.type === 'myth').length === 2);
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  const back = importFile('Again.csv', strToU8(csv));
  assert.equal(allItems(getDb(), back.deck.id).filter(isMyth).length, 2);
  const json = importFile('j.json', strToU8(JSON.stringify([{ ...MYTH, type: 'myth' }])));
  assert.ok(isMyth(allItems(getDb(), json.deck.id)[0]));
  assert.ok(exportDeck(deck.id, 'apkg').data.length > 0);
});
