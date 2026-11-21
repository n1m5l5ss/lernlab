// Guess first: before the first new cards of a new topic, an optional round asks a few of its questions.
// It is practice only: planning or playing it never changes the schedule.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';
import type { Block, Item, SessionPlan } from '../src/types';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-guess-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { createDeck } = await import('../src/library');
const { planSession } = await import('../src/session');
const { recordAttempt } = await import('../src/learn');
const { getDb } = await import('../src/db');
const { GUESS_MIN, guessable, guessCard, pickGuessRound, topicsOf } = await import('../src/guess');
after(() => cleanupTempDir(dir));

const csv = (rows: string[]) => strToU8(`front,back,tags\n${rows.join('\n')}\n`);
const day = new Date(2026, 10, 23, 10);
const idsOf = (deckId: number, where = '1') =>
  getDb()
    .prepare(`SELECT id FROM items WHERE deck_id = ? AND ${where} ORDER BY ord, id`)
    .all(deckId)
    .map((r) => Number(r.id));
const intro = (id: number) =>
  recordAttempt({ sessionId: 's', itemId: id, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), day);
const guessOf = (plan: SessionPlan) =>
  plan.blocks.find((b): b is Extract<Block, { kind: 'guess' }> => b.kind === 'guess');
const freshOf = (plan: SessionPlan) =>
  plan.blocks
    .flatMap((b) => (b.kind === 'learn' && 'exercises' in b ? b.exercises : []))
    .flatMap((e) => (e.type === 'intro' ? [e.itemId] : []));
const srsRows = () => Number(getDb().prepare('SELECT COUNT(*) AS n FROM srs').get()!.n);

const bio = createDeck('Biology');
importFile(
  'bio.csv',
  csv([
    ...Array.from({ length: 8 }, (_, i) => `What does organelle ${i} do?,It makes part ${i},cells`),
    ...Array.from({ length: 8 }, (_, i) => `What does gene ${i} code for?,Protein ${i},genes`),
    ...Array.from({ length: 3 }, (_, i) => `Tiny topic question ${i}?,Answer ${i},tiny`),
  ]),
  { deckId: bio.id },
);
const cells = idsOf(bio.id, `tags LIKE '%"cells"%'`);
const genes = idsOf(bio.id, `tags LIKE '%"genes"%'`);

test('a new topic opens with a guess round on the cards about to be introduced, before them', () => {
  const plan = planSession('standard', getDb(), day, bio.id);
  const guess = guessOf(plan);
  assert.ok(guess, 'the round is offered');
  assert.equal(guess.topic, 'cells');
  assert.ok(guess.itemIds.length >= GUESS_MIN && guess.itemIds.length <= 8, '5 to 8 questions');
  assert.ok(
    guess.itemIds.every((id) => cells.includes(id)),
    'only questions of that topic',
  );
  const fresh = freshOf(plan);
  assert.ok(fresh.length > 0);
  assert.ok(
    fresh.filter((id) => cells.includes(id)).every((id) => guess.itemIds.includes(id)),
    "the new cards of the topic are asked, so the guess helps on them (it doesn't spill to other material)",
  );
  const at = (kind: string) => plan.blocks.findIndex((b) => b.kind === kind);
  assert.ok(at('guess') < at('learn'), 'the guess round comes before the cards are met');
  assert.equal(guess.teacher.key, 'teacher.block.guess');
  assert.ok(
    guess.itemIds.every((id) => plan.items[id]),
    'the plan carries the cards',
  );
});

test('session length sets how many questions are asked: 5 in a short session, at most 8', () => {
  assert.equal(guessOf(planSession('mini', getDb(), day, bio.id))!.itemIds.length, 5);
  const long = guessOf(planSession('long', getDb(), day, bio.id))!;
  assert.equal(long.itemIds.length, 8);
});

test('planning a guess round changes nothing: no card is introduced or graded', () => {
  const before = srsRows();
  const states = Number(getDb().prepare('SELECT COUNT(*) AS n FROM item_state').get()!.n);
  for (let i = 0; i < 3; i++) planSession('long', getDb(), day, bio.id);
  assert.equal(srsRows(), before);
  assert.equal(Number(getDb().prepare('SELECT COUNT(*) AS n FROM item_state').get()!.n), states);
});

test('practice sessions teach nothing new, so they have no guess round', () => {
  assert.equal(guessOf(planSession('standard', getDb(), day, bio.id, { practice: true })), undefined);
});

test('once a card of the topic is seen, the topic is no longer new; the next new topic gets its round', () => {
  intro(cells[0]);
  const plan = planSession('standard', getDb(), day, bio.id);
  assert.ok(!guessOf(plan) || guessOf(plan)!.topic !== 'cells', 'cells is under way: no second round');
  for (const id of cells) intro(id);
  const next = guessOf(planSession('standard', getDb(), new Date(2026, 10, 24, 10), bio.id));
  assert.ok(next, 'genes is a new topic');
  assert.equal(next.topic, 'genes');
  assert.ok(next.itemIds.every((id) => genes.includes(id)));
});

