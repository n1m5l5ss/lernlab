import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MNEMONIC_MAX_LENGTH, cleanMnemonic, mnemonicHtml, mnemonicOf, nextRun, showsMnemonic } from './mnemonic';
import { cardToItem } from './library';

const deck = { id: 1, name: 'D', language: null };
const card = cardToItem(deck, { front: 'Order of the planets?', back: 'Mercury, Venus…', mnemonic: 'My Very…' })!;

test('a mnemonic is plain text, capped, kept in the extra fields, and cleared with an empty one', () => {
  assert.equal(mnemonicOf(card), 'My Very…');
  assert.equal(cleanMnemonic(' <b>My</b> <script>x()</script>Very '), 'My Very');
  assert.equal(cleanMnemonic('x'.repeat(1000)).length, MNEMONIC_MAX_LENGTH);
  assert.equal(cleanMnemonic(cleanMnemonic('&amp;lt;b&amp;gt;')), cleanMnemonic('&amp;lt;b&amp;gt;'));
  assert.equal(mnemonicHtml('**My** <i>Very</i>'), '<b>My</b> &lt;i&gt;Very&lt;/i&gt;');
  const kept = cardToItem(deck, { front: 'Q', back: 'A', extra: { mnemonic: 'kept' } })!;
  assert.equal(mnemonicOf(kept), 'kept', 'kept when the field is not given');
  const cleared = cardToItem(deck, { front: 'Q', back: 'A', mnemonic: '', extra: { mnemonic: 'old' } })!;
  assert.ok(!('mnemonic' in cleared.extra));
});

test('never before a recall attempt; by itself after a miss, until two correct answers in a row', () => {
  // Never missed: it stays out of the way, before and after the answer.
  assert.equal(showsMnemonic(card, undefined, { attempted: false }), false);
  assert.equal(showsMnemonic(card, undefined, { attempted: true }), false);
  // A miss: shown with the answer, never before trying.
  let run = nextRun(undefined, 'typed', false);
  assert.equal(run, 0);
  assert.equal(showsMnemonic(card, run, { attempted: false }), false);
  assert.equal(showsMnemonic(card, run, { attempted: true }), true);
  // First correct answer after the miss: still shown, after answering.
  run = nextRun(run, 'flip', true);
  assert.equal(showsMnemonic(card, run, { attempted: true }), true);
  // Second in a row: faded.
  run = nextRun(run, 'typed', true);
  assert.equal(run, 2);
  assert.equal(showsMnemonic(card, run, { attempted: true }), false);
  // Another miss brings it back.
  assert.equal(showsMnemonic(card, nextRun(run, 'cloze', false), { attempted: true }), true);
});

test('asking for a hint shows it at any time; a card without a mnemonic shows none', () => {
  assert.equal(showsMnemonic(card, undefined, { attempted: false, asked: true }), true);
  assert.equal(showsMnemonic(card, 5, { attempted: false, asked: true }), true);
  const none = cardToItem(deck, { front: 'Q', back: 'A' })!;
  assert.equal(showsMnemonic(none, 0, { attempted: true, asked: true }), false);
});

test('games and recognition rounds do not count toward the run', () => {
  assert.equal(nextRun(0, 'match', true), 0);
  assert.equal(nextRun(1, 'mc', false), 1);
  assert.equal(nextRun(undefined, 'blitz', false), undefined);
  assert.equal(nextRun(undefined, 'typed', true), undefined, 'never missed stays never missed');
});
