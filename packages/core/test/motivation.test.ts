// The motivation layer at the end of a session: streak freezes, repair and new badges come back with the finish.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-motivation-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { finishSession } = await import('../src/progress');
const { setMeta, getDb } = await import('../src/db');
const { NEW_STREAK } = await import('../src/game');
after(() => cleanupTempDir(dir));

const finish = (id: string, at: Date) =>
  finishSession(
    {
      sessionId: id,
      length: 'mini',
      seconds: 300,
      answers: 0,
      correct: 0,
      bossWon: null,
      bestGenderCombo: 0,
      perfectBlocks: 0,
      startedAt: at.toISOString(),
    },
    getDb(),
    at,
  );

test('the first session unlocks a badge and reports no streak change', () => {
  const r = finish('a', new Date(2026, 10, 20, 12));
  assert.deepEqual(
    r.unlocked.map((u) => u.key),
    ['first'],
  );
  assert.deepEqual(r.streakChange, { freezeEarned: false, repaired: false, repairDone: null });
});

test('a broken streak comes back after two sessions within the repair window', () => {
  setMeta(getDb(), 'streak', {
    ...NEW_STREAK,
    freezes: 0,
    lastCountedDay: '2026-11-20',
    lastSettledDay: '2026-11-21',
    repair: { value: 9, deadline: '2026-11-23', sessionsDone: 0 },
  });
  const one = finish('b', new Date(2026, 10, 22, 12));
  assert.equal(one.streakChange.repairDone, 1);
  assert.ok(one.streak.repair);
  const two = finish('c', new Date(2026, 10, 22, 13));
  assert.equal(two.streakChange.repaired, true);
  assert.equal(two.streak.current, 10, 'the 9 days come back, plus today');
  assert.equal(two.streak.repair, null);
});
