import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SessionPlan } from '@lernlab/core/types';
import type { SessionResult } from './Session';
import { addTurn, turnsOf } from './together-logic';

const plan = (id: string, blocks: string[]) =>
  ({ id, length: 'mini', blocks: blocks.map((b) => ({ id: b })), items: {}, extras: {} }) as unknown as SessionPlan;

test('turns alternate round by round, the first learner first; extra rounds follow', () => {
  const turns = turnsOf(plan('mine', ['a1', 'a2']), plan('theirs', ['b1', 'b2', 'b3', 'b4']), 'ben');
  assert.deepEqual(
    turns.map((t) => [t.learner, t.plan.id, t.plan.blocks.map((b) => b.id).join()]),
    [
      [null, 'mine', 'a1'],
      ['ben', 'theirs', 'b1'],
      [null, 'mine', 'a2'],
      ['ben', 'theirs', 'b2'],
      ['ben', 'theirs', 'b3'],
      ['ben', 'theirs', 'b4'],
    ],
  );
  assert.deepEqual(turnsOf(plan('mine', []), plan('theirs', []), 'ben'), []);
});

test("a learner's turns add up to one session of their own", () => {
  const turn = (over: Partial<SessionResult>) =>
    ({
      sessionId: 'mine',
      length: 'mini',
      seconds: 60,
      answers: 5,
      correct: 4,
      bossWon: null,
      bestGenderCombo: 2,
      perfectBlocks: 0,
      startedAt: '2026-11-22T10:00:00.000Z',
      ...over,
    }) as SessionResult;
  const total = addTurn(
    addTurn(undefined, turn({})),
    turn({
      seconds: 45,
      answers: 3,
      correct: 3,
      perfectBlocks: 1,
      bestGenderCombo: 1,
      startedAt: 'later',
      bossWon: true,
    }),
  );
  assert.deepEqual(total, {
    sessionId: 'mine',
    length: 'mini',
    seconds: 105,
    answers: 8,
    correct: 7,
    bossWon: true,
    bestGenderCombo: 2,
    perfectBlocks: 1,
    startedAt: '2026-11-22T10:00:00.000Z',
  });
});
