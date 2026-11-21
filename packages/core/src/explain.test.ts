import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEY_POINTS_MAX,
  KEY_POINT_MAX_LENGTH,
  asksWhy,
  askedOwnWay,
  cleanKeyPoints,
  explainOutcome,
  formatKeyPoints,
  isExplain,
  keyPointHtml,
  keyPointsAsBack,
  keyPointsOf,
  parseKeyPoints,
  understandingGap,
} from './explain';
import { cardToItem } from './library';
import { explain, recall } from './exercises';
import { gradeFor } from './game';

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
  assert.ok(askedOwnWay(item));
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

test('an explain card is asked as an explanation with its key points; never a plain flip', () => {
  const item = cardToItem(deck, { ...WHY, type: 'explain' }, 7)!;
  const ex = recall(item);
  assert.deepEqual(ex, {
    type: 'explain',
    itemId: 7,
    prompt: WHY.front,
    answer: WHY.back,
    points: ['Earth is tilted', 'The tilt changes the angle of sunlight', 'Not the distance to the sun'],
  });
  assert.equal(recall(item, 2).type, 'explain');
});

test('basic cards tagged why or how ask for an explanation first (no key points), instead of a plain flip', () => {
  const long = {
    front: 'How does a vaccine work?',
    back: 'It trains the immune system with a harmless part of a germ, so it reacts faster later.',
  };
  const tagged = cardToItem(deck, { ...long, tags: ['biology', 'How'] }, 3)!;
  assert.ok(asksWhy(tagged));
  assert.ok(!isExplain(tagged) && !askedOwnWay(tagged), 'still a basic card for games');
  assert.deepEqual(recall(tagged), { type: 'explain', itemId: 3, prompt: long.front, answer: long.back, points: [] });
  const variant = cardToItem(deck, { ...long, tags: ['why'], variants: 'apply: A child gets one. Why?' }, 4)!;
  const ex = recall(variant, 1);
  assert.ok(ex.type === 'explain' && ex.level === 'apply' && ex.prompt === 'A child gets one. Why?');
  assert.equal(recall(cardToItem(deck, long, 5)!).type, 'typed', 'untagged cards are asked as before');
  assert.equal(
    recall(cardToItem(deck, { front: 'Why?', back: 'tilt', tags: ['why'] })!).type,
    'typed',
    'short answers are typed',
  );
  assert.equal(explain(tagged).type, 'explain');
});

test('ticked key points map to a grade: all Good, some Hard, none Again; Easy only when all are ticked', () => {
  assert.deepEqual(explainOutcome(3, 3), { correct: true, nearMiss: false, easy: false });
  assert.deepEqual(explainOutcome(3, 3, true), { correct: true, nearMiss: false, easy: true });
  assert.deepEqual(explainOutcome(2, 3, true), { correct: true, nearMiss: true, easy: false });
  assert.deepEqual(explainOutcome(0, 3, true), { correct: false, nearMiss: false, easy: false });
  const grade = (o: ReturnType<typeof explainOutcome>, reps = 3) =>
    gradeFor({ format: 'flip', responseMs: 60_000, answerLength: 40, reps, ...o });
  assert.equal(grade(explainOutcome(3, 3)), 3);
  assert.equal(grade(explainOutcome(3, 3, true)), 4);
  assert.equal(grade(explainOutcome(3, 3, true), 0), 3, 'a new card is never Easy');
  assert.equal(grade(explainOutcome(1, 3, true)), 2);
  assert.equal(grade(explainOutcome(0, 3)), 1);
});

test('the understanding gap compares the ratings before and after (1–7), only when both are given', () => {
  assert.equal(understandingGap(6, 4), -2);
  assert.equal(understandingGap(3, 5), 2);
  assert.equal(understandingGap(null, 5), null);
  assert.equal(understandingGap(4, null), null);
});
