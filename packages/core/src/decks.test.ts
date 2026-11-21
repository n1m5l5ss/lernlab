import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckTree } from './decktree';

const deck = (id: number, name: string, due = 1) => ({ id, name, cards: 10, due, fresh: 2, learned: 3 });

test('sub-decks written as paths become a tree with branch totals', () => {
  const tree = deckTree([
    deck(1, 'Medicine::Cardio', 4),
    deck(2, 'German'),
    deck(3, 'Medicine::Cardio::ECG', 2),
    deck(4, 'Medicine::Neuro'),
  ]);
  assert.deepEqual(
    tree.map((n) => n.label),
    ['German', 'Medicine'],
  );
  const med = tree[1];
  assert.equal(med.deck, null, '"Medicine" exists only as a path');
  assert.deepEqual(
    med.children.map((n) => n.label),
    ['Cardio', 'Neuro'],
  );
  assert.equal(med.children[0].deck?.id, 1);
  assert.equal(med.children[0].children[0].label, 'ECG');
  assert.deepEqual(med.totals, { cards: 30, due: 7, fresh: 6, learned: 9 });
  assert.deepEqual(med.deckIds.sort(), [1, 3, 4]);
  assert.deepEqual(med.children[0].deckIds.sort(), [1, 3]);
});

test('odd names: spaces around the separator, empty parts and different case join one branch', () => {
  const tree = deckTree([deck(1, 'Bio :: Cell'), deck(2, 'bio::Plants'), deck(3, '::Lone::')]);
  assert.deepEqual(
    tree.map((n) => n.label),
    ['Bio', 'Lone'],
  );
  assert.deepEqual(
    tree[0].children.map((n) => n.label),
    ['Cell', 'Plants'],
  );
  assert.equal(tree[1].deck?.id, 3);
});

test('deck settings from the screen are checked and clamped; empty values clear a field', async () => {
  const { cleanDeckSettings } = await import('./library');
  assert.deepEqual(
    cleanDeckSettings({
      newPerDay: '25.4',
      goal: { label: '  Goethe B1 ', words: '2400' },
      examDate: '2027-03-15',
      ankiSource: 'evil',
    }),
    { newPerDay: 25, goal: { label: 'Goethe B1', words: 2400 }, examDate: '2027-03-15' },
  );
  assert.deepEqual(cleanDeckSettings({ newPerDay: -5, goal: null, examDate: '' }), {
    newPerDay: 0,
    goal: undefined,
    examDate: undefined,
  });
  assert.equal(cleanDeckSettings({ examDate: '2027-13-45' }).examDate, undefined);
  assert.equal(cleanDeckSettings({ newPerDay: 1e9 }).newPerDay, 999);
});

test('a deck keeps its reading voice and speed; speed stays between 0.5 and 1.5', async () => {
  const { cleanDeckSettings } = await import('./library');
  assert.deepEqual(cleanDeckSettings({ voice: ' Google Deutsch ', rate: '0.8' }), {
    voice: 'Google Deutsch',
    rate: 0.8,
  });
  assert.equal(cleanDeckSettings({ rate: 0.1 }).rate, 0.5);
  assert.equal(cleanDeckSettings({ rate: 9 }).rate, 1.5);
  assert.equal(cleanDeckSettings({ rate: 0.8333 }).rate, 0.85, 'rounded to steps of 0.05');
  assert.deepEqual(cleanDeckSettings({ voice: '', rate: null }), { voice: undefined, rate: undefined });
  assert.equal(cleanDeckSettings({ voice: 42 }).voice, undefined);
  assert.equal((cleanDeckSettings({ voice: 'x'.repeat(900) }).voice as string).length, 300);
});
