// Anki review history (#48): the revlog in an .apkg/.colpkg is replayed into FSRS, so cards keep their schedule.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-ankihist-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost, openRaw } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { previewFile } = await import('../src/importpreview');
const { reviewsFromRevlog, replayReviews } = await import('../src/ankihistory');
const { getDb } = await import('../src/db');
const { dueItemIds, introduce } = await import('../src/learn');
const { dayKey } = await import('../src/game');
after(() => cleanupTempDir(dir));

const DAY = 86_400_000;
/** Noon, local time, `n` days before a fixed date: far from the 4 a.m. day boundary. */
const at = (n: number, hour = 12) => new Date(2026, 5, 1 - n, hour).getTime();

type Rev = { cid: number; time: number; ease: number; type?: number; ivl?: number; factor?: number };

/** A legacy Anki collection with notes, cards (note 1 has a second, reverse card) and a revlog, zipped as an .apkg. */
function collection(revlog: Rev[], ext = 'anki2'): Uint8Array {
  const file = join(dir, `col-${Math.random()}.db`);
  const db = openRaw(file);
  db.exec(`CREATE TABLE col (models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);
    CREATE TABLE revlog (id INTEGER PRIMARY KEY, cid INTEGER, usn INTEGER, ease INTEGER, ivl INTEGER,
      lastIvl INTEGER, factor INTEGER, time INTEGER, type INTEGER);`);
  db.prepare('INSERT INTO col VALUES (?, ?)').run(
    JSON.stringify({
      7: {
        id: 7,
        flds: [
          { name: 'Front', ord: 0 },
          { name: 'Back', ord: 1 },
        ],
      },
    }),
    JSON.stringify({ 5: { id: 5, name: 'Capitals' } }),
  );
  const note = db.prepare('INSERT INTO notes VALUES (?, 7, ?, ?)');
  note.run(101, '', 'France\x1fParis');
  note.run(102, '', 'Spain\x1fMadrid');
  note.run(103, '', 'Italy\x1fRome');
  // Card 11 is note 101's reverse card (ord 1): its reviews are not the note's.
  db.exec('INSERT INTO cards VALUES (10, 101, 5, 0), (11, 101, 5, 1), (20, 102, 5, 0), (30, 103, 5, 0)');
  const ins = db.prepare('INSERT INTO revlog VALUES (?, ?, 0, ?, ?, 0, ?, 5000, ?)');
  for (const r of revlog) ins.run(r.time, r.cid, r.ease, r.ivl ?? 1, r.factor ?? 2500, r.type ?? 1);
  db.close();
  return zipSync({ [`collection.${ext}`]: new Uint8Array(readFileSync(file)) });
}

test('reviewsFromRevlog keeps real answers, first of each day, and skips manual, rescheduled and cram entries', () => {
  const rows = [
    { time: at(10), ease: 3, type: 0, ivl: 0, factor: 0 },
    { time: at(10, 13), ease: 1, type: 0, ivl: 0, factor: 0 }, // same day: dropped
    { time: at(8), ease: 0, type: 4, ivl: 30, factor: 2500 }, // set due date: skipped
    { time: at(7), ease: 2, type: 3, ivl: 0, factor: 0 }, // cram without rescheduling: skipped
    { time: at(6), ease: 4, type: 3, ivl: 5, factor: 2500 }, // filtered deck that reschedules: kept
    { time: at(5), ease: 3, type: 5, ivl: 9, factor: 2500 }, // rescheduled by Anki: skipped
    { time: at(4), ease: 3, type: 1, ivl: 9, factor: 2500 },
    { time: at(3), ease: 7, type: 1, ivl: 9, factor: 2500 }, // not a button: skipped
  ];
  assert.deepEqual(
    reviewsFromRevlog(rows).map((r) => [dayKey(new Date(r.time)), r.grade]),
    [
      [dayKey(new Date(at(10))), 3],
      [dayKey(new Date(at(6))), 4],
      [dayKey(new Date(at(4))), 3],
    ],
  );
  // "Forget" (a manual reset to new) wipes the history before it.
  const forgot = reviewsFromRevlog([...rows, { time: at(2), ease: 0, type: 4, ivl: 0, factor: 0 }]);
  assert.deepEqual(forgot, []);
});

test('replaying never gives NaN, and each next due date is after the review (property test)', () => {
  let seed = 48;
  const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  for (let run = 0; run < 300; run++) {
    const rows = [];
    let t = at(400) + Math.floor(rand() * DAY);
    for (let i = 0, n = 1 + Math.floor(rand() * 25); i < n; i++) {
      t += Math.floor(rand() * 40 * DAY) + (rand() < 0.2 ? 60_000 : 0);
      rows.push({ time: t, ease: Math.floor(rand() * 6), type: Math.floor(rand() * 6), ivl: 1, factor: 2500 });
    }
    const reviews = reviewsFromRevlog(rows);
    if (!reviews.length) continue;
    const res = replayReviews(reviews, 0.9);
    for (const step of res.steps) {
      assert.ok(Number.isFinite(step.card.stability) && step.card.stability > 0, `stability in run ${run}`);
      assert.ok(Number.isFinite(step.card.difficulty), `difficulty in run ${run}`);
      assert.ok(step.card.due.getTime() > step.time, `due after the review in run ${run}`);
    }
    assert.equal(res.card.reps, reviews.length);
  }
});

