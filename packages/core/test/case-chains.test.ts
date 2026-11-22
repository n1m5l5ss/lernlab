// Case chains (#209): ordinary cards of one deck that share a case. Each question is its own card with its own
// schedule; the case travels with every one. Sessions keep a chain together and out of games; mock exams draw
// a chain whole. Files carry the case as an optional field; older readers get it in front of the question.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-cases-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { cardToItem, createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { CASE_MAX_LENGTH, caseHtml, caseOf, chainOf, cleanCase, hasCase, keepChains, questionOf } =
  await import('../src/cases');
const { guessable } = await import('../src/guess');
const { buildExam } = await import('../src/examplan');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const CASE = 'A 58-year-old man has crushing chest pain for 40 minutes. His ECG shows ST elevation in II, III and aVF.';
const chain = [
  { front: 'What is the most likely diagnosis?', back: 'Inferior STEMI' },
  { front: 'Which artery is most likely blocked?', back: 'Right coronary artery' },
  {
    front: 'What is the first-line treatment?',
    back: 'Primary PCI within 120 minutes',
    type: 'mcq',
    choices: 'Primary PCI|Watchful waiting|Antibiotics',
    correct: '1',
  },
].map((c) => ({ ...c, case: CASE, tags: ['cardiology'] }));
const plainCards = ['Atrium', 'Ventricle', 'Aorta', 'Septum', 'Valve'].map((w, i) => ({
  front: w,
  back: `heart part ${i}`,
  tags: ['anatomy'],
}));

const deck = createDeck('Cardiology', null);
upsertCards(deck, [...plainCards.slice(0, 2), ...chain, ...plainCards.slice(2)]);
const items = allItems(getDb(), deck.id);
const questions = items.filter(hasCase);
const ids = questions.map((i) => i.id);

test('a case is plain text on one line; a card keeps it, and a front that starts with it is the question alone', () => {
  assert.equal(cleanCase(' <b>A patient</b>\n\nwith <script>x</script>pain '), 'A patient with pain');
  assert.equal(cleanCase('x'.repeat(5000)).length, CASE_MAX_LENGTH);
  assert.equal(cleanCase(cleanCase(CASE)), CASE);
  assert.equal(caseHtml('BP **90/60** <low>'), 'BP <b>90/60</b> &lt;low&gt;');
  assert.equal(questions.length, 3);
  assert.deepEqual(
    questions.map((q) => [q.kind, caseOf(q)]),
    [
      ['card', CASE],
      ['card', CASE],
      ['mcq', CASE],
    ],
  );
  const d = { id: 1, name: 'D', language: null };
  assert.equal(cardToItem(d, { front: `${CASE}\n\nWhat now?`, back: 'PCI', case: CASE })!.target, 'What now?');
  assert.equal(cardToItem(d, { front: CASE, back: 'x', case: CASE })!.target, CASE, 'never an empty front');
  assert.equal(questionOf('Other question', CASE), 'Other question');
  assert.ok(!hasCase(cardToItem(d, { front: 'The {{c1::heart}} pumps', back: '', case: CASE })!), 'questions only');
  assert.ok(!hasCase(cardToItem(d, { front: 'Q', back: 'A', extra: { case: CASE }, case: '' })!), "'' clears it");
  assert.ok(hasCase(cardToItem(d, { front: 'Q', back: 'A', extra: { case: CASE } })!), 'kept when not sent');
});

test('a chain is the cards of one deck with the same case, in deck order, and stays together', () => {
  assert.deepEqual(
    chainOf(questions[1], items).map((i) => i.id),
    ids,
  );
  assert.deepEqual(chainOf(items[0], items), [items[0]]);
  const get = (id: number) => items.find((i) => i.id === id)!;
  const pos = (id: number) => items.findIndex((i) => i.id === id);
  const others = items.filter((i) => !hasCase(i)).map((i) => i.id);
  const mixed = [ids[2], others[0], ids[0], others[1], ids[1]];
  assert.deepEqual(keepChains(mixed, get, pos), [...ids, others[0], others[1]]);
});

