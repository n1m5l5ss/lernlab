// Import preview: see what a file or pasted text will give before anything is saved, and map columns.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-preview-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { previewFile, previewText, mapFile } = await import('../src/importpreview');
const { importFile } = await import('../src/importer');
const { listDecks } = await import('../src/library');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const itemCount = () => Number(getDb().prepare('SELECT COUNT(*) AS n FROM items').get()!.n);

test('a CSV with known headers previews the first 10 cards and saves nothing', () => {
  const rows = Array.from({ length: 25 }, (_, i) => `word ${i},meaning ${i},tag${i}`);
  const p = previewFile('Words.csv', strToU8(['front,back,tags', ...rows].join('\n')));
  assert.equal(p.format, 'csv');
  assert.equal(p.deckName, 'Words');
  assert.equal(p.total, 25);
  assert.equal(p.cards.length, 10);
  assert.deepEqual(p.cards[0], { front: 'word 0', back: 'meaning 0', example: '', tags: ['tag0'] });
  assert.ok(p.table);
  assert.equal(p.table.header, true);
  assert.deepEqual(
    p.table.columns.map((c) => c.name),
    ['front', 'back', 'tags'],
  );
  assert.deepEqual(p.table.fields, { front: 0, back: 1, tags: 2 });
  assert.equal(itemCount(), 0);
  assert.equal(listDecks().length, 0);
});

test('unknown headers can be mapped by hand, and the mapping reaches the real import', () => {
  const csv = 'Begriff;Notiz;Bedeutung\nder Hund;pet;dog\ndie Katze;pet;cat\n;;orphan\n';
  const auto = previewFile('Tiere.csv', strToU8(csv));
  assert.equal(auto.table?.header, false, 'unknown headers are read as a card');
  assert.equal(auto.total, 3, 'the orphan row has no front or back in the guessed columns');
  assert.deepEqual(
    auto.table?.columns.map((c) => c.sample),
    ['Begriff', 'Notiz', 'Bedeutung'],
  );

  const mapping = { header: true, fields: { front: 0, back: 2 } };
  const mapped = previewFile('Tiere.csv', strToU8(csv), mapping);
  assert.equal(mapped.total, 3);
  assert.deepEqual(
    mapped.cards.map((c) => [c.front, c.back]),
    [
      ['der Hund', 'dog'],
      ['die Katze', 'cat'],
      ['', 'orphan'],
    ],
  );
  assert.deepEqual(mapped.skipped, [{ reason: 'no_front', count: 1 }]);
  assert.deepEqual(mapped.table?.fields, { front: 0, back: 2 });

  const res = importFile('Tiere.csv', mapFile('Tiere.csv', strToU8(csv), mapping));
  assert.equal(res.deck.name, 'Tiere');
  assert.equal(res.added, 2);
  const backs = getDb()
    .prepare('SELECT meaning FROM items WHERE deck_id = ? ORDER BY ord')
    .all(res.deck.id)
    .map((r) => r.meaning);
  assert.deepEqual(backs, ['dog', 'cat'], 'the ignored middle column is not used as the back');
});

test('a mapping needs a front column', () => {
  assert.throws(
    () => previewFile('x.csv', strToU8('a,b\n'), { header: false, fields: { back: 1 } }),
    (e: { code?: string }) => e.code === 'mapping_needs_front',
  );
});

test('mapped values that look like comments or hold commas survive', () => {
  const tsv = '#1\tone, uno\n#2\ttwo\n';
  const p = previewFile('n.tsv', strToU8(tsv), { header: false, fields: { rank: 0, front: 1 } });
  // Lines starting with # are comments in the original file, so they are skipped there too.
  assert.equal(p.total, 0);
  const q = previewFile('n.tsv', strToU8('x\t#1\tone, uno\n'), { header: false, fields: { notes: 1, front: 2 } });
  assert.deepEqual(q.cards[0].front, 'one, uno');
});

test('pasted text previews with the chosen separators', () => {
  const p = previewText('Amazon S3 - Object storage\nLambda - Functions\n\n', ' - ', '\n');
  assert.equal(p.format, 'paste');
  assert.equal(p.total, 2);
  assert.deepEqual(p.cards[1], { front: 'Lambda', back: 'Functions', example: '', tags: [] });
  assert.equal(p.table, null);
  assert.equal(previewText('a:1;b:2', ':', ';').total, 2);
});

