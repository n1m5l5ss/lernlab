import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, splitBold, acceptedAnswers, splitArticle, similarity, tokenize } from './text';

test('exact noun with article is correct', () => {
  const r = checkAnswer('der Sohn', ['der Sohn'], { requireArticle: true });
  assert.equal(r.correct, true);
  assert.equal(r.nearMiss, false);
});

test('wrong article is an article error, not correct', () => {
  const r = checkAnswer('die Sohn', ['der Sohn'], { requireArticle: true });
  assert.equal(r.correct, false);
  assert.equal(r.articleError, true);
});

test('missing article is an article error', () => {
  const r = checkAnswer('Sohn', ['der Sohn'], { requireArticle: true });
  assert.equal(r.articleError, true);
});

test('lowercase noun is accepted as near miss', () => {
  const r = checkAnswer('der sohn', ['der Sohn'], { requireArticle: true });
  assert.equal(r.correct, true);
  assert.equal(r.nearMiss, true);
});

test('umlaut written as ue is near miss', () => {
  const r = checkAnswer('mude', ['müde']);
  assert.equal(r.correct, true); // u for ü is a common slip: accepted, but graded Hard
  assert.equal(r.nearMiss, true);
  const r2 = checkAnswer('muede', ['müde']);
  assert.equal(r2.correct, true);
  assert.equal(r2.nearMiss, true);
});

test('one typo on a long word is near miss, two typos is wrong', () => {
  assert.equal(checkAnswer('Anfagn', ['Anfang']).correct, false);
  const r = checkAnswer('Anfng', ['Anfang']);
  assert.equal(r.correct, true);
  assert.equal(r.nearMiss, true);
});

test('splitBold finds the cloze answer', () => {
  assert.deepEqual(splitBold('Ich <b>bin</b> müde.'), { before: 'Ich', bold: 'bin', after: 'müde.' });
  assert.equal(splitBold('No bold here'), null);
});

test('acceptedAnswers splits alternatives and drops numbering', () => {
  assert.deepEqual(acceptedAnswers('der / die / das'), ['der / die / das', 'der', 'die', 'das']);
  assert.deepEqual(acceptedAnswers('sein: ich bin (1)'), ['sein: ich bin']);
});

test('splitArticle', () => {
  assert.deepEqual(splitArticle('das Kind'), { article: 'das', word: 'Kind' });
  assert.deepEqual(splitArticle('der / die / das'), { article: null, word: 'der / die / das' });
});

test('similarity tolerates speech-recognition noise', () => {
  assert.ok(similarity('Ich bin müde', 'ich bin müde.') === 1);
  assert.ok(similarity('Ich bin mude', 'Ich bin müde') > 0.8);
});

test('tokenize strips html', () => {
  assert.deepEqual(tokenize('Ich <b>bin</b> müde.'), ['Ich', 'bin', 'müde.']);
});
