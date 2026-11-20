import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictation, listen } from './exercises';
import type { Item } from './types';

const item = (id: number, over: Partial<Item> = {}): Item => ({
  id,
  deckId: 1,
  lang: null,
  deck: 'D',
  image: null,
  video: null,
  category: null,
  extra: {},
  kind: 'word',
  target: `word${id}`,
  article: null,
  word: `word${id}`,
  meaning: `meaning${id}`,
  sentenceHtml: '',
  sentence: '',
  sentenceMeaning: '',
  grammar: '',
  notes: '',
  audio: null,
  rank: id,
  tags: [],
  group: null,
  ...over,
});
const pool = [1, 2, 3, 4, 5].map((id) => item(id, { lang: 'de' }));

test('listening works from a card recording, or from the system voice on a language deck', () => {
  assert.ok(listen(item(1, { audio: 'a.mp3' }), pool));
  assert.ok(listen(item(1, { lang: 'de' }), pool));
  assert.equal(listen(item(1), pool), null); // no recording and no language to speak it in
});

test('dictation needs a short sentence it can play', () => {
  const sentence = { sentence: 'Der Hund bellt.', sentenceMeaning: 'The dog barks.' };
  assert.ok(dictation(item(1, { ...sentence, lang: 'de' })));
  assert.ok(dictation(item(1, { ...sentence, audio: 'a.mp3' })));
  assert.equal(dictation(item(1, sentence)), null);
  assert.equal(dictation(item(1, { lang: 'de' })), null);
  assert.equal(
    dictation(item(1, { lang: 'de', sentence: 'Das ist ein sehr langer Satz mit viel zu vielen Wörtern darin.' })),
    null,
  );
});