test('an .apkg with review history: cards get FSRS state and a review log, once per card per day', () => {
  const pkg = collection([
    { cid: 10, time: at(30), ease: 3, type: 0 },
    { cid: 10, time: at(30, 15), ease: 1, type: 0 }, // same day: only the first counts
    { cid: 10, time: at(27), ease: 3 },
    { cid: 10, time: at(20), ease: 4 },
    { cid: 11, time: at(25), ease: 1 }, // the reverse card
    { cid: 20, time: at(15), ease: 1 },
    { cid: 20, time: at(14), ease: 3 },
    { cid: 20, time: at(13), ease: 0, type: 4, ivl: 40 }, // set due date: skipped
  ]);
  const preview = previewFile('capitals.apkg', pkg);
  assert.equal(preview.ankiReviews, 5);

  const r = importFile('capitals.apkg', pkg, { deckName: 'Capitals' });
  assert.equal(r.added, 3);
  assert.equal(r.reviews, 5);
  const d = getDb();
  const srs = (id: number) => d.prepare('SELECT * FROM srs WHERE item_id = ?').get(id)!;
  const france = srs(101);
  assert.equal(france.reps, 3);
  assert.equal(france.lapses, 0);
  assert.equal(france.last_graded_day, dayKey(new Date(at(20))));
  assert.equal(france.introduced_day, dayKey(new Date(at(30))));
  const card = JSON.parse(france.card as string);
  assert.ok(card.stability > 0 && card.difficulty > 0);
  assert.equal(france.due, card.due);
  assert.ok(new Date(card.due as string).getTime() > at(20));
  assert.equal(srs(102).lapses, 1);
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM srs WHERE item_id = 103').get()!.n, 0, 'no history: new card');
  const log = d.prepare('SELECT item_id, grade, day FROM imported_reviews ORDER BY ts').all();
  assert.deepEqual(
    log.map((x) => [x.item_id, x.grade]),
    [
      [101, 3],
      [101, 3],
      [101, 4],
      [102, 1],
      [102, 3],
    ],
  );
  // Due cards from the history come up for review; real attempts and XP are untouched.
  assert.ok(dueItemIds(d, new Date(at(-400))).includes(101));
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM attempts').get()!.n, 0);

  // Importing again keeps LernLab's own progress and does not log the reviews twice.
  const again = importFile('capitals.apkg', pkg, { deckName: 'Capitals' });
  assert.equal(again.reviews, 0);
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM imported_reviews').get()!.n, 5);
});

test('the history can be left out, and cards already studied in LernLab keep their progress', () => {
  const pkg = collection([{ cid: 10, time: at(9), ease: 3, type: 1 }], 'anki21');
  const d = getDb();
  d.exec('DELETE FROM srs; DELETE FROM imported_reviews;');
  const off = importFile('off.apkg', pkg, { deckName: 'No history', ankiHistory: false });
  assert.equal(off.reviews, 0);
  assert.equal(off.format, 'apkg');
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM srs').get()!.n, 0);

  introduce(101, d, new Date(at(1)));
  d.prepare('UPDATE srs SET reps = 2 WHERE item_id = 101').run();
  const kept = importFile('kept.apkg', pkg, { deckName: 'No history' });
  assert.equal(kept.reviews, 0);
  assert.equal(d.prepare('SELECT reps FROM srs WHERE item_id = 101').get()!.reps, 2);
});

test('a package without a revlog imports as before', () => {
  const file = join(dir, 'norev.db');
  const db = openRaw(file);
  db.exec(`CREATE TABLE col (models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);
    INSERT INTO col VALUES ('{}', '{}'); INSERT INTO notes VALUES (900, 1, '', 'a' || char(31) || 'b');
    INSERT INTO cards VALUES (1, 900, 1, 0);`);
  db.close();
  const pkg = zipSync({ 'collection.anki2': new Uint8Array(readFileSync(file)) });
  assert.equal(previewFile('n.apkg', pkg).ankiReviews, 0);
  assert.equal(importFile('n.apkg', pkg, { deckName: 'Plain' }).reviews, 0);
});

test('10,000 cards with 100,000 reviews import in one go, quickly', () => {
  const file = join(dir, 'big.db');
  const db = openRaw(file);
  db.exec(`CREATE TABLE col (models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER);
    CREATE TABLE revlog (id INTEGER PRIMARY KEY, cid INTEGER, usn INTEGER, ease INTEGER, ivl INTEGER,
      lastIvl INTEGER, factor INTEGER, time INTEGER, type INTEGER);
    INSERT INTO col VALUES ('{}', '{}'); BEGIN;`);
  const note = db.prepare("INSERT INTO notes VALUES (?, 1, '', ?)");
  const card = db.prepare('INSERT INTO cards VALUES (?, ?, 1, 0)');
  const rev = db.prepare('INSERT INTO revlog VALUES (?, ?, 0, ?, 1, 0, 2500, 5000, 1)');
  for (let n = 0; n < 10_000; n++) {
    note.run(500_000 + n, `word ${n}\x1fmeaning ${n}`);
    card.run(900_000 + n, 500_000 + n);
    for (let k = 0; k < 10; k++) rev.run(at(300 - k * 25) + n, 900_000 + n, 1 + ((n + k) % 4));
  }
  db.exec('COMMIT');
  db.close();
  const pkg = zipSync({ 'collection.anki2': new Uint8Array(readFileSync(file)) });
  const start = performance.now();
  const r = importFile('big.apkg', pkg, { deckName: 'Big' });
  const ms = performance.now() - start;
  assert.equal(r.reviews, 100_000);
  // About 1.5 s on a laptop (cards alone: about 0.7 s). The bound is loose so slow CI runners don't flake;
  // the locked budgets are checked by `npm run bench:budgets`.
  assert.ok(ms < 8000, `took ${Math.round(ms)} ms`);
});
