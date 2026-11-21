import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AiRequest } from '@lernlab/core/airequests';
import {
  acceptedBody,
  draftOf,
  editCard,
  editChange,
  fieldText,
  keptCards,
  keptIds,
  toggleCard,
  toggleId,
} from './requests-logic';

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

test('a fix: the user rewrites the proposed text; an empty front or no change is nothing to accept', () => {
  const fix: AiRequest = { ...base, kind: 'edit_card', cardId: 7, changes: { back: 'Africa', tags: ['geo', 'river'] } };
  let d = draftOf(fix);
  assert.deepEqual(d.changes, { back: 'Africa', tags: 'geo river' });
  d = editChange(d, 'tags', 'geo  river ');
  d = editChange(d, 'back', 'Africa (Egypt)');
  assert.deepEqual(acceptedBody(fix, d), {
    cardId: 7,
    changes: { back: 'Africa (Egypt)', tags: ['geo', 'river'] },
    note: undefined,
  });
  assert.equal(acceptedBody(fix, editChange(d, 'back', ' ')), null);
  assert.equal(acceptedBody(fix, { ...d, changes: {} }), null);
  assert.equal(fieldText(undefined), '');
});

test('a merge or tidy-up: the user leaves cards out; with none left there is nothing to accept', () => {
  const merge: AiRequest = { ...base, kind: 'merge_cards', keepId: 1, mergeIds: [1, 2, 3] };
  let d = draftOf(merge);
  assert.deepEqual(d.ids, [2, 3]);
  d = toggleId(d, 0);
  assert.deepEqual(keptIds(d), [3]);
  assert.deepEqual(acceptedBody(merge, d), { keepId: 1, mergeIds: [3], changes: undefined, note: undefined });
  assert.equal(acceptedBody(merge, toggleId(d, 1)), null);

  const tidy: AiRequest = { ...base, kind: 'organise_cards', cardIds: [4, 5], action: { kind: 'tag', tag: 'exam' } };
  const t = toggleId(draftOf(tidy), 1);
  assert.deepEqual(acceptedBody(tidy, t), { cardIds: [4], action: { kind: 'tag', tag: 'exam' }, note: undefined });
  assert.equal(acceptedBody(tidy, toggleId(t, 0)), null);
});
