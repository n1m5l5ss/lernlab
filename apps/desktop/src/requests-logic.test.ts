import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AiRequest } from '@lernlab/core/airequests';
import { acceptedBody, draftOf, editCard, keptCards, toggleCard } from './requests-logic';

const base = { id: '00000000-0000-4000-8000-000000000001', createdAt: '2026-11-21T10:00:00Z' };
const newDeck: AiRequest = {
  ...base,
  kind: 'create_deck',
  deck: { name: 'Planets', language: 'en' },
  cards: [
    { front: 'Mars', back: 'Red' },
    { front: 'Venus', back: 'Hot' },
  ],
  note: 'From a PDF',
};

test('the user renames the deck, fixes a card and leaves one out', () => {
  let d = draftOf(newDeck);
  assert.equal(d.deckName, 'Planets');
  d = editCard(d, 0, { back: 'The red planet' });
  d = toggleCard(d, 1);
  d = { ...d, deckName: '  Solar system ' };
  assert.equal(keptCards(d).length, 1);
  assert.deepEqual(acceptedBody(newDeck, d), {
    deck: { name: 'Solar system', language: 'en' },
    cards: [{ front: 'Mars', back: 'The red planet' }],
    note: 'From a PDF',
  });
});

test('nothing to accept without a deck name or without cards', () => {
  const d = draftOf(newDeck);
  assert.equal(acceptedBody(newDeck, { ...d, deckName: ' ' }), null);
  assert.equal(acceptedBody(newDeck, { ...d, keep: [false, false] }), null);
  const add: AiRequest = { ...base, kind: 'add_cards', deckId: 3, cards: [{ front: 'Io', back: 'Jupiter' }] };
  assert.deepEqual(acceptedBody(add, draftOf(add)), {
    deckId: 3,
    cards: [{ front: 'Io', back: 'Jupiter' }],
    note: undefined,
  });
  assert.equal(acceptedBody(add, editCard(draftOf(add), 0, { front: '  ' })), null);
});
