// Question variants in study (#198): reviews rotate a card's wordings, new cards learn the card's own
// question first, the level of each answer is logged, and FSRS still grades one card once per day.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-variants-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { recall } = await import('../src/exercises');
const { variantIndex, variantsOf } = await import('../src/variants');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const deck = createDeck('Pharmacology', null);
upsertCards(deck, [
  {
    front: 'Beta blocker',
    back: 'propranolol',
    variants: 'apply: A patient with angina & a dose < 5? | analyse: What if the dose doubles?',
  },
  {
    front: 'Long answer card with a front of many words',
    back: 'a long answer that has many more than six words in it',
    variants: 'apply: Why?',
  },
  { front: 'Statin', back: 'atorvastatin' },
  { front: 'ACE inhibitor', back: 'ramipril' },
]);
const items = allItems(getDb(), deck.id);
const beta = items.find((i) => i.target === 'Beta blocker')!;
const long = items.find((i) => i.target.startsWith('Long answer card'))!;

test('a recall asks the chosen wording, with the same answer and its level; 0 is the card itself', () => {
  const own = recall(beta);
  assert.equal(own.type, 'typed');
  assert.ok(own.type === 'typed' && own.prompt === 'Beta blocker' && own.level === undefined);
  const apply = recall(beta, 1);
  assert.ok(apply.type === 'typed');
  assert.equal(apply.prompt, 'A patient with angina &amp; a dose &lt; 5?', 'plain text, shown as text');
  assert.equal(apply.level, 'apply');
  assert.deepEqual(apply.accepted, own.type === 'typed' ? own.accepted : []);
  const flip = recall(long, 1);
  assert.ok(flip.type === 'flip');
  assert.equal(flip.prompt, 'Why?');
  assert.equal(flip.level, 'apply');
  const outOfRange = recall(beta, 9);
  assert.ok(outOfRange.type === 'typed' && outOfRange.level === undefined, 'out of range: the card itself');
});

test('reviews rotate the wording; new cards are learned with their own question', () => {
  const day1 = new Date(2026, 10, 2, 10);
  const fresh = planSession('standard', getDb(), day1, deck.id);
  const freshAsks = fresh.blocks
    .flatMap((b) => ('exercises' in b ? b.exercises : []))
    .filter((e) => (e.type === 'typed' || e.type === 'flip') && e.itemId === beta.id);
  assert.ok(freshAsks.length > 0);
  assert.ok(
    freshAsks.every((e) => (e.type === 'typed' || e.type === 'flip') && !e.level),
    'a new card first learns its own question',
  );
  for (const i of items) {
    recordAttempt(
      { sessionId: 's1', itemId: i.id, format: 'intro', correct: true, responseMs: 900, xp: 1 },
      getDb(),
      day1,
    );
    recordAttempt(
      { sessionId: 's1', itemId: i.id, format: 'typed', correct: true, responseMs: 900, xp: 1 },
      getDb(),
      day1,
    );
  }
  // Three reviews, years apart so the card is due each time: each asks the next wording.
  const seen: (string | undefined)[] = [];
  for (const year of [2028, 2031, 2036]) {
    const when = new Date(year, 2, 1, 10);
    const plan = planSession('standard', getDb(), when, deck.id);
    const ask = plan.blocks
      .filter((b) => b.kind === 'drill' && (b.title === 'Review' || b.title === 'Fill the gap'))
      .flatMap((b) => ('exercises' in b ? b.exercises : []))
      .find((e) => 'itemId' in e && e.itemId === beta.id);
    assert.ok(ask && ask.type === 'typed', `due in ${year}`);
    const reps = Number(getDb().prepare('SELECT reps FROM srs WHERE item_id = ?').get(beta.id)!.reps);
    const k = variantIndex(beta.id, reps, variantsOf(beta).length);
    assert.equal(ask.level, k ? variantsOf(beta)[k - 1].level : undefined);
    seen.push(ask.level);
    recordAttempt(
      { sessionId: 'r', itemId: beta.id, format: 'typed', correct: true, responseMs: 900, xp: 1 },
      getDb(),
      when,
    );
  }
  assert.deepEqual(new Set(seen), new Set([undefined, 'apply', 'analyse']), 'every wording comes up in turn');
});

test('one FSRS grade per card per day whichever wording is asked; each answer logs its level', () => {
  const day = new Date(2040, 5, 1, 10);
  const a = (level?: 'apply' | 'analyse') =>
    recordAttempt(
      { sessionId: 's2', itemId: beta.id, format: 'typed', correct: true, responseMs: 900, xp: 1, level },
      getDb(),
      day,
    );
  assert.notEqual(a('apply').grade, null, 'the first recall of the day grades');
  assert.equal(a('analyse').grade, null, 'another wording the same day does not');
  assert.equal(a().grade, null);
  const levels = getDb()
    .prepare("SELECT level FROM attempts WHERE session_id = 's2' ORDER BY id")
    .all()
    .map((r) => r.level);
  assert.deepEqual(levels, ['apply', 'analyse', null]);
  recordAttempt(
    // A level that is not one of the three is not stored.
    { sessionId: 's3', itemId: beta.id, format: 'typed', correct: true, responseMs: 9, xp: 0, level: 'x' as 'apply' },
    getDb(),
    day,
  );
  assert.equal(getDb().prepare("SELECT level FROM attempts WHERE session_id = 's3'").get()!.level, null);
});
