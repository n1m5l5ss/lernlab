import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from '@lernlab/core/types';
import { checkTyped, plainAnswer } from './typed-logic';

const card = (over: Partial<Item>): Item => ({
  id: 1,
  deckId: 1,
  lang: null,
  deck: 'Physics',
  image: null,
  video: null,
  category: null,
  extra: {},
  kind: 'card',
  target: 'Question',
  article: null,
  word: 'Question',
  meaning: '',
  sentenceHtml: '',
  sentence: '',
  sentenceMeaning: '',
  grammar: '',
  notes: '',
  audio: null,
  rank: 0,
  tags: [],
  group: null,
  ...over,
});

test('a numeric card is checked as a number, with its tolerance and unit', () => {
  const g = card({ kind: 'numeric', meaning: '9.81 m/s^2', extra: { tolerance: '0.05', alt: 'g' } });
  const accepted = ['9.81 m/s^2', 'g'];
  assert.equal(checkTyped(g, 'typed', '9.8', accepted, false).correct, true);
  assert.equal(checkTyped(g, 'boss', '9.8 m/s²', accepted, false).correct, true);
  assert.equal(checkTyped(g, 'typed', '9.9', accepted, false).correct, false);
  assert.equal(checkTyped(g, 'typed', '9.81 m/s', accepted, false).correct, false, 'a wrong unit is wrong');
  assert.equal(checkTyped(g, 'typed', 'g', accepted, false).correct, true, 'also-accept answers still work');
  assert.equal(checkTyped(g, 'typed', '9.81 m/s^2', ['9.81 m/s^2'], false).nearMiss, false);
});

test('other cards keep the text rules; math compares its source', () => {
  const basic = card({ meaning: 'mitochondrion' });
  assert.equal(checkTyped(basic, 'typed', 'mitochondrin', ['mitochondrion'], false).nearMiss, true);
  const math = card({ meaning: '\\(2x\\)' });
  assert.equal(checkTyped(math, 'typed', '2 x', ['\\(2x\\)'], false).correct, true);
  assert.equal(checkTyped(math, 'typed', '2y', ['\\(2x\\)'], false).correct, false);
});

test('answers to copy are shown without math delimiters', () => {
  assert.equal(plainAnswer('\\(\\pi r^2\\)'), '\\pi r^2');
  assert.equal(plainAnswer('der Hund'), 'der Hund');
});
