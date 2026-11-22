import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AiRequest } from '@lernlab/core/airequests';
import {
  acceptedBody,
  draftOf,
  editCard,
  editChange,
  editCorrection,
  editValue,
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

test('goals, a study plan and an export: the user can change the values; bad numbers or dates block accepting', () => {
  const goals: AiRequest = { ...base, kind: 'set_goals', dailyGoalSessions: 3 };
  let g = draftOf(goals);
  assert.deepEqual(g.values, { dailyGoalSessions: '3' });
  g = editValue(g, 'dailyGoalSessions', '2');
  assert.deepEqual(acceptedBody(goals, g), { dailyGoalSessions: 2, newPerDay: undefined, note: undefined });
  assert.equal(acceptedBody(goals, editValue(g, 'dailyGoalSessions', '9')), null);
  assert.equal(acceptedBody(goals, editValue(g, 'dailyGoalSessions', 'two')), null);

  const plan: AiRequest = {
    ...base,
    kind: 'study_plan',
    deckId: 4,
    plan: { examDate: '2027-03-01', goal: { label: 'B1', words: 800 }, newPerDay: 20 },
  };
  let p = draftOf(plan);
  assert.deepEqual(p.values, { examDate: '2027-03-01', goalLabel: 'B1', goalWords: '800', newPerDay: '20' });
  p = editValue(editValue(p, 'goalWords', '600'), 'newPerDay', '15');
  assert.deepEqual(acceptedBody(plan, p), {
    deckId: 4,
    plan: { examDate: '2027-03-01', goal: { label: 'B1', words: 600 }, newPerDay: 15 },
    note: undefined,
  });
  assert.equal(acceptedBody(plan, editValue(p, 'examDate', '')), null);
  assert.equal(acceptedBody(plan, editValue(p, 'goalLabel', ' ')), null);

  const exp: AiRequest = { ...base, kind: 'export_deck', deckId: 4, format: 'lernpack' };
  assert.deepEqual(acceptedBody(exp, editValue(draftOf(exp), 'format', 'csv')), {
    deckId: 4,
    format: 'csv',
    note: undefined,
  });
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

test('study aids are typed one per line; corrections keep their place per choice', () => {
  const aids: AiRequest = {
    ...base,
    kind: 'edit_card',
    cardId: 7,
    changes: { variants: ['apply: A', 'analyse: B'], corrections: ['wrong 1', '', 'wrong 3'], mnemonic: 'aid' },
  };
  let d = draftOf(aids);
  assert.equal(d.changes.variants, 'apply: A\nanalyse: B');
  d = editChange(d, 'variants', 'apply: A\n\n  recall: C  \n');
  d = editCorrection(d, 2, 'better 3');
  d = editCorrection(d, 4, 'for\nchoice 5');
  assert.deepEqual(acceptedBody(aids, d), {
    cardId: 7,
    changes: {
      variants: ['apply: A', 'recall: C'],
      corrections: ['wrong 1', '', 'better 3', '', 'for choice 5'],
      mnemonic: 'aid',
    },
    note: undefined,
  });
  const many = editChange(d, 'variants', Array.from({ length: 30 }, (_, i) => `recall: ${i}`).join('\n'));
  assert.equal((acceptedBody(aids, many)!.changes as { variants: string[] }).variants.length, 8);

  const points: AiRequest = { ...base, kind: 'edit_card', cardId: 7, changes: { keyPoints: ['a', 'b', 'c'] } };
  assert.equal(acceptedBody(points, editChange(draftOf(points), 'keyPoints', 'only one')), null);
  assert.deepEqual(acceptedBody(points, editChange(draftOf(points), 'keyPoints', 'a\nb'))!.changes, {
    keyPoints: ['a', 'b'],
  });
});
