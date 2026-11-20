// Arcade rounds are practice: they never touch the FSRS schedule, and their clocks follow the timer setting.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8 } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-arcade-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { planSession } = await import('../src/session');
const { recordAttempt, getSettings } = await import('../src/learn');
const { setMeta } = await import('../src/db');
const { ARCADE_FORMATS } = await import('../src/game');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const CSV = `front,back,category
cat,Katze,animal
dog,Hund,animal
cow,Kuh,animal
red,rot,colour
blue,blau,colour
green,grün,colour
one,eins,number
two,zwei,number
`;
const { deck } = importFile('Arcade.csv', strToU8(CSV));
const ids = getDb()
  .prepare('SELECT id FROM items WHERE deck_id = ? ORDER BY id')
  .all(deck.id)
  .map((r) => Number(r.id));
const srsOf = (id: number) =>
  getDb().prepare('SELECT card, due, reps, last_graded_day FROM srs WHERE item_id = ?').get(id);

test('arcade answers never change the FSRS schedule or introduce a card', () => {
  const t = new Date(2026, 10, 22, 10);
  const [known, unseen] = ids;
  recordAttempt({ sessionId: 's', itemId: known, format: 'intro', correct: true, responseMs: 1, xp: 0 }, getDb(), t);
  const before = srsOf(known);
  for (const format of ARCADE_FORMATS)
    for (const itemId of [known, unseen]) {
      const r = recordAttempt(
        { sessionId: 's', itemId, format, correct: true, responseMs: 900, xp: 3, genderOnly: format === 'gender' },
        getDb(),
        t,
      );
      assert.equal(r.grade, null, format);
    }
  assert.deepEqual(srsOf(known), before, 'schedule unchanged');
  assert.equal(srsOf(unseen), undefined, 'still a new card');
});

const arcade = (blitzSeconds: number) => {
  setMeta(getDb(), 'settings', { ...getSettings(), blitzSeconds });
  const plan = planSession('long', getDb(), new Date(2026, 10, 22, 10), deck.id);
  const of = (kind: string) => plan.blocks.find((b) => b.kind === kind) as { seconds: number } | undefined;
  return { sprint: of('gender')?.seconds, rain: of('rain')?.seconds, blitz: !!of('blitz') };
};

test('timers off: the sprint has no clock, and word rain and Blitz are left out', () => {
  assert.deepEqual(arcade(0), { sprint: 0, rain: undefined, blitz: false });
});

test('relaxed timers give longer rounds than challenge', () => {
  const relaxed = arcade(20);
  const challenge = arcade(5);
  assert.ok(relaxed.sprint! > challenge.sprint!, 'sprint');
  assert.equal(relaxed.rain, 90);
  assert.equal(challenge.rain, 45);
});
