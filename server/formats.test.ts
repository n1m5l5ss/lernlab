import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { compress as zstdCompress } from './zstd-test-helper';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-fmt-'));
process.env.LERNLAB_DATA = dir;
const { importFile } = await import('./importer');
const { exportDeck } = await import('./exporter');
const { planSession } = await import('./session');
const { getDb, openRaw } = await import('./db');
const { deckByName } = await import('./library');
after(() => rmSync(dir, { recursive: true, force: true }));

const AWS_CSV = `term,definition,category,tags,notes
Amazon S3,Object storage service for any amount of data,Storage,aws saa,Use for static assets
Amazon EBS,Block storage volumes for EC2 instances,Storage,aws saa,
Amazon EFS,"Managed NFS file system, shared across instances",Storage,aws,
AWS Lambda,Run code without managing servers,Compute,aws,
Amazon EC2,Resizable virtual servers in the cloud,Compute,aws,
AWS Fargate,Serverless compute engine for containers,Compute,aws,
Amazon RDS,Managed relational databases,Database,aws,
Amazon DynamoDB,Managed NoSQL key-value and document database,Database,aws,
`;

test('CSV with header: columns by name, categories, tags, markdown-free', () => {
  const r = importFile('AWS SAA.csv', strToU8(AWS_CSV));
  assert.equal(r.format, 'csv');
  assert.equal(r.added, 8);
  assert.equal(r.deck.name, 'AWS SAA');
  assert.equal(r.deck.language, null);
  const row = getDb().prepare("SELECT * FROM items WHERE target = 'Amazon EFS'").get();
  assert.equal(row.meaning, 'Managed NFS file system, shared across instances');
  assert.equal(row.category, 'Storage');
  assert.equal(row.kind, 'card');
  const again = importFile('AWS SAA.csv', strToU8(AWS_CSV));
  assert.equal(again.added, 0, 're-import updates instead of duplicating');
});

test('Quizlet-style TSV without header', () => {
  const r = importFile('bio.txt', strToU8('Mitochondrion\tPowerhouse of the cell\nRibosome\tMakes proteins\nNucleus\tHolds the DNA\nGolgi apparatus\tPackages proteins\n'));
  assert.equal(r.added, 4);
  assert.equal(r.format, 'tsv');
});

test('cloze cards', () => {
  const r = importFile('cloze.csv', strToU8('front,back\n"The {{c1::mitochondria}} is the powerhouse of the cell",Biology 101\n'));
  assert.equal(r.added, 1);
  assert.equal(getDb().prepare("SELECT kind FROM items WHERE target LIKE '%mitochondria%'").get().kind, 'cloze');
});

test('a non-language deck gets a sensible, varied session', () => {
  const deck = deckByName('AWS SAA')!;
  const plan = planSession('standard', getDb(), new Date(2026, 10, 21, 10), deck.id);
  const kinds = plan.blocks.map((b) => (b.kind === 'drill' ? b.format : b.kind));
  assert.ok(!kinds.includes('speak'), 'no speaking for non-language decks');
  assert.ok(kinds.includes('gender'), 'category sprint with Storage/Compute/Database');
  for (let i = 1; i < kinds.length; i++) assert.notEqual(kinds[i], kinds[i - 1], kinds.join());
  const learn = plan.blocks.find((b) => b.kind === 'learn') as any;
  assert.ok(learn.exercises.some((e: any) => e.type === 'mc'));
});

test('.lernpack round trip with media', () => {
  const deck = deckByName('AWS SAA')!;
  getDb().prepare("UPDATE items SET image = 'none.png' WHERE target = 'Amazon S3'").run();
  const pack = exportDeck(deck.id, 'lernpack');
  const r = importFile('copy.lernpack', pack.data, { deckName: 'AWS copy' });
  assert.equal(r.format, 'lernpack');
  assert.equal(r.total, 8);
  assert.equal(r.mediaMissing, 1, 'missing media reference is dropped, not broken');
  const csv = new TextDecoder().decode(exportDeck(deck.id, 'csv').data);
  assert.ok(csv.startsWith('front,back,'));
  assert.ok(csv.includes('"Managed NFS file system, shared across instances"'));
});

