// Concept map from memory (#219): the author's maps as text on the deck, read safely; the learner's links
// compared with the author's; the picture's layout; maps travel in .lernpack and JSON. Practice only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-maps-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { cleanDeckSettings, createDeck, getDeck, listDecks, updateDeck, upsertCards } = await import('../src/library');
const {
  MAPS_MAX,
  MAP_LINKS_MAX,
  MAP_TERMS_MAX,
  MAP_TERM_MAX_LENGTH,
  addLink,
  cleanMaps,
  compareMaps,
  formatLink,
  layoutTerms,
  mapFor,
  mapTopics,
  parseLink,
  parseMaps,
  termsOf,
} = await import('../src/conceptmap');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const TEXT = `# Cell energy
Glucose --is broken down in--> Mitochondrion
Mitochondrion --makes--> ATP
ATP --powers--> Muscle
Oxygen --> Mitochondrion`;

test('a link reads as "A --label--> B"; the label is optional; terms and labels are plain text', () => {
  assert.deepEqual(parseLink(' Mitochondrion  --makes-->  ATP '), { from: 'Mitochondrion', label: 'makes', to: 'ATP' });
  assert.deepEqual(parseLink('Oxygen --> Mitochondrion'), { from: 'Oxygen', label: '', to: 'Mitochondrion' });
  assert.deepEqual(parseLink('<b>Co-enzyme</b> --<i>helps</i>--> <script>x</script>Enzyme'), {
    from: 'Co-enzyme',
    label: 'helps',
    to: 'Enzyme',
  });
  for (const bad of ['', 'A', 'A -> B', 'A --x--> ', ' --x--> B', 'A --x--> a', 'A -- B'])
    assert.equal(parseLink(bad), null, bad);
  assert.equal(parseLink(`${'x'.repeat(200)} --> B`)!.from.length, MAP_TERM_MAX_LENGTH);
  const link = { from: 'A', label: 'causes', to: 'B' };
  assert.deepEqual(parseLink(formatLink(link)), link);
});

test('maps read from one block of text: a topic line, then links; the kept text is canonical and capped', () => {
  const [map] = parseMaps(TEXT);
  assert.equal(map.topic, 'Cell energy');
  assert.equal(map.links.length, 4);
  assert.deepEqual(termsOf(map.links), ['Glucose', 'Mitochondrion', 'ATP', 'Muscle', 'Oxygen']);
  assert.equal(cleanMaps(TEXT), TEXT);
  assert.equal(cleanMaps(cleanMaps(` junk\n${TEXT}\nnot a link\n\n#  \n# One link\nA --> B`)), TEXT);
  // The same pair twice, a second spelling of a term, a repeated topic and links before any topic are dropped.
  assert.equal(
    cleanMaps('X --> Y\n# T\nA --x--> B\na --y--> b\nB --z--> A\nB --> C\n# t\nC --> D\nD --> E'),
    '# T\nA --x--> B\nB --> C',
  );
  assert.deepEqual(parseMaps(undefined), []);
  assert.deepEqual(parseMaps('# Only one\nA --> B'), [], 'a map needs two links');
  const many = Array.from({ length: 40 }, (_, i) => `# T${i}\nA --> B\nB --> C`).join('\n');
  assert.equal(parseMaps(many).length, MAPS_MAX);
  const wide = `# Wide\n${Array.from({ length: 60 }, (_, i) => `Hub --> T${i}`).join('\n')}`;
  assert.equal(termsOf(parseMaps(wide)[0].links).length, MAP_TERMS_MAX);
  const dense = `# Dense\n${Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, k) => `N${i} --> N${k}`).join('\n')).join('\n')}`;
  assert.equal(parseMaps(dense)[0].links.length, MAP_LINKS_MAX);
});

test('comparing: links that join the same two terms match, whatever the words or the direction', () => {
  const authors = parseMaps(TEXT)[0].links;
  const yours = [
    { from: 'mitochondrion', label: 'produces', to: 'atp' },
    { from: 'Muscle', label: 'uses', to: 'ATP' },
    { from: 'Glucose', label: 'feeds', to: 'Muscle' },
  ];
  const c = compareMaps(yours, authors);
  assert.deepEqual(c.matched, [
    { from: 'Mitochondrion', to: 'ATP', yours: 'produces', authors: 'makes', reversed: false },
    { from: 'ATP', to: 'Muscle', yours: 'uses', authors: 'powers', reversed: true },
  ]);
  assert.deepEqual(c.missing.map(formatLink), [
    'Glucose --is broken down in--> Mitochondrion',
    'Oxygen --> Mitochondrion',
  ]);
  assert.deepEqual(c.extra.map(formatLink), ['Glucose --feeds--> Muscle']);
  assert.deepEqual(compareMaps([], authors).missing.length, 4);
  assert.deepEqual(compareMaps(authors, authors).matched.length, 4);
});