test('sessions ask the questions of a case together and in order, never in games or guess rounds', () => {
  assert.equal(guessable(questions[0]), false);
  for (let k = 0; k < 5; k++) {
    const plan = planSession('long', getDb(), new Date(2026, 10, 23, 10), deck.id);
    for (const b of plan.blocks) {
      if ('itemIds' in b)
        assert.ok(
          b.itemIds.every((id) => !ids.includes(id)),
          b.title,
        );
      if (!('exercises' in b)) continue;
      const asked = b.exercises.flatMap((e) => ('itemId' in e && ids.includes(e.itemId) ? [e] : []));
      for (const e of asked) assert.ok(['typed', 'flip', 'mcq'].includes(e.type), `${b.title}: ${e.type}`);
      assert.deepEqual(
        asked.map((e) => e.itemId),
        ids.slice(0, asked.length),
        `${b.title}: in order`,
      );
      const at = b.exercises.flatMap((e, i) => ('itemId' in e && ids.includes(e.itemId) ? [i] : []));
      assert.ok(
        at.every((i, n) => n === 0 || i === at[n - 1] + 1),
        `${b.title}: next to each other`,
      );
    }
    assert.equal(caseOf(plan.items[ids[0]]), CASE, 'the session has the case to show');
  }
});

test('each question is its own card: one answered and graded, the others untouched', () => {
  const day = new Date(2026, 10, 23, 10);
  const a = { sessionId: 'c', format: 'flip' as const, correct: true, responseMs: 5000, xp: 1 };
  assert.equal(recordAttempt({ ...a, itemId: ids[0] }, getDb(), day).grade, 3);
  assert.equal(recordAttempt({ ...a, itemId: ids[0] }, getDb(), day).grade, null, 'once per day');
  assert.equal(
    Number(getDb().prepare('SELECT COUNT(*) AS n FROM srs WHERE item_id IN (?, ?)').get(ids[1], ids[2])!.n),
    0,
  );
});

test('a mock exam draws a case whole, its questions in order with the case shown', () => {
  for (let k = 0; k < 10; k++) {
    const exam = buildExam(deck.id, getDb());
    const at = exam.questions.flatMap((q, i) => (ids.includes(q.itemId) ? [i] : []));
    assert.deepEqual(
      at.map((i) => exam.questions[i].itemId),
      ids,
      'all three, in order',
    );
    assert.ok(
      at.every((i, n) => n === 0 || i === at[n - 1] + 1),
      'next to each other',
    );
    for (const i of at) assert.equal(exam.questions[i].caseText, caseHtml(CASE));
    assert.ok(exam.questions.filter((q) => !ids.includes(q.itemId)).every((q) => !q.caseText));
  }
});

test('.lernpack, CSV and JSON carry the case; older readers get it in front of the question', () => {
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const cards = strFromU8(pack['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const first = cards.find((c) => c.back === 'Inferior STEMI');
  assert.equal(first.case, CASE);
  assert.equal(first.front, `${CASE}\n\nWhat is the most likely diagnosis?`);
  assert.ok(!first.extra?.case, 'a field, not an extra');
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /,case,/);
  const again = importFile('Again.csv', strToU8(csv));
  const back = allItems(getDb(), again.deck.id).filter(hasCase);
  assert.deepEqual(
    back.map((i) => [i.target, caseOf(i)]),
    questions.map((i) => [i.target, CASE]),
  );
  const repack = importFile('Again.lernpack', exportDeck(deck.id, 'lernpack').data);
  assert.deepEqual(
    [repack.added, repack.updated],
    [0, items.length],
    'the same cards: the case in the front does not make new ones',
  );
  assert.deepEqual(
    allItems(getDb(), deck.id)
      .filter(hasCase)
      .map((i) => i.target),
    questions.map((i) => i.target),
  );
  const json = importFile('j.json', strToU8(JSON.stringify([{ front: 'Q?', back: 'A', case: 'A short case.' }])));
  assert.equal(caseOf(allItems(getDb(), json.deck.id)[0]), 'A short case.');
});