function buildApkg(newFormat: boolean) {
  const colFile = join(dir, `col-${newFormat}.db`);
  const db = openRaw(colFile);
  if (newFormat) {
    db.exec(`CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER, usn INTEGER, tags TEXT, flds TEXT, sfld TEXT, csum INTEGER, flags INTEGER, data TEXT);
      CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);
      CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT, config BLOB);
      CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO fields VALUES (7, 0, 'Front', NULL), (7, 1, 'Back', NULL);
      INSERT INTO decks VALUES (5, 'Medicine\x1fCardio');`);
  } else {
    db.exec(`CREATE TABLE col (models TEXT, decks TEXT);
      CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
      CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);`);
    db.prepare('INSERT INTO col VALUES (?, ?)').run(JSON.stringify({ 7: { id: 7, name: 'Basic', flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }] } }), JSON.stringify({ 5: { id: 5, name: 'Medicine::Cardio' } }));
  }
  const ins = db.prepare('INSERT INTO notes (id, mid, tags, flds) VALUES (?, ?, ?, ?)');
  ins.run(1, 7, ' cardio ', 'Normal resting heart rate\x1f60–100 bpm');
  ins.run(2, 7, '', 'Heart chamber that pumps to the body\x1fLeft ventricle <img src="lv.png">[sound:lv.mp3]');
  ins.run(3, 7, '', '{{c1::Aspirin}} irreversibly inhibits COX-1\x1fPharmacology');
  for (const n of [1, 2, 3]) db.prepare('INSERT INTO cards VALUES (?, ?, 5, 0)').run(n * 10, n);
  db.close();
  const col = new Uint8Array(readFileSync(colFile));
  const files: Record<string, Uint8Array> = { '0': strToU8('PNGDATA'), '1': strToU8('MP3DATA') };
  if (newFormat) {
    // MediaEntries protobuf: entries(1) { name(1) }
    const entry = (name: string) => { const n = strToU8(name); return [0x0a, n.length + 2, 0x0a, n.length, ...n]; };
    files['media'] = zstdCompress(new Uint8Array([...entry('lv.png'), ...entry('lv.mp3')]));
    files['collection.anki21b'] = zstdCompress(col);
    files['collection.anki2'] = strToU8('placeholder');
  } else {
    files['media'] = strToU8(JSON.stringify({ 0: 'lv.png', 1: 'lv.mp3' }));
    files['collection.anki2'] = col;
  }
  return zipSync(files);
}

for (const newFormat of [false, true]) {
  test(`Anki .apkg import (${newFormat ? 'new anki21b' : 'legacy anki2'})`, () => {
    const r = importFile('cardio.apkg', buildApkg(newFormat), { deckName: newFormat ? 'Cardio B' : 'Cardio A' });
    assert.equal(r.format, 'apkg');
    assert.equal(r.total, 3);
    assert.equal(r.media, 2);
    const lv = getDb().prepare(`SELECT * FROM items WHERE deck_id = ? AND target LIKE 'Heart chamber%'`).get(r.deck.id);
    assert.equal(lv.meaning, 'Left ventricle');
    assert.equal(lv.image, 'lv.png');
    assert.equal(lv.audio, 'lv.mp3');
    assert.equal(lv.deck, 'Medicine::Cardio');
    assert.equal(getDb().prepare(`SELECT kind FROM items WHERE deck_id = ? AND target LIKE '%Aspirin%'`).get(r.deck.id).kind, 'cloze');
  });
}

