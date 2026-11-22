// Export, then import into a fresh deck: the cards come back the same, in CSV and in .lernpack.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-roundtrip-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { createDeck, storeMedia, upsertCards } = await import('../src/library');
const { CSV_TEMPLATE } = await import('../src/csvtemplate');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const gif = strToU8('GIF89a-spin');
const mp3 = strToU8('ID3-beat');
const mp4 = new Uint8Array([0, 0, 0, 0x18, ...strToU8('ftypisom'), 1, 2, 3]);
const deck = createDeck('Biology', null);
storeMedia('heart.png', png);
storeMedia('spin.gif', gif);
storeMedia('heart.mp3', mp3);
storeMedia('heart.mp4', mp4);
upsertCards(deck, [
  {
    sourceId: 'heart',
    front: 'The **heart** has # four chambers',
    back: 'two atria, two ventricles',
    altAnswers: '4|four',
    example: 'The <b>heart</b> pumps blood.',
    exampleTranslation: 'Das Herz pumpt Blut.',
    explanation: 'Atria receive, ventricles pump.',
    notes: 'Think: 2 + 2',
    category: 'Organs',
    tags: ['bio', 'cardio'],
    image: 'heart.png',
    imageAlt: 'A heart cut open: four chambers',
    variants: 'apply: A runner\'s pulse doubles, "why"? Which chambers work harder? | analyse: What if a valve leaks?',
    audio: 'heart.mp3',
    video: 'heart.mp4',
    subdeck: 'Biology::Cardio',
    group: 'G01',
    rank: 3,
    extra: { reading: 'hɑːt' },
  },
  {
    front: 'Which TWO are organelles?',
    back: '',
    type: 'mcq',
    choices: 'Mitochondrion|Heart|Ribosome|Lung',
    correct: '1|3',
    corrections:
      '|Many people think the heart is an organelle, "a big one". In fact it is an organ, made of cells.||A lung is an organ, too',
    explanation: 'Organelles live inside cells.',
    image: 'spin.gif',
    imageAlt: 'A cell, "spinning", with\nits organelles',
    rank: 1,
  },
  { front: 'Order mitosis', back: '', type: 'order', steps: 'Prophase|Metaphase|Anaphase|Telophase', rank: 2 },
  { front: 'The {{c1::mitochondrion}} makes ATP', back: 'Cell biology', rank: 4 },
  {
    front: 'What does a ribosome do, and where?',
    back: 'It builds proteins from amino acids, "reading" messenger RNA, in the cytoplasm',
    keyTerms: 'proteins|messenger RNA',
    mnemonic: 'Ribosome, "rib" = build, with commas',
    rank: 7,
  },
  { front: '#1 rule, "quoted", with commas', back: 'line one\nline two', rank: 5, variants: 'Say it, "again"' },
  {
    front: 'Why does the heart have four chambers?',
    back: '',
    type: 'explain',
    keyPoints: 'Two pumps, "lungs" and body|Oxygen-rich blood stays apart, with commas',
    rank: 6,
  },
  {
    front: 'Solve 2x + 3 = 11',
    back: '',
    type: 'worked',
    workedSteps: 'Subtract 3, "both sides" :: 2x = 8|Divide by 2 :: x = 4',
    rank: 7,
  },
  {
    front: 'Which artery, "most likely"?',
    back: 'Right coronary artery',
    case: 'A man, 58, has "crushing" chest pain, with ST elevation in II, III and aVF.',
    rank: 8,
  },
  {
    front: 'Which function is this, "exactly"?',
    back: 'y = 2x + 1',
    type: 'translate',
    graph: 'y = 2x + 1; x = -3..3',
    rank: 9,
  },
]);

/** Every stored card field except the row's own id, deck, order and timestamps; the deck's own name reads <deck>. */
const cardsOf = (deckId: number, deckName: string) =>
  getDb()
    .prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((r) => {
      const { id: _id, deck_id: _deckId, ord: _ord, updated_at: _at, deck: sub, ...card } = r;
      return { ...card, subdeck: sub === deckName ? '<deck>' : sub };
    });
const original = cardsOf(deck.id, 'Biology');
const extraOf = (c: object) => JSON.parse(String((c as { extra?: unknown }).extra ?? '{}')) as Record<string, string>;

test('.lernpack: export then import into a new deck gives identical cards, with media', () => {
  const pack = exportDeck(deck.id, 'lernpack');
  assert.equal(pack.name, 'Biology.lernpack');
  const r = importFile(pack.name, pack.data, { deckName: 'Biology copy' });
  assert.equal(r.added, 10);
  assert.equal(r.media, 4);
  assert.equal(r.mediaMissing, 0);
  assert.deepEqual(cardsOf(r.deck.id, 'Biology copy'), original);
});

