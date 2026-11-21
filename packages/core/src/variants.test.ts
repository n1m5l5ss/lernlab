import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanVariants,
  formatVariants,
  parseVariants,
  variantIndex,
  variantsOf,
  VARIANT_MAX_LENGTH,
  VARIANTS_MAX,
} from './variants';
import { cardToItem } from './library';

test('variants read from "level: question | level: question"; no known level means recall', () => {
  assert.deepEqual(
    parseVariants('apply: A patient has X. Which mechanism? | Analyze: What if X doubles? | In other words?'),
    [
      { prompt: 'A patient has X. Which mechanism?', level: 'apply' },
      { prompt: 'What if X doubles?', level: 'analyse' },
      { prompt: 'In other words?', level: 'recall' },
    ],
  );
  assert.deepEqual(parseVariants('Note: not a level'), [{ prompt: 'Note: not a level', level: 'recall' }]);
  assert.deepEqual(parseVariants(''), []);
  assert.deepEqual(parseVariants(undefined), []);
  assert.deepEqual(parseVariants(' | apply: | |'), [], 'empty questions are dropped');
});

test('variants are plain text, capped in number and length, without duplicates', () => {
  assert.deepEqual(parseVariants('apply: <b>Why</b> <script>x</script>does it&nbsp;work?'), [
    { prompt: 'Why does it work?', level: 'apply' },
  ]);
  const many = Array.from({ length: 12 }, (_, i) => `apply: Q${i}`).join(' | ');
  assert.equal(parseVariants(many).length, VARIANTS_MAX);
  assert.deepEqual(parseVariants('apply: Is &amp;lt;b&amp;gt; bold?'), [{ prompt: 'Is bold?', level: 'apply' }]);
  assert.equal(cleanVariants('Is a &lt; b?'), 'recall: Is a < b?');
  assert.equal(cleanVariants(cleanVariants('Is a &lt; b?')), 'recall: Is a < b?', 'stable when read again');
  const long = parseVariants(`analyse: ${'x'.repeat(2000)}`)[0];
  assert.equal(long.prompt.length, VARIANT_MAX_LENGTH);
  assert.deepEqual(parseVariants('apply: Same | analyse: same | recall: Other'), [
    { prompt: 'Same', level: 'apply' },
    { prompt: 'Other', level: 'recall' },
  ]);
});

test('formatting writes one canonical line; a | inside a question cannot split it', () => {
  const line = formatVariants([
    { prompt: 'A or | B?', level: 'apply' },
    { prompt: '  ', level: 'analyse' },
    { prompt: 'Why?', level: 'analyse' },
  ]);
  assert.equal(line, 'apply: A or / B? | analyse: Why?');
  assert.deepEqual(parseVariants(line), [
    { prompt: 'A or / B?', level: 'apply' },
    { prompt: 'Why?', level: 'analyse' },
  ]);
  assert.equal(cleanVariants(line), line, 'cleaning is stable');
  assert.equal(cleanVariants('Why?'), 'recall: Why?');
  assert.equal(cleanVariants(''), '');
});

test('stored in extra (no migration): kept when not sent, cleared by an empty value, dropped on question cards', () => {
  const deck = { id: 1, name: 'D', language: null };
  const item = cardToItem(deck, {
    front: 'Beta blocker',
    back: 'slows the heart',
    variants: 'apply: <i>A</i> patient?',
  })!;
  assert.equal(item.extra.variants, 'apply: A patient?');
  assert.deepEqual(variantsOf(item), [{ prompt: 'A patient?', level: 'apply' }]);
  const kept = cardToItem(deck, { front: 'x', back: 'y', extra: { variants: 'apply: Q' } })!;
  assert.equal(kept.extra.variants, 'apply: Q', 'a card saved without the field keeps its variants');
  const cleared = cardToItem(deck, { front: 'x', back: 'y', variants: '', extra: { variants: 'apply: Q' } })!;
  assert.ok(!('variants' in cleared.extra));
  for (const card of [
    { front: 'Pick', back: '', type: 'mcq', choices: 'A|B', correct: '1' },
    { front: 'Order', back: '', type: 'order', steps: 'a|b' },
    { front: 'The {{c1::sun}}', back: '' },
  ]) {
    const q = cardToItem(deck, { ...card, variants: 'apply: Q' })!;
    assert.ok(!('variants' in q.extra), `${q.kind} cards ask their own question`);
  }
  assert.equal(
    cardToItem(deck, { front: '2+2', back: '4', type: 'numeric', variants: 'apply: 3+1?' })!.extra.variants,
    'apply: 3+1?',
  );
});

test('rotation: new cards ask their own question; each review moves to the next wording', () => {
  assert.equal(variantIndex(7, 0, 2), 0, 'not reviewed yet: the card itself');
  assert.equal(variantIndex(7, -1, 2), 0, 'new card');
  assert.equal(variantIndex(7, 3, 0), 0, 'no variants');
  const seq = [1, 2, 3, 4, 5, 6].map((reps) => variantIndex(7, reps, 2));
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], 'never the same wording twice in a row');
  assert.deepEqual(new Set(seq), new Set([0, 1, 2]), 'every wording comes up');
  assert.notEqual(variantIndex(7, 1, 2), variantIndex(8, 1, 2), 'cards start at different places');
});
