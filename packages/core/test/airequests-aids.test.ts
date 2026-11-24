// Study aids an AI assistant proposes for cards that exist: question variants, corrections, key points,
// prerequisites, a memory aid and key terms. Cleaned like an import, fitted to the card, never scheduled.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-airequests-aids-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { applyAiRequest, cardSnapshots, cleanAids, fitChangesFor } = await import('../src/airequests');
const { createDeck, upsertCards } = await import('../src/library');
const { findCards } = await import('../src/browse');
const { recordAttempt } = await import('../src/learn');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const createdAt = '2026-11-22T10:00:00.000Z';
let n = 0;
const rid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const deck = createDeck('Cells', null, {}, '');
upsertCards(deck, [
  { front: 'What is osmosis?', back: 'Water moves across a membrane to the saltier side' },
  {
    front: 'Which organelle makes ATP?',
    back: '',
    type: 'mcq',
    choices: 'Ribosome|Mitochondrion|Nucleus',
    correct: '2',
  },
  { front: 'Why do cells divide?', back: '', type: 'explain', keyPoints: 'Growth|Repair' },
  { front: 'The {{c1::nucleus}} holds DNA', back: '' },
]);
const cardId = (front: string) => findCards({ q: front }).rows[0].id;
const snap = (id: number) => cardSnapshots([id])[0];
const extraOf = (id: number) =>
  JSON.parse(String(getDb().prepare('SELECT extra FROM items WHERE id = ?').get(id)!.extra)) as Record<string, string>;
const edit = (card: number, changes: Parameters<typeof cleanAids>[0]) =>
  applyAiRequest({ id: rid(), createdAt, kind: 'edit_card', cardId: card, changes });

test('hostile aids come out as plain text within the importer limits', () => {
  const c = cleanAids({
    variants: [
      'apply: A cell sits in salt water. <script>alert(1)</script>What happens?',
      'analyse: one | recall: smuggled',
      'apply: A cell sits in salt water. What happens?',
      '<img src=x onerror=alert(1)>',
      ...Array.from({ length: 20 }, (_, i) => `recall: question ${i} ${'x'.repeat(900)}`),
    ],
    corrections: [
      '<b onclick="x()">It builds proteins</b>',
      '',
      '&lt;b&gt;It stores DNA&lt;/b&gt;&lt;script&gt;alert(2)&lt;/script&gt;',
      '',
      '',
    ],
    keyPoints: ['<i>Growth</i>', 'growth', 'Repair|Reproduction', ...Array.from({ length: 9 }, (_, i) => `p${i}`)],
    requires: ['<a href="javascript:alert(1)">Membrane</a>', '#cells', 'y'.repeat(999), ...Array(20).fill('#t')],
    mnemonic: `<style>*{display:none}</style>Water follows salt ${'z'.repeat(999)}`,
    keyTerms: ['membrane', 'a=b', '<b>saltier</b>', 'w'.repeat(101)],
  });
  const all = JSON.stringify(c);
  assert.ok(!/[<>]|onerror|onclick/.test(all), all);
  assert.equal(c.variants!.length, 8);
  assert.equal(c.variants![1], 'analyse: one / recall: smuggled', 'a | cannot split an entry');
  assert.ok(c.variants!.every((v) => v.length <= 510));
  assert.deepEqual(c.corrections, ['It builds proteins', '', 'It stores DNA'], 'blanks at the end go, positions stay');
  assert.deepEqual(c.keyPoints!.slice(0, 2), ['Growth', 'Repair/Reproduction']);
  assert.equal(c.keyPoints!.length, 5);
  assert.ok(c.requires!.length <= 10 && c.requires!.every((r) => r.length <= 200));
  assert.equal(c.requires![0], 'Membrane');
  assert.ok(c.mnemonic!.length <= 300);
  assert.deepEqual(c.keyTerms, ['membrane', 'saltier']);
  assert.equal(cleanAids({ keyPoints: ['only one'] }).keyPoints, undefined, 'one point is no explain card');
});