test('a topic too small to ask 5 questions gets no round', () => {
  const small = createDeck('Small');
  importFile('s.csv', csv(['Q1?,A1,few', 'Q2?,A2,few', 'Q3?,A3,few']), { deckId: small.id });
  assert.equal(guessOf(planSession('standard', getDb(), day, small.id)), undefined);
});

test('an untagged deck is one topic; sub-decks are topics of their own', () => {
  const flat = createDeck('Flat');
  importFile('f.csv', csv(Array.from({ length: 8 }, (_, i) => `Flat question ${i}?,Flat answer ${i},`)), {
    deckId: flat.id,
  });
  const guess = guessOf(planSession('standard', getDb(), day, flat.id));
  assert.ok(guess);
  assert.equal(guess.topic, 'Flat', 'named after the deck');
});

test('vocabulary decks never get a guess round: foreign words cannot be guessed', () => {
  const es = createDeck('Spanish', 'es');
  importFile('es.csv', csv(Array.from({ length: 10 }, (_, i) => `palabra${i},word ${i},basics`)), { deckId: es.id });
  assert.equal(guessOf(planSession('long', getDb(), day, es.id)), undefined);
});

const item = (p: Partial<Item>): Item => ({
  id: 1,
  deckId: 1,
  lang: null,
  deck: '',
  image: null,
  video: null,
  category: null,
  extra: {},
  kind: 'card',
  target: 'Q',
  article: null,
  word: 'Q',
  meaning: 'A',
  sentenceHtml: '',
  sentence: '',
  sentenceMeaning: '',
  grammar: '',
  notes: '',
  audio: null,
  rank: 0,
  tags: [],
  group: null,
  ...p,
});

test('only cards a learner could reason about are guessable', () => {
  for (const kind of ['card', 'cloze', 'numeric'] as const) assert.ok(guessable(item({ kind })), kind);
  assert.ok(guessable(item({ kind: 'mcq', extra: { choices: 'A|B', correct: '1' } })));
  assert.ok(!guessable(item({ kind: 'mcq' })), 'a question card with no usable choices');
  for (const kind of ['noun', 'verb', 'word', 'phrase', 'grammar', 'number', 'order', 'occlusion'] as const)
    assert.ok(!guessable(item({ kind })), kind);
  assert.ok(!guessable(item({ kind: 'card', lang: 'fr' })), 'cards of a language deck');
  assert.ok(guessable(item({ kind: 'code', target: 'Output?', meaning: '3', extra: { code: 'print(1+2)' } })));
  assert.ok(!guessable(item({ kind: 'code', meaning: '', extra: { code: 'a\nb' } })), 'line ordering is not a guess');
});

test('topics are the tags, or else the sub-deck, or else the deck', () => {
  assert.deepEqual(
    topicsOf(item({ tags: ['a', 'b'], deck: 'X::Y' })).map((t) => t.value),
    ['a', 'b'],
  );
  assert.deepEqual(topicsOf(item({ deck: 'Bio::Cells' })), [{ kind: 'sub', deckId: 1, value: 'Bio::Cells' }]);
  assert.deepEqual(topicsOf(item({})), [{ kind: 'sub', deckId: 1, value: '' }]);
});

test('the round picks the first new topic with enough questions, fresh cards first, capped', () => {
  const its = Array.from({ length: 12 }, (_, i) => item({ id: i + 1, tags: [i < 2 ? 'small' : 'big'] }));
  const isNew = () => true;
  const r = pickGuessRound([its[0], its[5]], its, isNew, 6)!;
  assert.equal(r.topic.value, 'big', 'small has only 2 questions');
  assert.equal(r.ids[0], 6, 'the new card comes first');
  assert.equal(r.ids.length, 6);
  assert.equal(
    pickGuessRound([its[5]], its, () => false, 6),
    null,
    'nothing new',
  );
  assert.equal(pickGuessRound([], its, isNew, 6), null, 'no new cards today');
});

test('a guess card shows the question and, after the guess, the answer', () => {
  const plain = guessCard(item({ target: 'Capital of Peru?', meaning: 'Lima', notes: 'On the coast' }));
  assert.deepEqual(plain, {
    prompt: 'Capital of Peru?',
    answer: 'Lima',
    choices: [],
    correct: [],
    explanation: 'On the coast',
  });
  const mcq = guessCard(
    item({ kind: 'mcq', target: 'Serverless?', meaning: '', extra: { choices: 'EC2|Lambda|RDS', correct: '2' } }),
  );
  assert.deepEqual(mcq.choices, ['EC2', 'Lambda', 'RDS']);
  assert.equal(mcq.answer, 'Lambda');
  assert.deepEqual(mcq.correct, [1]);
  const cz = guessCard(item({ kind: 'cloze', target: 'Water boils at {{c1::100}} °C', meaning: '' }));
  assert.equal(cz.prompt, 'Water boils at […] °C');
  assert.equal(cz.answer, 'Water boils at <b>100</b> °C');
  const code = guessCard(
    item({
      kind: 'code',
      target: 'What does it print?',
      meaning: '3',
      extra: { code: 'print(1+2)', codeLang: 'python' },
    }),
  );
  assert.deepEqual(code.code, { code: 'print(1+2)', lang: 'python' });
  assert.equal(code.answer, '3');
});
