// Card editor: the preview is built exactly like the saved card; duplicate fronts are found; the safe list is documented.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-editor-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { createDeck, upsertCards, cardToItem } = await import('../src/library');
type NormalizedCard = import('../src/library').NormalizedCard;
const { findDuplicates, frontKey } = await import('../src/browse');
const { ITEM_SELECT, rowToItem } = await import('../src/learn');
const { SAFE_TAGS } = await import('../src/cards');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const subject = createDeck('Editor', null);
const german = createDeck('Deutsch', 'de');
const stored = (id: number) => rowToItem(getDb().prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id)!);

test('the preview item is the card exactly as it is saved', () => {
  const cards: [typeof subject, NormalizedCard][] = [
    [subject, { sourceId: 101, front: '**Mitochondrion**', back: 'Powerhouse of <i>the</i> cell', tags: ['bio'] }],
    [subject, { sourceId: 102, front: 'The {{c1::nucleus}} holds <b>DNA</b>', back: 'Extra', type: 'cloze' }],
    [
      subject,
      {
        sourceId: 103,
        front: 'Which run code?',
        back: '',
        type: 'mcq',
        choices: 'EC2|<b>Lambda</b>|S3',
        correct: '1|2',
      },
    ],
    [subject, { sourceId: 104, front: 'TCP handshake', back: '', type: 'order', steps: 'SYN|SYN-ACK|ACK' }],
    [
      german,
      { sourceId: 105, front: 'der Hund', back: 'dog', example: 'Der <b>Hund</b> bellt.', explanation: '*Tier*' },
    ],
  ];
  for (const [deck, card] of cards) {
    upsertCards(deck, [card]);
    const id = card.sourceId as number;
    assert.deepEqual(cardToItem(deck, card, id), stored(id), String(card.front));
  }
  assert.equal(stored(105).kind, 'noun');
  assert.equal(stored(105).grammar, '<i>Tier</i>');
});

test('choices and steps keep only safe formatting when saved', () => {
  upsertCards(subject, [
    {
      sourceId: 106,
      front: 'Pick one',
      back: '',
      type: 'mcq',
      choices: '<img src=x onerror=alert(1)>A|<b onclick="x()">B</b>',
      correct: '2',
      steps: '<svg/onload=alert(1)>one|two',
    },
  ]);
  const item = stored(106);
  assert.equal(item.extra.choices, 'A|<b>B</b>');
  assert.equal(item.extra.steps, 'one|two');
});

test('an empty card gives no preview', () => {
  assert.equal(cardToItem(subject, { front: '  ', back: 'x' }), null);
});

test('duplicate fronts are found in the same deck, ignoring formatting, case and spaces', () => {
  upsertCards(subject, [
    { sourceId: 201, front: 'Photosynthesis', back: 'plants make sugar' },
    { sourceId: 202, front: 'Capital  of FRANCE', back: 'Paris' },
  ]);
  upsertCards(german, [{ sourceId: 203, front: 'Photosynthese', back: 'photosynthesis' }]);
  assert.deepEqual(
    findDuplicates(subject.id, '<b>photosynthesis</b> ').map((d) => d.id),
    [201],
  );
  assert.deepEqual(
    findDuplicates(subject.id, '**capital of france**').map((d) => [d.id, d.front, d.back]),
    [[202, 'Capital of FRANCE', 'Paris']],
  );
  assert.deepEqual(
    findDuplicates(subject.id, 'The nucleus holds DNA').map((d) => d.id),
    [102],
    'cloze gaps count as text',
  );
  assert.deepEqual(
    findDuplicates(subject.id, 'Photosynthesis', 201),
    [],
    'the card being edited is not its own duplicate',
  );
  assert.deepEqual(findDuplicates(german.id, 'Photosynthesis'), [], 'other decks do not count');
  assert.deepEqual(findDuplicates(subject.id, '   '), []);
  assert.equal(frontKey('Bär'), 'bär', 'letters stay distinct');
  assert.notEqual(frontKey('Bär'), frontKey('Bar'));
});

test('docs/FORMAT.md lists exactly the safe list', () => {
  const doc = readFileSync(join(import.meta.dirname, '../../../docs/FORMAT.md'), 'utf8');
  const line = doc.split('\n').find((l) => l.startsWith('Allowed formatting in text'))!;
  const listed = [...line.matchAll(/<([a-z0-9]+)>/g)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...SAFE_TAGS].sort());
});
