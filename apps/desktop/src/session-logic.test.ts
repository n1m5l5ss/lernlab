import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../../locales/en.json';
import {
  MAX_REPEATS,
  NEW_CARD_RECALLS,
  RETRY_GAP,
  Relearn,
  answerKind,
  asRepeat,
  blockKey,
  blockProgress,
  needsRescue,
  playableOnly,
  plannedRecalls,
} from './session-logic';

/** Answers other cards until `id` is due again, and counts how many came between. */
function gapUntilDue(r: Relearn, id: number) {
  let n = 0;
  while (r.due() !== id) {
    r.answered(1000 + n, 'other', true);
    n++;
    assert.ok(n < 50, 'the card never came back');
  }
  return n;
}

test('a missed card comes back after 4 to 6 other exercises', () => {
  for (const [rand, gap] of [
    [0, 4],
    [0.5, 5],
    [0.99, 6],
  ]) {
    const r = new Relearn(() => rand);
    r.answered(7, 'recall', false);
    assert.equal(gapUntilDue(r, 7), gap);
  }
  assert.deepEqual(RETRY_GAP, { min: 4, max: 6 });
});

test('a missed card keeps coming back until it is recalled once, then leaves', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  gapUntilDue(r, 7);
  r.shown(7);
  r.answered(7, 'recall', false); // still wrong
  gapUntilDue(r, 7);
  r.shown(7);
  r.answered(7, 'recall', true);
  for (let n = 0; n < 20; n++) r.answered(100 + n, 'other', true);
  assert.equal(r.due(), null, 'recalled once: not shown again this session');
});

test('a hard card comes back at most 3 times, so it cannot trap the learner', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  let shows = 0;
  for (let n = 0; n < 200; n++) {
    if (r.due() === 7) {
      r.shown(7);
      shows++;
      r.answered(7, 'recall', false);
    } else r.answered(100 + n, 'other', true);
  }
  assert.equal(shows, MAX_REPEATS);
  assert.equal(MAX_REPEATS, 3);
});

test('a card answered right the first time is never brought back', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', true);
  for (let n = 0; n < 20; n++) r.answered(100 + n, 'other', true);
  assert.equal(r.due(), null);
});

test('games and recognition never count as recalling a card', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  r.answered(7, 'other', true); // e.g. multiple choice or a match game
  assert.equal(gapUntilDue(r, 7), 3, 'still waiting for a real recall');
});

test('a new card needs 2 correct recalls spread across the session, then is not shown again', () => {
  assert.equal(NEW_CARD_RECALLS, 2);
  const r = new Relearn(() => 0.5);
  r.answered(7, 'meet', true);
  r.answered(7, 'other', true); // recognise it right away
  assert.equal(gapUntilDue(r, 7), 4, 'the first recall comes a few exercises after meeting it');
  r.shown(7);
  r.answered(7, 'recall', true);
  assert.equal(gapUntilDue(r, 7), 5, 'then a second one, spaced');
  r.shown(7);
  r.answered(7, 'recall', true);
  for (let n = 0; n < 20; n++) r.answered(100 + n, 'other', true);
  assert.equal(r.due(), null, 'target met: no drilling');
});

test("a planned recall (like the Recall block) counts toward a new card's target", () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'meet', true);
  r.answered(7, 'recall', true); // planned, not a repeat
  gapUntilDue(r, 7);
  r.shown(7);
  r.answered(7, 'recall', true);
  for (let n = 0; n < 20; n++) r.answered(100 + n, 'other', true);
  assert.equal(r.due(), null);
});

test('a new question card first answered in the New cards block also needs 2 recalls', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', true, { fresh: true });
  assert.equal(gapUntilDue(r, 7), 4);
});

test('a missed new card still needs its 2 correct recalls, within the repeat limit', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'meet', true);
  let shows = 0;
  let right = 0;
  for (let n = 0; n < 200; n++) {
    if (r.due() === 7) {
      r.shown(7);
      shows++;
      const ok = shows > 1; // the first try is wrong, the rest right
      if (ok) right++;
      r.answered(7, 'recall', ok);
    } else r.answered(100 + n, 'other', true);
  }
  assert.equal(shows, 3);
  assert.equal(right, 2);
});

test('a card with a recall still planned later waits for it instead of being added', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  r.answered(8, 'recall', false);
  for (let n = 0; n < 5; n++) r.answered(100 + n, 'other', true);
  assert.equal(
    r.due((id) => (id === 7 ? 1 : 0)),
    8,
  );
});

test("a new card's planned Recall block counts toward its target, so only the missing recalls are added", () => {
  const r = new Relearn(() => 0);
  const planned = (id: number) => (id === 7 ? 1 : 0); // the Recall block near the end
  r.answered(7, 'meet', true);
  for (let n = 0; n < 4; n++) r.answered(100 + n, 'other', true);
  assert.equal(r.due(planned), 7, 'one early recall, a few exercises after meeting it');
  r.shown(7);
  r.answered(7, 'recall', true);
  for (let n = 0; n < 20; n++) r.answered(200 + n, 'other', true);
  assert.equal(r.due(planned), null, 'the second recall is the planned one');
  r.answered(7, 'recall', true);
  assert.equal(r.due(), null);
});