test('a .lernpack previews its deck name and cards, without a column table', () => {
  const pack = zipSync({
    'manifest.json': strToU8(
      JSON.stringify({
        format: 'lernpack',
        version: 1,
        deck: { name: 'Cloud' },
        cards: 1,
        created: '',
        generator: 'x',
      }),
    ),
    'cards.jsonl': strToU8(`${JSON.stringify({ id: 'a', front: '<b>S3</b>', back: 'Storage' })}\n`),
  });
  const p = previewFile('cloud.lernpack', pack);
  assert.equal(p.format, 'lernpack');
  assert.equal(p.deckName, 'Cloud');
  assert.deepEqual(p.cards[0].front, 'S3', 'formatting is shown as plain text');
  assert.equal(p.table, null);
  assert.equal(itemCount(), 2, 'still only the two cards imported above');
});

test('JSON previews its cards', () => {
  const p = previewFile('d.json', strToU8(JSON.stringify({ deck: { name: 'J' }, cards: [{ front: 'a', back: 'b' }] })));
  assert.equal(p.format, 'json');
  assert.equal(p.deckName, 'J');
  assert.equal(p.total, 1);
});

test('a column of question variants is recognised, and can be mapped by hand', () => {
  const known = previewFile(
    'Pharma.csv',
    strToU8('front,back,other questions\nBeta blocker,slows the heart,apply: Angina?\n'),
  );
  assert.equal(known.table?.fields.variants, 2);
  const csv = 'Begriff;Antwort;Fragen\nBeta blocker;slows the heart;apply: A patient with angina?\n';
  const res = importFile(
    'Pharma.csv',
    mapFile('Pharma.csv', strToU8(csv), { header: true, fields: { front: 0, back: 1, variants: 2 } }),
  );
  const extra = getDb().prepare('SELECT extra FROM items WHERE deck_id = ?').get(res.deck.id)!.extra;
  assert.equal(JSON.parse(String(extra)).variants, 'apply: A patient with angina?');
});

test('a column of corrections for wrong choices is recognised', () => {
  const known = previewFile(
    'Cloud.csv',
    strToU8('front,type,choices,correct,misconceptions\nServerless?,mcq,EC2|Lambda,2,Many think EC2 is\n'),
  );
  assert.equal(known.table?.fields.corrections, 4);
});

test('a column of key terms is recognised, and ==term== in the back previews as plain text', () => {
  const known = previewFile('Bio.csv', strToU8('front,back,key terms\nWhat makes ATP?,The ==mitochondrion==,\n'));
  assert.equal(known.table?.fields.keyTerms, 2);
  assert.equal(known.cards[0].back, 'The mitochondrion');
});

test('the preview counts card-quality hints over the whole file, not just the cards shown', () => {
  const long = Array.from({ length: 45 }, (_, i) => `w${i}`).join(' ');
  const rows = Array.from({ length: 12 }, (_, i) => `Question ${i}?,${long},`);
  const p = previewFile('Long.csv', strToU8(['front,back,image', ...rows, 'Pic?,A,pic.png', 'Short?,A,'].join('\n')));
  assert.deepEqual(p.hints, [
    { hint: 'split', count: 12 },
    { hint: 'diagram', count: 12 },
    { hint: 'decorativeImage', count: 1 },
  ]);
  assert.deepEqual(previewText('term\tdefinition').hints, []);
  // A language deck's own language is not known before import, so its cards are checked as any subject.
});

test('a column of key points is recognised', () => {
  const known = previewFile('Why.csv', strToU8('front,back,key_points\nWhy seasons?,Tilt,Tilt|Angle\n'));
  assert.equal(known.table?.fields.keyPoints, 2);
});

test('a case column is recognised', () => {
  const known = previewFile('Cases.csv', strToU8('front,back,scenario\nDiagnosis?,STEMI,A man has chest pain.\n'));
  assert.equal(known.table?.fields.case, 2);
});

test('a column of worked steps is recognised', () => {
  const known = previewFile('Maths.csv', strToU8('front,back,worked_steps\nSolve,x = 4,Subtract :: 2x = 8|x = 4\n'));
  assert.equal(known.table?.fields.workedSteps, 2);
});
