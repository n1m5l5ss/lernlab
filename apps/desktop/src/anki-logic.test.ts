import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coveredByParent, decksToImport, depth, leafName, selectedCards, toggleDeck } from './anki-logic';

test('ticking a parent deck takes its subdecks along', () => {
  let s = toggleDeck(new Set(), 'Lang::German::Tier1');
  s = toggleDeck(s, 'Spanish');
  s = toggleDeck(s, 'Lang::German');
  assert.deepEqual([...s].sort(), ['Lang::German', 'Spanish']);
  assert.ok(coveredByParent('Lang::German::Tier1', s));
  assert.ok(!coveredByParent('Lang::Germany', s), 'a deck with a similar name is not a subdeck');
  assert.deepEqual(decksToImport(new Set(['A', 'A::B', 'C'])), ['A', 'C']);
  assert.deepEqual([...toggleDeck(s, 'Spanish')], ['Lang::German']);
});

test('names, nesting and card totals', () => {
  assert.equal(depth('Lang::German::Tier1'), 2);
  assert.equal(leafName('Lang::German::Tier1'), 'Tier1');
  const decks = [
    { name: 'A', cards: 10 },
    { name: 'A::B', cards: 4 },
    { name: 'C', cards: 3 },
    { name: 'D', cards: null },
  ];
  assert.equal(selectedCards(decks, new Set(['A', 'A::B', 'C'])), 13);
  assert.equal(selectedCards(decks, new Set(['D'])), null);
});