test('adding a link: plain label, one link per pair of terms, never a term with itself', () => {
  const one = addLink([], 'A', ' <b>causes</b> ', 'B');
  assert.deepEqual(one, [{ from: 'A', label: 'causes', to: 'B' }]);
  assert.equal(addLink(one as [], 'B', 'x', 'A'), 'linked');
  assert.equal(addLink(one as [], 'A', 'x', 'a'), 'same');
  assert.equal(addLink([], '', 'x', 'B'), 'same');
  assert.equal((addLink(one as [], 'B', '', 'C') as unknown[]).length, 2);
});

test('the picture puts the terms evenly on an ellipse inside the frame', () => {
  const pts = layoutTerms(['A', 'B', 'C', 'D'], 360, 260);
  assert.deepEqual(pts[0], { term: 'A', x: 180, y: 28 });
  assert.equal(new Set(pts.map((p) => `${p.x},${p.y}`)).size, 4);
  for (const p of pts) assert.ok(p.x >= 0 && p.x <= 360 && p.y >= 0 && p.y <= 260);
  assert.deepEqual(layoutTerms([]), []);
});

test('a deck keeps its maps as a cleaned setting; topics list them and a topic gives terms in A–Z order', () => {
  assert.equal(cleanDeckSettings({ maps: `<b>x</b>\n${TEXT}` }).maps, TEXT);
  assert.equal(cleanDeckSettings({ maps: 'nothing here' }).maps, undefined);
  assert.equal(cleanDeckSettings({ maps: 5 }).maps, undefined);
  const deck = createDeck('Biology', null);
  upsertCards(deck, [{ front: 'What makes ATP?', back: 'The mitochondrion' }]);
  assert.deepEqual(mapTopics(listDecks()), []);
  updateDeck(deck.id, { settings: { maps: TEXT } });
  assert.deepEqual(mapTopics(listDecks()), [
    { deckId: deck.id, deckName: 'Biology', topic: 'Cell energy', terms: 5, links: 4 },
  ]);
  const map = mapFor(getDeck(deck.id), ' cell ENERGY ')!;
  assert.deepEqual(map.terms, ['ATP', 'Glucose', 'Mitochondrion', 'Muscle', 'Oxygen']);
  assert.equal(map.links.length, 4);
  assert.equal(mapFor(getDeck(deck.id), 'Other'), null);
  assert.equal(mapFor(null, 'Cell energy'), null);
});

test("maps travel in .lernpack and JSON, are cleaned on the way in and never replace a deck's own", () => {
  const deck = listDecks().find((x) => x.name === 'Biology')!;
  const file = exportDeck(deck.id, 'lernpack');
  const manifest = JSON.parse(strFromU8(unzipSync(file.data)['manifest.json']));
  assert.equal(manifest.deck.maps, TEXT);
  const copy = importFile(file.name, file.data, { deckName: 'Biology copy' }).deck;
  assert.equal(getDeck(copy.id)!.settings.maps, TEXT);
  const json = {
    deck: { name: 'From JSON', maps: `${TEXT}\n<img src=x onerror=alert(1)> --> ATP` },
    cards: [{ front: 'Q', back: 'A' }],
  };
  const made = importFile('maps.json', strToU8(JSON.stringify(json))).deck;
  assert.equal(getDeck(made.id)!.settings.maps, TEXT);
  // Importing again with another map leaves the deck's own map alone.
  json.deck.maps = '# Other\nA --> B\nB --> C';
  importFile('maps.json', strToU8(JSON.stringify(json)));
  assert.equal(getDeck(made.id)!.settings.maps, TEXT);
  // Nothing about a map touches a schedule.
  assert.equal(Number(getDb().prepare('SELECT COUNT(*) AS n FROM srs').get()!.n), 0);
});
