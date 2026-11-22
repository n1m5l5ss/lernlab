import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, sessionPatterns, type PatternAnswer } from './patterns';

let n = 0;
const a = (over: Partial<PatternAnswer> = {}): PatternAnswer => ({
  itemId: ++n,
  format: 'typed',
  correct: true,
  usedHint: false,
  responseMs: 4000,
  confidence: null,
  tags: [],
  mixup: false,
  ...over,
});
const kinds = (rows: PatternAnswer[]) => sessionPatterns(rows).lines.map((l) => l.kind);

test('an ordinary session has nothing to say', () => {
  assert.deepEqual(sessionPatterns([]), { lines: [], next: null });
  assert.deepEqual(sessionPatterns([a(), a(), a({ correct: false }), a()]), { lines: [], next: null });
});

test('mix-ups: misses that were another card’s answer, from 2 up', () => {
  assert.deepEqual(kinds([a({ correct: false, mixup: true })]), []);
  const p = sessionPatterns([a({ correct: false, mixup: true }), a({ correct: false, mixup: true }), a()]);
  assert.deepEqual(p.lines, [{ kind: 'mixups', count: 2 }]);
  assert.equal(p.next, 'mixups');
});

test('a tag: named when it holds at least 3 missed cards, most of the misses, and is not on every card', () => {
  const geo = (correct: boolean, itemId?: number) => a({ correct, tags: ['Geography'], ...(itemId && { itemId }) });
  const rows = [geo(false), geo(false), geo(false), geo(true), a({ correct: false, tags: ['History'] }), a(), a()];
  const p = sessionPatterns(rows);
  assert.deepEqual(p.lines, [{ kind: 'tag', tag: 'Geography', missed: 3, cards: 4 }]);
  assert.equal(p.next, 'tag');
  // The same card missed three times is one card.
  assert.deepEqual(kinds([geo(false, 900), geo(false, 900), geo(false, 900), a()]), []);
  // Every card has the tag: it says nothing about where the misses are.
  assert.deepEqual(kinds([geo(false), geo(false), geo(false), geo(true)]), []);
  // Spread over tags: no single one holds most of them.
  const spread = ['A', 'B', 'C'].flatMap((t) => [a({ correct: false, tags: [t] }), a({ correct: false, tags: [t] })]);
  assert.deepEqual(kinds([...spread, a({ correct: false, tags: ['A'] }), a()]), []);
});

test('confident misses, very fast misses and hints each need a few answers before they are named', () => {
  assert.deepEqual(
    sessionPatterns([a({ correct: false, confidence: 5 }), a({ correct: false, confidence: 4 }), a({ confidence: 5 })])
      .lines,
    [{ kind: 'confident', count: 2 }],
  );
  const fast = (over: Partial<PatternAnswer> = {}) => a({ correct: false, responseMs: 900, ...over });
  assert.deepEqual(sessionPatterns([fast(), fast(), fast(), a()]).lines, [{ kind: 'fast', count: 3 }]);
  assert.deepEqual(kinds([fast(), fast()]), [], 'two is not a pattern');
  assert.deepEqual(
    kinds([fast({ format: 'blitz' }), fast({ format: 'rain' }), fast({ format: 'match' })]),
    [],
    'timed games are meant to be fast',
  );
  assert.deepEqual(
    kinds([fast({ format: 'flip' }), fast({ format: 'flip' }), fast({ format: 'flip' })]),
    [],
    'a flip is rated, not answered',
  );

  const hinted = [1, 2, 3].map(() => a({ usedHint: true }));
  assert.deepEqual(sessionPatterns([...hinted, a(), a()]).lines, [{ kind: 'hints', used: 3, answers: 5 }]);
  assert.deepEqual(kinds([...hinted.slice(0, 2), a()]), [], 'too few typed answers to say');
  assert.deepEqual(kinds([a({ usedHint: true }), a(), a(), a(), a()]), [], 'under the share');
  assert.equal(PATTERNS.hintShare, 0.4);
});

test('effort is named: cards missed and then recalled later in the session', () => {
  const rows = [
    a({ itemId: 501, correct: false }),
    a({ itemId: 502, correct: false }),
    a({ itemId: 501 }),
    a({ itemId: 502 }),
    a({ itemId: 503 }),
  ];
  assert.deepEqual(sessionPatterns(rows), { lines: [{ kind: 'comeback', count: 2 }], next: null });
  // Recognition after a miss is not a recall.
  assert.deepEqual(
    kinds([
      a({ itemId: 601, correct: false }),
      a({ itemId: 602, correct: false }),
      a({ itemId: 601, format: 'mc' }),
      a({ itemId: 602, format: 'match' }),
    ]),
    [],
  );
});

test('at most three lines, the most useful first, and one next step: the first line’s', () => {
  const rows = [
    a({ correct: false, mixup: true, tags: ['Geo'], confidence: 5, responseMs: 500, itemId: 701 }),
    a({ correct: false, mixup: true, tags: ['Geo'], confidence: 5, responseMs: 500, itemId: 702 }),
    a({ correct: false, tags: ['Geo'], responseMs: 500, usedHint: true, itemId: 703 }),
    a({ usedHint: true, itemId: 701 }),
    a({ usedHint: true, itemId: 702 }),
    a({ tags: ['Other'] }),
  ];
  const p = sessionPatterns(rows);
  assert.deepEqual(
    p.lines.map((l) => l.kind),
    ['mixups', 'tag', 'confident'],
  );
  assert.equal(p.lines.length, PATTERNS.maxLines);
  assert.equal(p.next, 'mixups');
});
