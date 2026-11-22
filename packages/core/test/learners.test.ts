// Other learners on this computer (#224): each has their own progress database beside the app's; the cards
// are shared read-only. The app database is never written by a learner's study.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-learners-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost, checkpointNow } = await import('@lernlab/storage-sqlite');
installNodeHost();
const learners = await import('@lernlab/storage-sqlite/learners');
const backups = await import('@lernlab/storage-sqlite/backups');
const { createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { recordAttempt, dueItemIds } = await import('../src/learn');
const { finishSession } = await import('../src/progress');
const { getDb } = await import('../src/db');
after(() => {
  learners.closeLearners();
  cleanupTempDir(dir);
});

const deck = createDeck('Capitals', null, {}, '');
upsertCards(
  deck,
  Array.from({ length: 12 }, (_, i) => ({ front: `Country ${i}`, back: `Capital ${i}` })),
);
const n = (sql: string, d = getDb()) => Number(d.prepare(sql).get()!.n);
const firstItem = () => Number(getDb().prepare('SELECT id FROM items ORDER BY ord, id LIMIT 1').get()!.id);
const attempt = (itemId: number, format: 'intro' | 'typed', sessionId = 's1') =>
  ({ sessionId, itemId, format, correct: true, responseMs: 800, xp: 2 }) as const;

test('nothing exists until someone is added; names are plain text, unique and capped', () => {
  assert.deepEqual(learners.listLearners(), []);
  assert.ok(!existsSync(join(dir, 'learners')), 'unused: no folder, no file');
  const ben = learners.addLearner('  <b>Ben</b>\n ');
  assert.equal(ben.name, 'Ben');
  assert.throws(() => learners.addLearner('ben'), /already/);
  assert.throws(() => learners.addLearner(' <i></i> '), /Name required/);
  assert.equal(learners.addLearner('x'.repeat(200)).name.length, learners.LEARNER_NAME_MAX);
  for (const name of ['C', 'D', 'E']) learners.addLearner(name);
  assert.throws(() => learners.addLearner('F'), /At most/);
  assert.equal(learners.listLearners().length, learners.LEARNERS_MAX);
  for (const l of learners.listLearners().slice(1)) learners.removeLearner(l.id);
  assert.deepEqual(
    learners.listLearners().map((l) => l.name),
    ['Ben'],
  );
  assert.throws(() => learners.asLearner('../../lernlab', () => 1), /no longer/);
  assert.throws(() => learners.asLearner('00000000-0000-4000-8000-000000000000', () => 1), /no longer/);
});

test("a learner's recall goes to their own schedule; the app database is not written at all", () => {
  const [ben] = learners.listLearners();
  checkpointNow();
  getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const hash = () =>
    createHash('sha256')
      .update(readFileSync(join(dir, 'lernlab.db')))
      .digest('hex');
  const before = hash();
  const id = firstItem();

  const plan = learners.asLearner(ben.id, () => planSession('mini', getDb(), new Date(), deck.id, {}), true);
  assert.ok(plan.blocks.length > 0);
  assert.equal(plan.deckName, 'Capitals');
  learners.asLearner(ben.id, () => recordAttempt(attempt(id, 'intro')));
  learners.asLearner(ben.id, () => recordAttempt(attempt(id, 'typed')));
  learners.asLearner(ben.id, () =>
    finishSession({
      sessionId: 's1',
      length: 'mini',
      seconds: 60,
      answers: 1,
      correct: 1,
      bossWon: null,
      bestGenderCombo: 0,
      perfectBlocks: 0,
      startedAt: new Date().toISOString(),
    }),
  );
  const benDb = learners.learnerDb(ben.id);
  assert.equal(n('SELECT COUNT(*) AS n FROM srs', benDb), 1);
  assert.equal(n('SELECT COUNT(*) AS n FROM attempts', benDb), 2);
  assert.equal(n('SELECT COUNT(*) AS n FROM sessions', benDb), 1);
  assert.ok(readdirSync(join(dir, 'learners', ben.id, 'progress')).length > 0, 'their own daily summary');
  assert.ok(!existsSync(join(dir, 'progress')), "not the owner's");

  // The owner's side: no schedule, no answers, and not one byte of the file changed.
  assert.equal(n('SELECT COUNT(*) AS n FROM srs'), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM attempts'), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM sessions'), 0);
  getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)');
  assert.equal(hash(), before);
  assert.throws(() => benDb.exec('UPDATE items SET suspended = 1'), /view/);
  assert.throws(() => benDb.exec('DELETE FROM decks'), /view/);

  // And the other way round: the owner's recall of the same card leaves Ben's schedule alone.
  const benCard = JSON.stringify(benDb.prepare('SELECT * FROM srs').get());
  recordAttempt(attempt(id, 'intro', 'own'));
  assert.equal(n('SELECT COUNT(*) AS n FROM srs'), 1);
  assert.equal(JSON.stringify(benDb.prepare('SELECT * FROM srs').get()), benCard);
  assert.equal(n('SELECT COUNT(*) AS n FROM attempts', benDb), 2);
});