test('.lernpack: cards.csv beside cards.jsonl, media sorted into images/, audio/ and video/', () => {
  const files = unzipSync(exportDeck(deck.id, 'lernpack').data);
  assert.deepEqual(Object.keys(files).sort(), [
    'cards.csv',
    'cards.jsonl',
    'manifest.json',
    'media/audio/heart.mp3',
    'media/images/heart.png',
    'media/images/spin.gif',
    'media/video/heart.mp4',
  ]);
  assert.deepEqual(files['media/video/heart.mp4'], mp4);
  const jsonl = strFromU8(files['cards.jsonl'])
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const heart = jsonl.find((c) => c.category === 'Organs');
  const mcq = jsonl.find((c) => c.type === 'mcq');
  assert.deepEqual(
    [heart.image, heart.audio, heart.video, mcq.image],
    ['images/heart.png', 'audio/heart.mp3', 'video/heart.mp4', 'images/spin.gif'],
  );
  assert.equal(heart.imageAlt, 'A heart cut open: four chambers', 'the image description is a card field');
  assert.ok(!('imageAlt' in (heart.extra ?? {})), 'not hidden in extra');
  assert.match(heart.variants, /^apply: A runner's pulse doubles/, 'question variants are a card field');
  assert.ok(!('variants' in (heart.extra ?? {})));
  assert.match(
    mcq.corrections,
    /^\|Many people think the heart .*\|\|A lung is an organ, too$/,
    'corrections are a card field',
  );
  assert.ok(!('corrections' in (mcq.extra ?? {})));
  const csv = strFromU8(files['cards.csv']);
  const header = csv.split('\n')[0].split(',');
  for (const col of [
    'front',
    'back',
    'type',
    'choices',
    'correct',
    'steps',
    'alt_answers',
    'image',
    'image_alt',
    'variants',
    'corrections',
    'key_points',
    'key_terms',
    'worked_steps',
    'mnemonic',
    'case',
    'graph',
    'audio',
    'video',
    'id',
  ])
    assert.ok(header.includes(col), `cards.csv has a ${col} column`);
  // Every media path in the CSV names a file in the package.
  const paths = [...csv.matchAll(/(?:images|audio|video)\/[\w.-]+/g)].map((m) => m[0]);
  assert.deepEqual(paths.sort(), ['audio/heart.mp3', 'images/heart.png', 'images/spin.gif', 'video/heart.mp4']);
  for (const p of paths) assert.ok(files[`media/${p}`], `${p} is in media/`);
});

test('.lernpack: its cards.csv alone imports to identical cards, with media', () => {
  const files = unzipSync(exportDeck(deck.id, 'lernpack').data);
  const { 'cards.jsonl': _jsonl, ...rest } = files;
  const r = importFile('csv-only.lernpack', zipSync(rest as Zippable), { deckName: 'Biology from CSV' });
  assert.equal(r.format, 'lernpack');
  assert.equal(r.added, 10);
  assert.equal(r.media, 4);
  assert.equal(r.mediaMissing, 0);
  assert.deepEqual(cardsOf(r.deck.id, 'Biology from CSV'), original);
});

test('CSV: export then import into a new deck gives identical cards (media files travel in .lernpack)', () => {
  const csv = exportDeck(deck.id, 'csv');
  assert.equal(csv.name, 'Biology.csv');
  const r = importFile('Fresh.csv', csv.data);
  assert.equal(r.deck.name, 'Fresh');
  assert.equal(r.added, 10);
  const copy = cardsOf(r.deck.id, 'Fresh');
  // A plain CSV carries the file name of a picture, not the picture itself.
  assert.equal(r.mediaMissing, 4);
  // Without the picture its description goes too.
  const noAlt = (c: object) => {
    const { imageAlt: _alt, ...rest } = extraOf(c);
    return JSON.stringify(rest);
  };
  const withoutMedia = original.map((c) => ({ ...c, image: null, audio: null, video: null, extra: noAlt(c) }));
  assert.deepEqual(copy, withoutMedia);
  const header = strFromU8(csv.data).split('\n')[0].split(',');
  assert.ok(header.includes('image_alt'), 'the CSV has an image_alt column');
});

test('image descriptions are stored with the cards (so the round trips above carry them)', () => {
  const alts = original.map((c) => extraOf(c).imageAlt).filter(Boolean);
  assert.deepEqual(alts, ['A cell, "spinning", with its organelles', 'A heart cut open: four chambers']);
});

test('question variants are stored with the cards in one canonical line (so the round trips above carry them)', () => {
  assert.deepEqual(original.map((c) => extraOf(c).variants).filter(Boolean), [
    'apply: A runner\'s pulse doubles, "why"? Which chambers work harder? | analyse: What if a valve leaks?',
    'recall: Say it, "again"',
  ]);
});

test('corrections for wrong choices are stored with the cards, one slot per choice (so the round trips above carry them)', () => {
  assert.deepEqual(original.map((c) => extraOf(c).corrections).filter(Boolean), [
    '|Many people think the heart is an organelle, "a big one". In fact it is an organ, made of cells.||A lung is an organ, too',
  ]);
});

test('key points are stored with the cards, and an empty back stays empty (so the round trips above carry them)', () => {
  const explain = original.filter((c) => extraOf(c).keyPoints);
  assert.deepEqual(
    explain.map((c) => extraOf(c).keyPoints),
    ['Two pumps, "lungs" and body|Oxygen-rich blood stays apart, with commas'],
  );
});

test('key terms are stored with the cards and the back stays plain text (so the round trips above carry them)', () => {
  const marked = original.filter((c) => extraOf(c).keyTerms);
  assert.deepEqual(
    marked.map((c) => [extraOf(c).keyTerms, (c as { meaning?: unknown }).meaning]),
    [['proteins|messenger RNA', 'It builds proteins from amino acids, "reading" messenger RNA, in the cytoplasm']],
  );
});

test('worked steps are stored with the cards, and an empty back becomes the last result', () => {
  const worked = original.filter((c) => extraOf(c).workedSteps);
  assert.deepEqual(
    worked.map((c) => [extraOf(c).workedSteps, (c as { meaning?: unknown }).meaning]),
    [['Subtract 3, "both sides" :: 2x = 8|Divide by 2 :: x = 4', 'x = 4']],
  );
});

test('a mnemonic is stored with its card (so the round trips above carry it)', () => {
  assert.deepEqual(original.map((c) => extraOf(c).mnemonic).filter(Boolean), ['Ribosome, "rib" = build, with commas']);
});

test('a case is stored with its card, and the front stays the question alone (so the round trips above carry it)', () => {
  const withCase = original.filter((c) => extraOf(c).case);
  assert.deepEqual(
    withCase.map((c) => [extraOf(c).case, (c as { target?: unknown }).target]),
    [['A man, 58, has "crushing" chest pain, with ST elevation in II, III and aVF.', 'Which artery, "most likely"?']],
  );
});

test('the CSV template imports as four example cards', () => {
  const lines = CSV_TEMPLATE.trim().split('\n');
  assert.equal(lines.length, 5, 'a header and four example rows');
  assert.match(lines[0], /^front,back,/);
  assert.ok(lines[0].split(',').includes('image_alt'), 'the template shows the image description column');
  assert.ok(lines[0].split(',').includes('variants'), 'the template shows the question variants column');
  assert.ok(lines[0].split(',').includes('corrections'), 'the template shows the corrections column');
  assert.ok(lines[0].split(',').includes('key_points'), 'the template shows the key points column');
  for (const l of lines) assert.equal(l.split(',').length, lines[0].split(',').length, l);
  const r = importFile('template.csv', strToU8(CSV_TEMPLATE));
  assert.equal(r.added, 4);
  const kinds = getDb()
    .prepare('SELECT kind FROM items WHERE deck_id = ? ORDER BY ord')
    .all(r.deck.id)
    .map((x) => x.kind);
  assert.ok(kinds.includes('mcq'), kinds.join());
  const s3 = getDb().prepare("SELECT extra FROM items WHERE deck_id = ? AND target = 'Amazon S3'").get(r.deck.id);
  assert.match(String(s3?.extra), /apply: Which AWS service .* \| analyse: /);
  const quiz = getDb().prepare("SELECT extra FROM items WHERE deck_id = ? AND kind = 'mcq'").get(r.deck.id);
  assert.match(JSON.parse(String(quiz?.extra)).corrections, /^Many people think EC2 is serverless\./);
  // The explain card: a why question, a model answer on the back and its key points.
  const explain = getDb()
    .prepare("SELECT target, meaning, extra FROM items WHERE deck_id = ? AND extra LIKE '%keyPoints%'")
    .all(r.deck.id);
  assert.equal(explain.length, 1);
  assert.match(String(explain[0].target), /^Why /);
  assert.match(String(explain[0].meaning), /tilted axis/);
  assert.equal(String(JSON.parse(String(explain[0].extra)).keyPoints).split('|').length, 3);
});

test('the import preview maps every column of the CSV template, key points included', async () => {
  const { previewFile } = await import('../src/importpreview');
  const p = previewFile('template.csv', strToU8(CSV_TEMPLATE));
  assert.equal(p.total, 4);
  assert.ok(p.table?.header);
  const names = p.table!.columns.map((c) => c.name);
  assert.equal(p.table!.fields.keyPoints, names.indexOf('key_points'));
  assert.deepEqual(
    Object.values(p.table!.fields).sort((a, b) => a - b),
    names.map((_, i) => i),
    'no template column is left unmapped',
  );
});
