import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_WORDS_MAX, cardHints, countHints } from './cardquality';
import { cardToItem, type NormalizedCard } from './library';

const subject = { id: 1, name: 'Biology', language: null as string | null };
const german = { id: 2, name: 'German', language: 'de' };
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const hints = (c: NormalizedCard, deck = subject) => cardHints(cardToItem(deck, c)!);

test('a short card with no picture gets no hint', () => {
  assert.deepEqual(hints({ front: 'Capital of France?', back: 'Paris' }), []);
});

test('an answer over about 40 words: split it into two cards?', () => {
  assert.deepEqual(hints({ front: 'Q', back: words(ANSWER_WORDS_MAX), image: 'a.png', imageAlt: 'A cell' }), []);
  assert.deepEqual(hints({ front: 'Q', back: words(ANSWER_WORDS_MAX + 1), image: 'a.png', imageAlt: 'A cell' }), [
    'split',
  ]);
  // Formatting is not counted, and text without spaces is measured by its length.
  assert.deepEqual(hints({ front: 'Q', back: `<b>${words(10)}</b>`, image: 'a.png', imageAlt: 'x' }), []);
  assert.deepEqual(hints({ front: 'Q', back: '答'.repeat(200), image: 'a.png', imageAlt: 'x' }), ['split']);
});

test('the split hint is only for cards whose back is the answer', () => {
  const long = words(60);
  for (const c of [
    { front: 'Pick one', back: long, type: 'mcq', choices: 'a|b', correct: 'a' },
    { front: 'Order', back: long, type: 'order', steps: 'a|b|c' },
    { front: 'The {{c1::cell}} divides', back: long },
    { front: 'Why?', back: long, type: 'explain', keyPoints: 'one|two' },
  ] as NormalizedCard[])
    assert.ok(!hints({ ...c, image: 'a.png', imageAlt: 'x' }).includes('split'), c.type ?? 'cloze');
});

test('an image with no description: does it help the answer?', () => {
  assert.deepEqual(hints({ front: 'Q', back: 'A', image: 'a.png' }), ['decorativeImage']);
  assert.deepEqual(hints({ front: 'Q', back: 'A', image: 'a.png', imageAlt: 'A leaf cell' }), []);
  // In a language deck too: a picture that says nothing about the word is still a distraction.
  assert.deepEqual(hints({ front: 'der Hund', back: 'dog', image: 'a.png' }, german), ['decorativeImage']);
});

test('an abstract card with no picture: a diagram could help', () => {
  const idea = { front: 'What is osmosis?', back: words(20) };
  assert.deepEqual(hints(idea), ['diagram']);
  assert.deepEqual(hints({ ...idea, image: 'a.png', imageAlt: 'Water crossing a membrane' }), []);
  assert.deepEqual(hints({ ...idea, video: 'a.mp4' }), []);
  // Why and how cards are about an idea, whatever their length.
  assert.deepEqual(hints({ front: 'Why is the sky blue?', back: 'Scattering', tags: ['why'] }), ['diagram']);
  assert.deepEqual(hints({ front: 'Why?', back: 'Because', type: 'explain', keyPoints: 'one|two' }), ['diagram']);
  // A long answer gets both hints.
  assert.deepEqual(hints({ front: 'Q', back: words(50) }), ['split', 'diagram']);
});

test('language decks: no diagram hint, and text that repeats the audio is never flagged', () => {
  assert.deepEqual(hints({ front: 'der Hund', back: 'dog', audio: 'hund.mp3' }, german), []);
  assert.deepEqual(hints({ front: 'Ich habe einen Hund', back: words(20), audio: 'x.mp3', tags: ['how'] }, german), []);
});

test('count hints over a list of cards, most common first, skipping cards with no front', () => {
  const cards: NormalizedCard[] = [
    { front: 'Q1', back: words(50) },
    { front: 'Q2', back: words(20) },
    { front: 'Q3', back: 'A', image: 'a.png' },
    { front: '', back: words(50) },
    { front: 'Q4', back: 'A' },
  ];
  assert.deepEqual(countHints(subject, cards), [
    { hint: 'diagram', count: 2 },
    { hint: 'split', count: 1 },
    { hint: 'decorativeImage', count: 1 },
  ]);
  assert.deepEqual(countHints(subject, []), []);
});
