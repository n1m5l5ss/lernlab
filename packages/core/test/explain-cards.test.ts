// "Explain it" cards (#199): a why/how question with 2–5 key points, carried by every file format.
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
const { allItems } = await import('../src/learn');
const { isExplain, keyPointsAsBack } = await import('../src/explain');
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
