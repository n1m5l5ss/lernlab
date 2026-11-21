// Database and core benchmarks (docs/TESTING.md, "Performance budgets"), run with `npm run bench`.
// They call the real core functions on the real node:sqlite host, against copies of the generated
// fixture databases (fixtures.ts), so a slower query or a missing index shows up here.
// With BENCH_OUT=<file>, the results (median and P95 in ms) are also written there as JSON (compare.ts).
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, test, type TestContext } from 'vitest';
import { fixtureFile, makeCsv, NOW, SIZES } from './fixtures';
import { percentile, type Measured } from './report';

process.env.LERNLAB_DATA = mkdtempSync(join(tmpdir(), 'lernlab-bench-'));
const storage = await import('@lernlab/storage-sqlite');
const { installNodeHost, openDb } = storage;
// The compare job runs this file against the base branch too, whose storage may not have it yet (#140).
const checkpointNow: () => void = (storage as { checkpointNow?: () => void }).checkpointNow ?? (() => {});
const hasCheckpoint = 'checkpointNow' in storage;
installNodeHost();
const { dueItemIds, recordAttempt } = await import('@lernlab/core/learn');
const { appState } = await import('@lernlab/core/progress');
const { importFile } = await import('@lernlab/core/importer');

const results: Measured[] = [];
afterAll(() => {
  process.stdout.write(
    `${results.map((r) => `${r.name.padEnd(20)} P50 ${r.p50.toFixed(3)} ms   P95 ${r.p95.toFixed(3)} ms`).join('\n')}\n`,
  );
  if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(results, null, 2));
});

/** Short, fixed runs: CI repeats the whole file several times and compares medians (compare.ts). */
const QUICK = { time: 400, warmupTime: 100 };

async function measure(
  { bench }: TestContext,
  name: string,
  fn: () => void,
  run: { time?: number; warmupTime?: number; iterations?: number; warmupIterations?: number } = QUICK,
  afterEach?: () => void,
) {
  const r = await bench(name, { retainSamples: true, afterEach }, fn).run(run);
  const samples = [...(r.latency.samples ?? [])];
  results.push({ name, p50: r.latency.p50, p95: percentile(samples, 95), n: samples.length });
}

/** For work that takes tens of milliseconds or more: a fixed number of runs. */
const SLOW = { time: 0, iterations: 10, warmupIterations: 1 };

const label = (size: number) => `${size / 1000}k`;

/** Each run works on its own copy, so writes never change the fixture. */
let copies = 0;
const open = (size: number) => {
  const copy = join(process.env.LERNLAB_DATA!, `cards-${size}-${copies++}.db`);
  copyFileSync(fixtureFile(size), copy);
  return openDb(copy);
};

for (const size of SIZES) {
  describe(`${label(size)} cards`, () => {
    const d = open(size);
    // Cards due now; each review below takes the next one, so every write grades a different card.
    const due = dueItemIds(d, NOW, 100_000);
    let next = 0;

    test('next cards due (due queue)', (ctx) => measure(ctx, `due-queue ${label(size)}`, () => dueItemIds(d, NOW, 50)));

    test('save a review (card update + log)', (ctx) =>
      measure(ctx, `review-write ${label(size)}`, () => {
        const itemId = due[next++ % due.length];
        recordAttempt({ sessionId: 'bench', itemId, format: 'typed', correct: true, responseMs: 2000, xp: 2 }, d, NOW);
      }));

    test('deck list and stats (state.get)', (ctx) =>
      measure(ctx, `deck-stats ${label(size)}`, () => appState(d, NOW), SLOW));

    // appState keeps the per-deck counts until the data changes; this is the first call after a change.
    let changes = 0;
    test('deck list and stats after a change', (ctx) =>
      measure(
        ctx,
        `deck-stats-changed ${label(size)}`,
        () => {
          d.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('bench', ?)").run(String(changes++));
          appState(d, NOW);
        },
        SLOW,
      ));
  });
}

describe('import', () => {
  const d = open(SIZES[0]);
  const csv = new TextEncoder().encode(makeCsv(10_000, 7, 'import'));
  let n = 0;
  // The app checkpoints soon after an import, outside it (#140). Do it between runs, as the app would,
  // and report how long it takes.
  const checkpoints: number[] = [];
  const checkpoint = () => {
    const t = performance.now();
    checkpointNow();
    checkpoints.push(performance.now() - t);
  };
  test('import 10,000 cards (CSV, no media)', async (ctx) => {
    await measure(
      ctx,
      'import 10k',
      () => importFile('Import.csv', csv, { deckName: `Import ${n++}` }, d),
      SLOW,
      checkpoint,
    );
    const [p50, p95] = [percentile(checkpoints, 50), percentile(checkpoints, 95)];
    if (hasCheckpoint) results.push({ name: 'import-checkpoint 10k', p50, p95, n: checkpoints.length });
  });

  // 100,000 cards take seconds each, so only the nightly run (BENCH_FULL=1) measures them.
  test.runIf(process.env.BENCH_FULL === '1')('import 100,000 cards (CSV, no media)', (ctx) => {
    const big = new TextEncoder().encode(makeCsv(100_000, 8, 'big'));
    return measure(
      ctx,
      'import 100k',
      () => importFile('Big.csv', big, { deckName: `Big ${n++}` }, d),
      { time: 0, iterations: 3, warmupIterations: 0 },
      checkpointNow,
    );
  });
});