test('once per card per day for each learner; a nested or asynchronous request is refused', () => {
  const [ben] = learners.listLearners();
  const id = firstItem();
  const benDb = learners.learnerDb(ben.id);
  const graded = () => String(benDb.prepare('SELECT last_graded_day AS n FROM srs WHERE item_id = ?').get(id)!.n);
  const reps = () => n('SELECT reps AS n FROM srs', benDb);
  const before = [graded(), reps()];
  learners.asLearner(ben.id, () => recordAttempt(attempt(id, 'typed')));
  assert.deepEqual([graded(), reps()], before, 'a second recall the same day does not grade again');
  assert.throws(() => learners.asLearner(ben.id, () => learners.asLearner(ben.id, () => 1)), /Already acting/);
  assert.throws(() => learners.asLearner(ben.id, () => Promise.resolve(1)), /asynchronous/);
  assert.equal(dueItemIds().length >= 0, true, 'the app database is back in use');
  assert.equal(n('SELECT COUNT(*) AS n FROM attempts'), 1);
});

test("new cards the owner adds show up for the learner; a hand-edited list can't name other folders", () => {
  const [ben] = learners.listLearners();
  upsertCards(deck, [{ front: 'Atlantis', back: 'Poseidonis' }]);
  const seen = learners.asLearner(ben.id, () => n("SELECT COUNT(*) AS n FROM items WHERE target = 'Atlantis'"), true);
  assert.equal(seen, 1);
  const file = join(dir, 'learners', 'learners.json');
  const good = readFileSync(file, 'utf8');
  writeFileSync(
    file,
    JSON.stringify([{ id: '../..', name: 'Evil' }, { id: ben.id, name: '<script>x</script>Ben' }, 7]),
  );
  assert.deepEqual(learners.listLearners(), [{ id: ben.id, name: 'Ben', createdAt: '' }]);
  writeFileSync(file, 'not json');
  assert.deepEqual(learners.listLearners(), []);
  writeFileSync(file, good);
});

test('daily backups cover each learner; restoring the owner keeps the learner; removing and delete-all remove them', () => {
  const [ben] = learners.listLearners();
  const day = new Date(2027, 0, 5, 9);
  assert.equal(learners.dailyLearnerBackups(day), 1);
  assert.equal(learners.dailyLearnerBackups(day), 0, 'one a day');
  const kept = readdirSync(join(dir, 'learners', ben.id, 'backups'));
  assert.ok(
    kept.some((f) => /^lernlab-20270105-daily-v\d+\.db$/.test(f)),
    kept.join(),
  );
  for (let i = 1; i <= 9; i++) learners.dailyLearnerBackups(new Date(2027, 0, 5 + i, 9));
  assert.equal(readdirSync(join(dir, 'learners', ben.id, 'backups')).filter((f) => f.includes('-daily-')).length, 7);

  // The owner restores a backup: the app file is swapped while Ben's connection had it attached.
  const name = backups.dailyBackup(day)!;
  backups.restoreBackup(name);
  assert.equal(
    learners.asLearner(ben.id, () => n('SELECT COUNT(*) AS n FROM srs')),
    1,
    "Ben's progress is untouched",
  );
  assert.equal(
    learners.asLearner(ben.id, () => n('SELECT COUNT(*) AS n FROM items')),
    13,
  );

  const cara = learners.addLearner('Cara');
  mkdirSync(join(dir, 'learners', cara.id), { recursive: true });
  learners.removeLearner(cara.id);
  assert.ok(!existsSync(join(dir, 'learners', cara.id)));
  assert.ok(existsSync(join(dir, 'learners', ben.id, 'lernlab.db')));

  backups.deleteAllData();
  assert.ok(!existsSync(join(dir, 'learners')), 'delete all my data covers the other learners too');
  assert.deepEqual(learners.listLearners(), []);
});
