// The .lernpack version 1 spec (docs/FORMAT.md, docs/schema/*.json) agrees with the example package,
// the exporter and the importer, and readers ignore fields they don't know.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-lernpack-spec-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { deckByName } = await import('../src/library');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const root = join(import.meta.dirname, '..', '..', '..');
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const manifestSchema = readJson('docs/schema/manifest.schema.json');
const cardSchema = readJson('docs/schema/card.schema.json');
const examplePath = 'examples/german-colours-with-pictures.lernpack';

type Schema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
  items?: Schema;
  minLength?: number;
  minimum?: number;
};

const typeOf = (v: unknown) =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;

/**
 * Checks a value against the small part of JSON Schema the spec uses. With `strict`, keys that the
 * schema doesn't list are errors too (what a writer must not emit; readers still ignore them).
 */
function validate(schema: Schema, value: unknown, strict = false, path = '$'): string[] {
  const errors: string[] = [];
  const t = typeOf(value);
  if (schema.type) {
    const types = [schema.type].flat();
    if (!types.includes(t) && !(t === 'integer' && types.includes('number')))
      return [`${path}: expected ${types.join('|')}, got ${t}`];
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not one of ${schema.enum.join(', ')}`);
  if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength)
    errors.push(`${path}: too short`);
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum)
    errors.push(`${path}: below ${schema.minimum}`);
  if (Array.isArray(value) && schema.items)
    value.forEach((v, i) => errors.push(...validate(schema.items!, v, strict, `${path}[${i}]`)));
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!(k in obj)) errors.push(`${path}: missing ${k}`);
    for (const [k, v] of Object.entries(obj)) {
      const sub = schema.properties?.[k];
      if (sub) errors.push(...validate(sub, v, strict, `${path}.${k}`));
      else if (typeof schema.additionalProperties === 'object')
        errors.push(...validate(schema.additionalProperties, v, strict, `${path}.${k}`));
      else if (strict || schema.additionalProperties === false) errors.push(`${path}: unknown key ${k}`);
    }
  }
  return errors;
}

function readPack(data: Uint8Array) {
  const files = unzipSync(data);
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  const cards = strFromU8(files['cards.jsonl'])
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  return { files, manifest, cards };
}

function pack(manifest: object, cards: object[], extra: Zippable = {}) {
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'cards.jsonl': strToU8(cards.map((c) => JSON.stringify(c)).join('\n') + '\n'),
    ...extra,
  });
}

test('the schema files are draft 2020-12 JSON Schemas with the required keys', () => {
  for (const [schema, required] of [
    [manifestSchema, ['format', 'version', 'deck']],
    [cardSchema, ['front']],
  ] as const) {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.match(schema.$id, /^https:\/\/.+\/docs\/schema\/\w+\.schema\.json$/);
    assert.ok(schema.title.includes('version 1'));
    assert.equal(schema.type, 'object');
    assert.deepEqual(schema.required, required);
    assert.notEqual(schema.additionalProperties, false, 'readers ignore unknown fields, so the schema allows them');
    for (const [k, p] of Object.entries(schema.properties as Record<string, { description?: string }>))
      assert.ok(p.description, `${k} is described`);
  }
  assert.equal(manifestSchema.properties.version.const, 1);
  assert.deepEqual(cardSchema.properties.type.enum, [
    'basic',
    'cloze',
    'mcq',
    'order',
    'numeric',
    'code',
    'occlusion',
    'myth',
    'explain',
    'twin',
    'worked',
  ]);
  // The checker used below really checks.
  assert.equal(validate(cardSchema, { front: '', tags: 'x', type: 'quiz', bogus: 1 }, true).length, 4);
  assert.equal(validate(cardSchema, { front: 'x', bogus: 1 }).length, 0, 'unknown keys pass when not strict');
  assert.equal(validate(manifestSchema, { format: 'lernpack', version: 2, deck: {} }).length, 2);
});

test('docs/FORMAT.md is marked version 1 and lists exactly the schema fields', () => {
  const doc = readFileSync(join(root, 'docs/FORMAT.md'), 'utf8');
  assert.match(doc, /\*\*Status: version 1, frozen/);
  const section = (start: string) => {
    const from = doc.indexOf(start);
    return doc.slice(from, doc.indexOf('\n#', from + start.length));
  };
  const firstColumn = (text: string) =>
    [...text.matchAll(/^\| `([\w.]+)` \|/gm)].map((m) => m[1]).filter((k) => !k.includes('.'));
  assert.deepEqual(firstColumn(section('### manifest.json')).sort(), Object.keys(manifestSchema.properties).sort());
  assert.deepEqual(firstColumn(section('### cards.jsonl')).sort(), Object.keys(cardSchema.properties).sort());
  const added = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `imageAlt` |'));
  assert.match(added ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('imageAlt'), 'the image description is optional');
  const variants = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `variants` |'));
  assert.match(variants ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('variants'), 'question variants are optional');
  const corrections = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `corrections` |'));
  assert.match(corrections ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('corrections'), 'corrections are optional');
  const keyPoints = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `keyPoints` |'));
  assert.match(keyPoints ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('keyPoints'), 'key points are optional');
  const twin = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `twin` |'));
  assert.match(twin ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('twin'), 'a second side is optional');
  const requires = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `requires` |'));
  assert.match(requires ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('requires'), 'prerequisites are optional');
  const workedSteps = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `workedSteps` |'));
  assert.match(workedSteps ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('workedSteps'), 'worked steps are optional');
  const caseRow = section('### cards.jsonl')
    .split('\n')
    .find((l) => l.startsWith('| `case` |'));
  assert.match(caseRow ?? '', /optional, added after v1 was published; older readers ignore it/);
  assert.ok(!cardSchema.required.includes('case'), 'a case is optional');
  const deckKeys = [...section('### manifest.json').matchAll(/^\| `deck\.(\w+)` \|/gm)].map((m) => m[1]);
  assert.deepEqual(deckKeys.sort(), Object.keys(manifestSchema.properties.deck.properties).sort());
});

test('the example .lernpack matches the schemas and uses only listed fields', () => {
  const { files, manifest, cards } = readPack(new Uint8Array(readFileSync(join(root, examplePath))));
  assert.deepEqual(validate(manifestSchema, manifest, true), []);
  assert.equal(manifest.cards, cards.length);
  assert.ok(cards.length > 0);
  for (const c of cards) {
    assert.deepEqual(validate(cardSchema, c, true), []);
    for (const k of ['image', 'audio', 'video']) if (c[k]) assert.ok(files[`media/${c[k]}`], `${c[k]} is in media/`);
  }
  assert.ok(
    cards.some((c) => c.image?.endsWith('.gif')),
    'shows an animated GIF',
  );
});

test('the example .lernpack imports cleanly', () => {
  const data = new Uint8Array(readFileSync(join(root, examplePath)));
  const { manifest } = readPack(data);
  const r = importFile('german-colours-with-pictures.lernpack', data);
  assert.equal(r.format, 'lernpack');
  assert.equal(r.added, manifest.cards);
  assert.equal(r.total, manifest.cards);
  assert.equal(r.media, 10);
  assert.equal(r.mediaMissing, 0);
  assert.equal(r.deck.name, manifest.deck.name);
  assert.equal(r.deck.language, 'de');
  const again = importFile('german-colours-with-pictures.lernpack', data);
  assert.deepEqual([again.added, again.updated], [0, manifest.cards], 're-import updates, never duplicates');
});

test('a fresh export with every kind of field matches the schemas', () => {
  const json = {
    deck: { name: 'Spec export', language: 'ja', goal: { label: 'JLPT N5', words: 800 } },
    cards: [
      { id: 'a', front: '猫', back: 'cat', tags: ['animal'], rank: 3, group: 'G01', extra: { reading: 'ねこ' } },
      { id: 'b', front: 'Pick two', back: '', choices: 'A|B|C', correct: '1|3', explanation: 'Because' },
      { id: 'c', front: 'Order', back: '', steps: 'one|two|three', notes: 'n', subdeck: 'Spec export::Part 2' },
      { id: 'd', front: 'The {{c1::sun}} is a star', back: '', altAnswers: 'Sun', category: 'space' },
      { id: 'e', front: 'What is this?', back: 'a cat', image: 'https://example.org/cat.png', imageAlt: 'A cat' },
      { id: 'f', front: 'Beta blocker', back: 'slows the heart', variants: 'apply: A patient with angina?' },
      {
        id: 'g',
        front: 'Serverless?',
        back: '',
        type: 'mcq',
        choices: 'EC2|Lambda',
        correct: '2',
        corrections: 'Many think so',
      },
      { id: 'h', front: 'Why seasons?', back: '', type: 'explain', keyPoints: 'Tilt|Angle of sunlight' },
      { id: 'i', front: 'Solve 2x + 3 = 11', back: '', type: 'worked', workedSteps: 'Subtract 3 :: 2x = 8|x = 4' },
      { id: 'j', front: 'Most likely diagnosis?', back: 'STEMI', case: 'A man has crushing chest pain.' },
    ],
  };
  const { deck } = importFile('spec.json', strToU8(JSON.stringify(json)));
  const { manifest, cards } = readPack(exportDeck(deck.id, 'lernpack').data);
  assert.deepEqual(validate(manifestSchema, manifest, true), []);
  assert.deepEqual(manifest.deck.goal, { label: 'JLPT N5', words: 800 });
  assert.equal(cards.length, 10);
  for (const c of cards) assert.deepEqual(validate(cardSchema, c, true), [], JSON.stringify(c));
  assert.equal(cards.find((c) => c.id && c.front === 'What is this?')?.imageAlt, 'A cat');
  assert.equal(cards.find((c) => c.front === 'Beta blocker')?.variants, 'apply: A patient with angina?');
  assert.equal(cards.find((c) => c.front === 'Serverless?')?.corrections, 'Many think so');
  const why = cards.find((c) => c.front === 'Why seasons?');
  assert.deepEqual(
    [why?.type, why?.keyPoints, why?.back],
    ['explain', 'Tilt|Angle of sunlight', '• Tilt\n• Angle of sunlight'],
  );
  const dx = cards.find((c) => c.back === 'STEMI');
  assert.deepEqual(
    [dx?.case, dx?.front],
    ['A man has crushing chest pain.', 'A man has crushing chest pain.\n\nMost likely diagnosis?'],
  );
  const solve = cards.find((c) => c.front === 'Solve 2x + 3 = 11');
  assert.deepEqual([solve?.type, solve?.workedSteps, solve?.back], ['worked', 'Subtract 3 :: 2x = 8|x = 4', 'x = 4']);
});

test('readers ignore unknown fields in the manifest, the deck, the cards and the zip', () => {
  const data = pack(
    {
      format: 'lernpack',
      version: 1,
      deck: { name: 'Future deck', language: null, colour: 'teal', icons: { small: 'x' } },
      license: 'CC0',
      signature: { alg: 'none' },
    },
    [
      { id: 'f1', front: 'Paris', back: 'capital of France', difficulty: 3, hints: ['city'] },
      { id: 'f2', front: 'Nile', back: 'longest river', type: 'hologram', srs: { due: '2030-01-01' } },
      { front: 'Only a front' },
    ],
    { 'thumbnail.webp': new Uint8Array([1, 2, 3]), 'signatures/cards.sig': strToU8('sig') },
  );
  const r = importFile('future.lernpack', data);
  assert.equal(r.format, 'lernpack');
  assert.equal(r.added, 3);
  assert.equal(r.media, 0);
  const deck = deckByName('Future deck')!;
  assert.equal(deck.language, null);
  assert.ok(!('colour' in deck.settings) && !('icons' in deck.settings), 'unknown deck keys are not stored');
  const rows = getDb()
    .prepare('SELECT target, kind, extra FROM items WHERE deck_id = ? ORDER BY target')
    .all(deck.id) as any[];
  assert.deepEqual(
    rows.map((x) => [x.target, x.extra]),
    [
      ['Nile', '{}'],
      ['Only a front', '{}'],
      ['Paris', '{}'],
    ],
    'unknown card fields are not stored',
  );
  assert.equal(rows[0].kind, 'card', 'an unknown type falls back to detection from the content');
});

test('a package from a newer format version is refused, not guessed', () => {
  const data = pack({ format: 'lernpack', version: 2, deck: { name: 'From the future' } }, [{ front: 'x' }]);
  assert.throws(
    () => importFile('v2.lernpack', data),
    (e: any) => e.code === 'lernpack_too_new' && e.params.version === 2,
  );
  assert.equal(deckByName('From the future'), null);
});