test('the card waiting longest comes back first', () => {
  const r = new Relearn(() => 0);
  r.answered(8, 'recall', false);
  r.answered(7, 'recall', false);
  for (let n = 0; n < 6; n++) r.answered(100 + n, 'other', true);
  assert.equal(r.due(), 8);
});

test('games between blocks count toward the gap', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  r.skip(4); // a match game of 4 answers
  assert.equal(r.due(), 7);
});

test('at the very end, a card still missed comes back once more if another card comes between', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  r.answered(8, 'recall', false);
  assert.equal(r.due(), null, 'not due yet');
  assert.equal(
    r.due(() => 0, { ending: true, last: 8 }),
    7,
  );
  r.shown(7);
  r.answered(7, 'recall', false);
  assert.equal(
    r.due(() => 0, { ending: true, last: 7 }),
    8,
  );
  r.shown(8);
  r.answered(8, 'recall', true);
  assert.equal(
    r.due(() => 0, { ending: true, last: 8 }),
    7,
  );
  r.shown(7);
  r.answered(7, 'recall', true);
  assert.equal(
    r.due(() => 0, { ending: true, last: 7 }),
    null,
  );
});

test('at the very end a card never comes back straight after itself, and new-card targets are let go', () => {
  const r = new Relearn(() => 0);
  r.answered(7, 'recall', false);
  assert.equal(
    r.due(() => 0, { ending: true, last: 7 }),
    null,
  );
  const s = new Relearn(() => 0);
  s.answered(9, 'meet', true);
  s.answered(9, 'recall', true); // one of two recalls done: the session may simply end
  assert.equal(
    s.due(() => 0, { ending: true, last: 1 }),
    null,
  );
});

test('the rescue round starts under 60% with at least 3 answers', () => {
  assert.equal(needsRescue({ correct: 1, total: 3 }), true);
  assert.equal(needsRescue({ correct: 3, total: 5 }), false);
  assert.equal(needsRescue({ correct: 0, total: 2 }), false);
});

test('block progress stays between 0 and 1', () => {
  assert.equal(blockProgress(5, 12), 5 / 12);
  assert.equal(blockProgress(3, 0), 0);
  assert.equal(blockProgress(14, 12), 1);
});

test('every block the planner and runner make has a translated title', () => {
  const sources = ['../../../packages/core/src/session.ts', './Session.tsx'].map((f) =>
    readFileSync(join(import.meta.dirname, f), 'utf8'),
  );
  const titles = sources.flatMap((src) => [...src.matchAll(/title: '([^']+)'/g)].map((m) => m[1]));
  assert.ok(titles.length >= 15);
  const blocks = en.session.blocks as Record<string, string>;
  for (const title of titles) assert.ok(blocks[blockKey(title)], `session.blocks.${blockKey(title)} for "${title}"`);
});

test('listening and dictation are skipped when the card cannot be played', () => {
  const exs = [
    { type: 'listen', itemId: 1 },
    { type: 'dictation', itemId: 2 },
    { type: 'typed', itemId: 2 },
    { type: 'listen', itemId: 3 },
  ];
  const kept = playableOnly(exs, (id) => id === 3);
  assert.deepEqual(kept, [
    { type: 'typed', itemId: 2 },
    { type: 'listen', itemId: 3 },
  ]);
});

test('only real recall formats count as recalling a card; meeting a card is not a recall', () => {
  assert.equal(answerKind('intro'), 'meet');
  for (const t of ['typed', 'cloze', 'flip', 'mcq', 'order', 'myth']) assert.equal(answerKind(t), 'recall', t);
  for (const t of ['mc', 'truefalse', 'listen', 'imagemc', 'unscramble', 'dictation', 'speak', 'lesson'])
    assert.equal(answerKind(t), 'other', t);
});

test('planned recalls are counted per card, recognition left out', () => {
  const planned = plannedRecalls([
    { type: 'typed', itemId: 1 },
    { type: 'mc', itemId: 1 },
    { type: 'cloze', itemId: 1 },
    { type: 'flip', itemId: 2 },
    { type: 'lesson' },
  ]);
  assert.equal(planned.get(1), 2);
  assert.equal(planned.get(2), 1);
  assert.equal(planned.get(3), undefined);
});

test('a card brought back is practice only: no second grade, no override of the real grade, no timer', () => {
  const sent: { practice?: boolean }[] = [];
  const overrides: [number, boolean | undefined][] = [];
  const ctx = {
    timer: 8,
    answer: (a: { itemId: number; practice?: boolean }) => (sent.push(a), 3),
    override: (id: number, practice?: boolean) => void overrides.push([id, practice]),
  };
  const rep = asRepeat<{ itemId: number; practice?: boolean }, typeof ctx>(ctx);
  assert.equal(rep.timer, 0);
  assert.equal(rep.answer({ itemId: 7 }), 3, 'XP as for any answer');
  rep.override(7);
  assert.deepEqual(sent, [{ itemId: 7, practice: true }]);
  assert.deepEqual(overrides, [[7, true]]);
  assert.equal(ctx.timer, 8, 'the normal context is unchanged');
});