test('multi-select and ordering question cards (certification style)', async () => {
  const csv = `type,question,choices,correct,explanation,steps
mcq,"Which TWO services are serverless?",Amazon EC2|AWS Lambda|AWS Fargate|Amazon RDS,2|3,Lambda and Fargate need no server management,
mcq,Which service stores objects?,Amazon EBS|Amazon S3|Amazon EFS,Amazon S3,S3 is object storage,
order,Order the TCP handshake,,,,SYN|SYN-ACK|ACK
`;
  const r = importFile('cert.csv', strToU8(csv));
  assert.equal(r.added, 3);
  const kinds = getDb().prepare('SELECT kind FROM items WHERE deck_id = ? ORDER BY ord').all(r.deck.id).map((x: any) => x.kind);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM items WHERE deck_id = ? AND category IS NOT NULL').get(r.deck.id).n, 0, 'the type column is not a category');
  assert.deepEqual(kinds, ['mcq', 'mcq', 'order']);
  const { recall } = await import('./exercises');
  const { allItems } = await import('./learn');
  const items = allItems(getDb(), r.deck.id);
  const ex: any = recall(items[0]);
  assert.equal(ex.type, 'mcq');
  assert.equal(ex.correct.length, 2);
  assert.deepEqual(ex.correct.map((i: number) => ex.choices[i]).sort(), ['AWS Fargate', 'AWS Lambda']);
  assert.equal((recall(items[1]) as any).correct.length, 1);
  const ord: any = recall(items[2]);
  assert.equal(ord.type, 'order');
  assert.deepEqual(ord.steps, ['SYN', 'SYN-ACK', 'ACK']);
});

test('"I was right" turns today\'s Again into Good', async () => {
  const { recordAttempt, overrideToCorrect } = await import('./learn');
  const deck = deckByName('AWS SAA')!;
  const id = Number(getDb().prepare("SELECT id FROM items WHERE deck_id = ? AND target = 'Amazon S3'").get(deck.id).id);
  const t = new Date(2026, 10, 22, 10);
  recordAttempt({ sessionId: 's', itemId: id, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), t);
  assert.equal(recordAttempt({ sessionId: 's', itemId: id, format: 'typed', correct: false, responseMs: 3000, xp: 1, given: 'S3 object storage' }, getDb(), t).grade, 1);
  const againDue = getDb().prepare('SELECT due FROM srs WHERE item_id = ?').get(id).due;
  assert.equal(overrideToCorrect(id, getDb(), t).ok, true);
  const goodDue = getDb().prepare('SELECT due FROM srs WHERE item_id = ?').get(id).due;
  assert.ok(goodDue > againDue, 'due date moved later');
  assert.equal(overrideToCorrect(id, getDb(), t).ok, false, 'only once');
});

test('alternative answers', async () => {
  const r = importFile('spell.csv', strToU8('front,back,alt_answers\nThe shade of the sky,blue,azure|sky blue\nOpposite of left,right,\nFrozen water,ice,\nNot hot,cold,chilly\n'));
  const { allItems } = await import('./learn');
  const { qa } = await import('../shared/cards');
  const sky = allItems(getDb(), r.deck.id).find((i) => i.meaning === 'blue')!;
  assert.deepEqual(qa(sky).accepted, ['blue', 'azure', 'sky blue']);
});

test('deck package with cards.csv and media in subfolders (images/, audio/)', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const gif = strToU8('GIF89a-test');
  const zip = zipSync({
    'colours/manifest.json': strToU8(JSON.stringify({ format: 'lernpack', version: 1, deck: { name: 'Colours test', language: 'de' } })),
    'colours/cards.csv': strToU8('front,back,image\nrot,red,images/rot.png\ndrehen,to turn,images/drehen.gif\nblau,blue,images/missing.png\n'),
    'colours/media/images/rot.png': png,
    'colours/media/images/drehen.gif': gif,
    'colours/media/audio/': new Uint8Array(),
  });
  const r = importFile('colours.lernpack', zip);
  assert.equal(r.format, 'lernpack');
  assert.equal(r.total, 3);
  assert.equal(r.media, 2);
  assert.equal(r.mediaMissing, 1);
  const rows = getDb().prepare("SELECT target, image FROM items WHERE deck_id = ? ORDER BY target").all(deckByName('Colours test')!.id) as any[];
  assert.ok(rows.find((x) => x.target === 'rot').image, 'rot has its image');
  assert.ok(rows.find((x) => x.target === 'drehen').image, 'GIF resolved from images/');
});
