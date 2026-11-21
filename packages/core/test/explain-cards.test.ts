// "Explain it" cards (#199): a why/how question with 2–5 key points. The session asks for an explanation, then
// shows the model answer and the key points to tick. It is a real recall: one FSRS grade per card per day.
// Games, distractors, guess rounds and exams leave explain cards out; cards tagged why/how never flip.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-explain-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { isExplain, explainOutcome, keyPointsAsBack } = await import('../src/explain');
const { guessable } = await import('../src/guess');
const { buildExam } = await import('../src/examplan');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const SEASONS = {
  front: 'Why do we have seasons?',
  back: "Earth's tilted axis changes how directly sunlight hits each half.",
  keyPoints: 'Earth is tilted|The tilt changes the angle of sunlight|Not the distance to the sun',
};
const TIDES = {
  front: 'How do tides form?',
  back: '',
  keyPoints: "The moon's gravity pulls the oceans|Earth turns under the bulges",
};

const deck = createDeck('Earth science', null);
upsertCards(deck, [
  { ...SEASONS, type: 'explain', tags: ['earth'] },
  { ...TIDES, type: 'explain', tags: ['earth'] },
  { front: 'Equinox', back: 'day and night equally long', tags: ['earth'], category: 'time' },
  { front: 'Solstice', back: 'the longest or shortest day', tags: ['earth'], category: 'time' },
  { front: 'Axis', back: 'the line Earth spins around', tags: ['earth'], category: 'space' },
  { front: 'Orbit', back: 'the path around the sun', tags: ['earth'], category: 'space' },
  {
    front: 'Why is the sky blue?',
    back: 'Air scatters blue light more than red light, so blue reaches our eyes from every direction.',
    tags: ['earth', 'why'],
  },
]);
const items = allItems(getDb(), deck.id);
const seasons = items.find((i) => i.target === SEASONS.front)!;
const explains = new Set(items.filter(isExplain).map((i) => i.id));
const sky = items.find((i) => i.target === 'Why is the sky blue?')!;

test('sessions ask explain cards only as explanations: no games, pairs, sprints, guess rounds or exams', () => {
  assert.equal(explains.size, 2);
  assert.equal(guessable(seasons), false);
  for (let k = 0; k < 5; k++) {
    const plan = planSession('standard', getDb(), new Date(2026, 10, 2, 10), deck.id);
    for (const b of plan.blocks) {
      if ('itemIds' in b)
        assert.ok(
          b.itemIds.every((id) => !explains.has(id)),
          b.title,
        );
      if (!('exercises' in b)) continue;
      for (const e of b.exercises) {
        if (!('itemId' in e)) continue;
        if (explains.has(e.itemId)) assert.equal(e.type, 'explain', `${b.title}: ${e.type}`);
        if (e.itemId === sky.id) assert.ok(e.type !== 'flip', 'a why card never flips');
      }
    }
    const all = plan.blocks.flatMap((b) => ('exercises' in b ? b.exercises : []));
    assert.ok(
      all.filter((e) => e.type === 'explain' && explains.has(e.itemId)).length >= 2,
      'new explain cards are asked',
    );
    for (const e of all)
      if (e.type === 'mc' || e.type === 'truefalse')
        assert.ok(!JSON.stringify(e).includes('tilted axis'), 'never a distractor');
  }
  const exam = buildExam(deck.id, getDb());
  assert.ok(exam.questions.length > 0);
  assert.ok(exam.questions.every((q) => !explains.has(q.itemId)));
  assert.ok(exam.questions.every((q) => !q.choices.some((c) => c.includes('tilted axis'))));
});

test('an explanation is a real recall: it introduces the card and grades it once per day, never Easy when new', () => {
  const day = new Date(2026, 10, 3, 10);
  const a = (o: ReturnType<typeof explainOutcome>, when = day) =>
    recordAttempt(
      { sessionId: 'e', itemId: seasons.id, format: 'flip', responseMs: 40_000, xp: 1, ...o },
      getDb(),
      when,
    );
  assert.equal(a(explainOutcome(3, 3, true)).grade, 3, 'a new card is Good at most');
  assert.equal(a(explainOutcome(0, 3)).grade, null, 'a second answer the same day does not grade');
  assert.ok(getDb().prepare('SELECT introduced_day FROM srs WHERE item_id = ?').get(seasons.id)?.introduced_day);
  assert.equal(a(explainOutcome(3, 3, true), new Date(2026, 10, 6, 10)).grade, 4, '"That was easy" after a review');
  assert.equal(a(explainOutcome(1, 3, true), new Date(2026, 10, 9, 10)).grade, 2, 'some points: Hard, never Easy');
});

test('.lernpack, CSV and JSON carry the explain type and key points; older readers get the points as the back', () => {
  const pack = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const cards = strFromU8(pack['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const s = cards.find((c) => c.front === SEASONS.front);
  assert.equal(s.type, 'explain');
  assert.equal(s.keyPoints, SEASONS.keyPoints);
  assert.equal(s.back, SEASONS.back);
  assert.ok(!s.extra?.keyPoints, 'a field, not an extra');
  const t = cards.find((c) => c.front === TIDES.front);
  assert.equal(t.back, keyPointsAsBack(TIDES.keyPoints.split('|')), 'no model answer: the points are the back');
  const csv = strFromU8(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /,key_points,/);
  const again = importFile('Again.csv', strToU8(csv));
  const back = allItems(getDb(), again.deck.id).filter(isExplain);
  assert.equal(back.length, 2);
  assert.equal(back.find((i) => i.target === TIDES.front)!.meaning, '', 'the joined points are not kept as a back');
  const json = importFile('j.json', strToU8(JSON.stringify([{ ...SEASONS, type: 'explain' }])));
  assert.ok(isExplain(allItems(getDb(), json.deck.id)[0]));
  assert.ok(exportDeck(deck.id, 'apkg').data.length > 0);
});
