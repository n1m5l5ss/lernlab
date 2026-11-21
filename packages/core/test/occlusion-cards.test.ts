// Image occlusion cards (#44): one card per box, siblings share an image and a group, studied as recall.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-occlusion-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { recall } = await import('../src/exercises');
const { occlusionOf } = await import('../src/occlusion');
const { recordAttempt, itemsByIds, allItems } = await import('../src/learn');
const { planSession } = await import('../src/session');
const { bulkCards } = await import('../src/browse');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const CSV = `front,back,type,image,image_alt,occlusion,occlusion_group,occlusion_mode
Label the heart,Aorta,occlusion,https://example.org/heart.png,A diagram of the heart,"0.4,0.05,0.2,0.1",h1,all
Label the heart,Left ventricle,occlusion,https://example.org/heart.png,A diagram of the heart,"0.55,0.6,0.25,0.2",h1,all
Label the heart,Right atrium,occlusion,https://example.org/heart.png,A diagram of the heart,"0.1,0.3,0.2,0.15",h1,all
No picture,Lost,occlusion,,,"0.1,0.1,0.1,0.1",,
Bad box,Kept as a basic card,occlusion,https://example.org/heart.png,,"nope",,
`;
const enc = (s: string) => new TextEncoder().encode(s);
const ids = (deckId: number) =>
  getDb()
    .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((r) => Number(r.id));
const load = (deckId: number) => {
  const all = ids(deckId);
  const byId = itemsByIds(all);
  return all.map((id) => byId[id]);
};

test('each box is its own card; siblings share the image and the group, and see each other', () => {
  const r = importFile('heart.csv', enc(CSV), { deckName: 'Heart' });
  assert.equal(r.added, 5);
  const [aorta, lv, ra, noPic, badBox] = load(r.deck.id);
  assert.deepEqual(
    [aorta.kind, lv.kind, ra.kind, noPic.kind, badBox.kind],
    ['occlusion', 'occlusion', 'occlusion', 'card', 'card'],
  );
  assert.equal(aorta.extra.occlusion, '0.4,0.05,0.2,0.1');
  assert.deepEqual([aorta.extra.occlusionGroup, aorta.extra.occlusionMode], ['h1', 'all']);
  assert.equal(badBox.extra.occlusion, undefined);
  const view = occlusionOf(lv)!;
  assert.deepEqual(
    view.boxes.map((b) => b.label),
    ['Aorta', 'Left ventricle', 'Right atrium'],
  );
  assert.equal(view.asked, 1);
  assert.equal(view.mode, 'all');
  assert.deepEqual(view.boxes[0].box, { x: 0.4, y: 0.05, w: 0.2, h: 0.1 });
});

test('suspending one box keeps it drawn for its siblings but leaves them in study', () => {
  const r = importFile('heart.csv', enc(CSV), { deckName: 'Heart 2' });
  const [aorta, lv] = load(r.deck.id);
  bulkCards([aorta.id], { kind: 'suspend' });
  const pool = allItems(getDb(), r.deck.id).filter((i) => i.kind === 'occlusion');
  assert.deepEqual(
    pool.map((i) => i.meaning),
    ['Left ventricle', 'Right atrium'],
  );
  assert.equal(occlusionOf(pool.find((i) => i.id === lv.id)!)!.boxes.length, 3, 'the suspended box still shows');
});

test('an occlusion card is recalled by typing its label, and counts once a day like any card', () => {
  const [aorta] = load(importFile('heart.csv', enc(CSV), { deckName: 'Heart 3' }).deck.id);
  const ex = recall(aorta);
  assert.ok(ex.type === 'typed');
  assert.deepEqual(ex.accepted, ['Aorta']);
  const base = { itemId: aorta.id, format: 'typed' as const, correct: true, sessionId: 's', responseMs: 3000, xp: 5 };
  assert.ok(recordAttempt(base).grade, 'graded on the first try');
  assert.equal(recordAttempt(base).grade, null, 'once a day');
});

test('a session asks occlusion cards as recall only, never in games, pictures, listening or speaking', () => {
  const deck = importFile('heart.csv', enc(CSV), { deckName: 'Heart 4' }).deck;
  const occl = new Set(load(deck.id).flatMap((i) => (i.kind === 'occlusion' ? [i.id] : [])));
  for (let k = 0; k < 5; k++) {
    const plan = planSession('long', getDb(), new Date(), deck.id);
    for (const b of plan.blocks) {
      if ('itemIds' in b && b.kind !== 'boss') assert.ok(!b.itemIds.some((id) => occl.has(id)), b.kind);
      if ('exercises' in b)
        for (const e of b.exercises) if ('itemId' in e && occl.has(e.itemId)) assert.equal(e.type, 'typed', b.title);
    }
    for (const id of occl) if (plan.items[id]) assert.equal(plan.items[id].occlusionBoxes?.length, 3);
  }
});

test('CSV and .lernpack exports keep boxes, group and mode, and import back the same', () => {
  const r = importFile('heart.csv', enc(CSV), { deckName: 'Heart export' });
  const csv = strFromU8(exportDeck(r.deck.id, 'csv').data);
  const back = importFile('again.csv', enc(csv), { deckName: 'Heart from CSV' });
  const pack = exportDeck(r.deck.id, 'lernpack');
  const first = JSON.parse(strFromU8(unzipSync(pack.data)['cards.jsonl']).split('\n')[0]);
  assert.deepEqual(
    [first.type, first.occlusion, first.occlusionGroup, first.occlusionMode],
    ['occlusion', '0.4,0.05,0.2,0.1', 'h1', 'all'],
  );
  // Anki has no LernLab occlusion: each box goes out as a basic note with the whole image.
  assert.ok(exportDeck(r.deck.id, 'apkg').data.length > 0);
  const fromPack = importFile(pack.name, pack.data, { deckName: 'Heart from pack' });
  const strip = (i: ReturnType<typeof load>[number]) => ({
    ...i,
    id: 0,
    deckId: 0,
    deck: '',
    occlusionBoxes: i.occlusionBoxes?.map((b) => ({ ...b, id: 0 })),
  });
  assert.deepEqual(load(back.deck.id).map(strip), load(r.deck.id).map(strip));
  assert.deepEqual(load(fromPack.deck.id).map(strip), load(r.deck.id).map(strip));
});
