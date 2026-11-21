import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEY_POINTS_MAX,
  KEY_POINT_MAX_LENGTH,
  cleanKeyPoints,
  formatKeyPoints,
  isExplain,
  keyPointHtml,
  keyPointsAsBack,
  keyPointsOf,
  parseKeyPoints,
} from './explain';
import { cardToItem } from './library';

const deck = { id: 1, name: 'D', language: null };
const WHY = {
  front: 'Why do we have seasons?',
  back: "Earth's tilted axis changes how directly sunlight hits each half.",
  keyPoints: 'Earth is tilted|The tilt changes the angle of sunlight|Not the distance to the sun',
};

test('key points read as plain text separated by |, without blanks or repeats, at most five', () => {
  assert.deepEqual(parseKeyPoints(' a | | b|A |c'), ['a', 'b', 'c']);
  assert.deepEqual(parseKeyPoints(undefined), []);
  assert.deepEqual(parseKeyPoints('1|2|3|4|5|6|7'), ['1', '2', '3', '4', '5']);
  assert.equal(KEY_POINTS_MAX, 5);
  assert.deepEqual(parseKeyPoints('<b>Tilt</b> <script>x</script>**matters**'), ['Tilt **matters**']);
  assert.equal(parseKeyPoints('x'.repeat(5000))[0].length, KEY_POINT_MAX_LENGTH);
});

test('a card needs two key points; cleaning is stable and a | inside a point cannot split it', () => {
  assert.equal(cleanKeyPoints('only one'), '');
  assert.equal(cleanKeyPoints('a|b'), 'a|b');
  assert.equal(cleanKeyPoints(cleanKeyPoints('a &amp;lt; b|c')), cleanKeyPoints('a &amp;lt; b|c'));
  assert.equal(formatKeyPoints(['a|b', 'c', '']), 'a/b|c');
  assert.equal(formatKeyPoints(['one']), '');
});

test('key points show as safe HTML with **bold**, *italic* and `code`', () => {
  assert.equal(
    keyPointHtml('**Tilt** <img src=x onerror=alert(1)> `axis`'),
    '<b>Tilt</b> &lt;img src=x onerror=alert(1)&gt; <code>axis</code>',
  );
  assert.equal(keyPointsAsBack(['a & b', 'c']), '• a & b\n• c');
});

test('type "explain" makes a basic card with its key points in extra (no migration), without variants', () => {
  const item = cardToItem(deck, { ...WHY, type: 'explain', variants: 'apply: Q?' })!;
  assert.equal(item.kind, 'card');
  assert.equal(item.extra.keyPoints, WHY.keyPoints);
  assert.ok(isExplain(item));
  assert.deepEqual(keyPointsOf(item), WHY.keyPoints.split('|'));
  assert.ok(!('variants' in item.extra));
  assert.ok(isExplain(cardToItem(deck, { ...WHY })!), 'key points alone make an explain card');
  assert.ok(isExplain(cardToItem({ ...deck, language: 'de' }, { ...WHY, front: 'der Hund', type: 'Explain' })!));
  const kept = cardToItem(deck, { front: WHY.front, back: WHY.back, extra: { keyPoints: WHY.keyPoints } })!;
  assert.ok(isExplain(kept), 'a card saved without a type stays an explain card');
  assert.ok(!isExplain(cardToItem(deck, { ...WHY, type: 'basic' })!), 'another type turns it back into a basic card');
  assert.ok(!isExplain(cardToItem(deck, { ...WHY, keyPoints: 'just one' })!), 'one point is not enough');
  assert.ok(!isExplain(cardToItem(deck, { ...WHY, type: 'myth' })!), 'a myth is a myth');
  const cleared = cardToItem(deck, { ...WHY, keyPoints: '', extra: { keyPoints: WHY.keyPoints } })!;
  assert.ok(!isExplain(cleared), "'' clears them");
});

test('a back that is just the key points joined (what older readers get) is not kept as the model answer', () => {
  const points = WHY.keyPoints.split('|');
  const item = cardToItem(deck, { ...WHY, back: keyPointsAsBack(points) })!;
  assert.equal(item.meaning, '');
  assert.equal(cardToItem(deck, WHY)!.meaning, WHY.back);
});
