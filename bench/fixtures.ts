// Fixture databases for the performance benchmarks (docs/TESTING.md, "Performance budgets"): 10,000 and
// 100,000 cards, built through the real importer and the real `introduce()`, then given a year of history.
// They are generated, never committed: `npm run bench:fixtures` writes bench/fixtures/generated/ (gitignored).
// A fixture is rebuilt when the schema (number of migrations) or GENERATOR_VERSION changes.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS } from '@lernlab/core/migrate';
import type { DB } from '@lernlab/core/db';

/** Bump when the generated data changes, so old fixtures are rebuilt. */
export const GENERATOR_VERSION = 1;
export const SIZES = [10_000, 100_000] as const;
export type Size = (typeof SIZES)[number];
/** Every benchmark runs "now" at this moment, so due counts are the same on every run and machine. */
export const NOW = new Date(2026, 5, 1, 12, 0, 0);
export const DECKS = 10;

export const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'generated');
export const fixtureFile = (size: number) =>
  join(FIXTURE_DIR, `cards-${size}-s${MIGRATIONS.length}-g${GENERATOR_VERSION}.db`);

/** A small seeded random generator: the same fixture on every machine. */
export function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const WORDS = 'alpha beta gamma delta river mountain cell orbit verb noun syntax market theorem atom'.split(' ');

/** `n` CSV rows (front, back, tags) with a header, unique fronts, no media. */
export function makeCsv(n: number, seed = 1, prefix = 'card'): string {
  const random = seeded(seed);
  const word = () => WORDS[Math.floor(random() * WORDS.length)];
  const rows = ['front,back,tags'];
  for (let i = 0; i < n; i++)
    rows.push(`${prefix} ${i} ${word()},${word()} ${word()} ${word()} ${i},${word()} t${i % 50}`);
  return rows.join('\n') + '\n';
}

const day = (base: Date, offset: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d;
};

/**
 * Build one fixture in a throw-away data folder and copy the database to `fixtureFile(size)`.
 * About 60% of the cards have been studied: due dates spread over ±60 days around NOW, three logged
 * attempts each, and a year of study days.
 */
export async function generate(size: number): Promise<string> {
  const work = mkdtempSync(join(tmpdir(), 'lernlab-fixture-'));
  process.env.LERNLAB_DATA = work;
  const { installNodeHost, openDb } = await import('@lernlab/storage-sqlite');
  installNodeHost();
  const { importFile } = await import('@lernlab/core/importer');
  const { introduce } = await import('@lernlab/core/learn');
  const { dayKey } = await import('@lernlab/core/game');
  const { tx } = await import('@lernlab/core/db');
  const file = join(work, 'fixture.db');
  const d: DB = openDb(file);
  const per = Math.ceil(size / DECKS);
  for (let k = 0; k < DECKS; k++) {
    const csv = makeCsv(Math.min(per, size - k * per), k + 1, `d${k}`);
    importFile(`Deck ${k + 1}.csv`, new TextEncoder().encode(csv), { deckName: `Deck ${k + 1}` }, d);
  }
  const random = seeded(size);
  const ids = d
    .prepare('SELECT id FROM items ORDER BY id')
    .all()
    .map((r) => Number(r.id));
  const setDue = d.prepare('UPDATE srs SET due = ?, reps = ?, lapses = ?, last_graded_day = ? WHERE item_id = ?');
  const setState = d.prepare('UPDATE item_state SET mastery = ?, seen = ?, right = ?, wrong = ? WHERE item_id = ?');
  const log = d.prepare(
    `INSERT INTO attempts(ts, day, session_id, item_id, format, correct, response_ms, xp, grade, practice)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  tx(d, () => {
    for (const id of ids) {
      if (random() > 0.6) continue;
      const introduced = day(NOW, -Math.floor(random() * 300) - 61);
      introduce(id, d, introduced);
      const reps = 1 + Math.floor(random() * 8);
      const wrong = Math.floor(random() * 3);
      const due = day(NOW, Math.floor(random() * 121) - 60);
      setDue.run(due.toISOString(), reps, wrong, dayKey(day(due, -3)), id);
      setState.run(Math.floor(random() * 6), reps + wrong, reps, wrong, id);
      for (let a = 0; a < 3; a++) {
        const at = day(introduced, a * 7);
        const correct = random() > 0.25 ? 1 : 0;
        log.run(at.toISOString(), dayKey(at), `s${dayKey(at)}`, id, 'typed', correct, 2500, 2, correct ? 3 : 1);
      }
    }
    const days = d.prepare(
      'INSERT OR REPLACE INTO days(day, xp, sessions, seconds, goal_met) VALUES (?, ?, 1, 600, 1)',
    );
    for (let i = 1; i <= 365; i++) days.run(dayKey(day(NOW, -i)), 40 + (i % 30));
  });
  d.exec('PRAGMA optimize');
  d.close();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const out = fixtureFile(size);
  copyFileSync(file, out);
  rmSync(work, { recursive: true, force: true });
  return out;
}

/** Generate the fixtures that are missing (all of them with --force). */
export async function ensureFixtures(force = false, sizes: readonly number[] = SIZES) {
  for (const size of sizes) {
    if (!force && existsSync(fixtureFile(size))) continue;
    const started = performance.now();
    const out = await generate(size);
    console.log(`fixture ${size} cards → ${out} (${Math.round(performance.now() - started)} ms)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await ensureFixtures(process.argv.includes('--force'));
