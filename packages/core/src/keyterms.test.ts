import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_TERMS_MAX, answerSource, cleanKeyTerms, keyTermsOf, markAnswer, parseKeyTerms } from './keyterms';
import { cardToItem } from './library';
import { sanitizeHtml } from './cards';

const deck = { id: 1, name: 'D', language: null };
const card = (back: string, more: object = {}) => cardToItem(deck, { front: 'Q?', back, ...more })!;

test('==term== in a basic back: the answer stays plain text and the terms are kept beside it', () => {
  const item = card('The ==mitochondrion== makes ==ATP== from glucose');
  assert.equal(item.meaning, 'The mitochondrion makes ATP from glucose');
  assert.deepEqual(keyTermsOf(item), ['mitochondrion', 'ATP']);
  assert.equal(markAnswer(item, item.meaning), 'The <mark>mitochondrion</mark> makes <mark>ATP</mark> from glucose');
  assert.equal(answerSource(item), 'The ==mitochondrion== makes ==ATP== from glucose');
  // Saved again from the editor, it is the same card.
  assert.deepEqual(card(answerSource(item)).extra, item.extra);
});

test('a card without key terms is untouched', () => {
  const item = card('a < b & c');
  assert.ok(!('keyTerms' in item.extra));
  assert.equal(markAnswer(item, item.meaning), item.meaning);
  assert.equal(answerSource(item), 'a < b & c');
});

test('only the plain answer is marked, and what is shown is safe', () => {
  const item = card('==x== < y & <script>alert(1)</script> z');
  assert.equal(markAnswer(item, 'another text with x'), 'another text with x');
  const html = markAnswer(item, item.meaning);
  assert.equal(html, '<mark>x</mark> &lt; y &amp; z');
  assert.equal(sanitizeHtml(html), html);
});

test('terms are marked as whole words, every time they appear, and not inside formulas', () => {
  const item = card('==cat== and cat, not category or \\( cat \\)');
  assert.equal(markAnswer(item, item.meaning), '<mark>cat</mark> and <mark>cat</mark>, not category or \\( cat \\)');
  assert.equal(card(answerSource(item)).extra.keyTerms, 'cat');
  // Scripts without spaces have no word edges.
  const zh = card('这是==重点==内容');
  assert.equal(markAnswer(zh, zh.meaning), '这是<mark>重点</mark>内容');
});

test('the keyTerms field from a deck file: plain, capped, and only terms that are in the answer', () => {
  assert.deepEqual(parseKeyTerms('<b>ATP</b>| |ATP|a=b|' + 'x'.repeat(101)), ['ATP']);
  assert.equal(parseKeyTerms('a|b|c|d|e|f|g').length, KEY_TERMS_MAX);
  assert.equal(cleanKeyTerms('ATP|ADP|<script>x</script>', 'ATP is made here'), 'ATP');
  const item = card('ATP is made here', { keyTerms: 'ATP|ADP' });
  assert.equal(item.extra.keyTerms, 'ATP');
  // Marks in the back win over the field; '' clears stored terms; a missing field keeps them.
  assert.equal(card('==ATP== is made here', { keyTerms: 'here' }).extra.keyTerms, 'ATP');
  assert.ok(!('keyTerms' in card('ATP is made here', { keyTerms: '', extra: { keyTerms: 'ATP' } }).extra));
  assert.equal(card('ATP is made here', { extra: { keyTerms: 'ATP' } }).extra.keyTerms, 'ATP');
  assert.ok(!('keyTerms' in card('ADP only', { extra: { keyTerms: 'ATP' } }).extra), 'gone with its word');
});

test('cards that keep formatting in the back hold the highlight there, and code cards have none', () => {
  const mcq = cardToItem(deck, { front: 'Pick', back: '==Paris==', choices: 'Paris|Lyon', correct: '1' })!;
  assert.equal(mcq.meaning, '<mark>Paris</mark>');
  assert.ok(!('keyTerms' in mcq.extra));
  const code = cardToItem(deck, { front: 'Output?', back: '==x==', type: 'code', code: 'print("==x==")' })!;
  assert.ok(!('keyTerms' in code.extra));
});