test('accepted variants, prerequisites, a memory aid and key terms are saved; the schedule stays', () => {
  const card = cardId('osmosis');
  recordAttempt({ sessionId: 's1', itemId: card, format: 'intro', correct: true, responseMs: 1000, xp: 5 }, getDb());
  const srs = () => JSON.stringify(getDb().prepare('SELECT * FROM srs WHERE item_id = ?').get(card));
  const attempts = () => Number(getDb().prepare('SELECT COUNT(*) AS n FROM attempts').get()!.n);
  const before = [srs(), attempts()];
  assert.deepEqual(snap(card).variants, []);
  edit(card, {
    variants: ['apply: A cell sits in salt water. What happens to it?', 'Why does a raisin swell in water?'],
    requires: ['The {{c1::nucleus}} holds DNA', '#basics'],
    mnemonic: 'Water <b>follows</b> salt',
    keyTerms: ['membrane', 'not in the answer'],
  });
  const now = snap(card);
  assert.deepEqual(now.variants, [
    'apply: A cell sits in salt water. What happens to it?',
    'recall: Why does a raisin swell in water?',
  ]);
  assert.deepEqual(now.requires, ['The {{c1::nucleus}} holds DNA', '#basics']);
  assert.equal(now.mnemonic, 'Water follows salt');
  assert.deepEqual(now.keyTerms, ['membrane']);
  assert.equal(now.front, 'What is osmosis?');
  assert.deepEqual([srs(), attempts()], before, 'no review, no schedule change');
  // An empty list clears a field; the others stay.
  edit(card, { variants: [], mnemonic: '' });
  assert.deepEqual(snap(card).variants, []);
  assert.equal(snap(card).mnemonic, '');
  assert.deepEqual(snap(card).keyTerms, ['membrane']);
});

test('corrections go to the wrong choices of a multiple-choice card only', () => {
  const card = cardId('ATP');
  assert.deepEqual(snap(card).choices, ['Ribosome', 'Mitochondrion', 'Nucleus']);
  assert.deepEqual(snap(card).correct, [1]);
  edit(card, {
    corrections: [
      'Ribosomes build <script>x</script>proteins',
      'for the right choice',
      'It stores DNA',
      'no such choice',
    ],
  });
  assert.deepEqual(snap(card).corrections, ['Ribosomes build proteins', '', 'It stores DNA']);
  assert.equal(extraOf(card).choices, 'Ribosome|Mitochondrion|Nucleus', 'the choices are untouched');
  // Not a card answered in writing: variants and key terms do not fit, and nothing else changes.
  assert.deepEqual(fitChangesFor(card, { variants: ['apply: x'], keyTerms: ['Ribosome'] })!.unfit, [
    'variants',
    'keyTerms',
  ]);
  edit(card, { variants: ['apply: x'] });
  assert.equal(extraOf(card).variants, undefined);
  assert.deepEqual(fitChangesFor(card, { corrections: ['', 'only the right one'] })!.unfit, ['corrections']);
});

test('key points and a model explanation replace those of an explain card; other cards never become one', () => {
  const card = cardId('divide');
  assert.deepEqual(snap(card).keyPoints, ['Growth', 'Repair']);
  edit(card, { keyPoints: ['Growth', 'Repair of tissue', 'Reproduction'] });
  assert.deepEqual(snap(card).keyPoints, ['Growth', 'Repair of tissue', 'Reproduction']);
  assert.equal(snap(card).back, '', 'the old points are not kept as the explanation');
  edit(card, { back: 'Cells divide to grow, to repair tissue and to reproduce.' });
  assert.equal(snap(card).back, 'Cells divide to grow, to repair tissue and to reproduce.');
  assert.deepEqual(snap(card).keyPoints, ['Growth', 'Repair of tissue', 'Reproduction']);
  edit(card, { keyPoints: ['just one'] });
  assert.equal(snap(card).keyPoints.length, 3, 'too few points change nothing');

  const basic = cardId('osmosis');
  assert.deepEqual(fitChangesFor(basic, { keyPoints: ['a', 'b'], corrections: ['x'] })!.unfit, [
    'corrections',
    'keyPoints',
  ]);
  edit(basic, { keyPoints: ['a', 'b'], corrections: ['x'] });
  assert.equal(extraOf(basic).keyPoints, undefined);
  assert.equal(extraOf(basic).corrections, undefined);
  assert.equal(snap(basic).back, 'Water moves across a membrane to the saltier side');
  const cloze = cardId('holds DNA');
  assert.deepEqual(fitChangesFor(cloze, { variants: ['apply: x'], mnemonic: 'DNA in the core' })!.unfit, ['variants']);
  assert.equal(fitChangesFor(999_999, { mnemonic: 'x' }), null);
});

test('new cards can come with prerequisites, a memory aid and key terms', () => {
  const r = applyAiRequest({
    id: rid(),
    createdAt,
    kind: 'add_cards',
    deckId: deck.id,
    cards: [
      {
        front: 'What is diffusion?',
        back: 'Particles spread from high to low concentration',
        requires: ['What is osmosis?', '<b>#basics</b>'],
        mnemonic: '<img src=x onerror=alert(1)>Perfume fills a room',
        keyTerms: ['concentration', 'elsewhere'],
      },
    ],
  });
  assert.equal(r.added, 1);
  const now = snap(cardId('diffusion'));
  assert.deepEqual(now.requires, ['What is osmosis?', '#basics']);
  assert.equal(now.mnemonic, 'Perfume fills a room');
  assert.deepEqual(now.keyTerms, ['concentration']);
  assert.equal(findCards({ q: 'diffusion' }).rows[0].state, 'new');
});
