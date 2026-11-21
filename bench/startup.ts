// Startup and interaction latency of the real Electron app (docs/TESTING.md, "Performance budgets").
//
//   npm run startup --workspace bench -- [--app <apps/desktop folder>] [--launches 10] [--session] [--out file.json]
//
// Needs a built app (`npm run build:electron`); on Linux without a screen, run it under `xvfb-run -a`.
// 1. Sets up one profile (welcome → sample deck), then launches the app `--launches` times and measures
//    launch → Home on screen. With LERNLAB_PERF=1 the app also reports its own marks (app ready,
//    ready-to-show, first render, Home interactive: electron/perf.ts, src/perf.ts).
// 2. With --session, plays sessions until 50 cards have been answered and measures every key press or
//    click → the next frame painted, and the long tasks (> 50 ms) in each block.
// It prints the median and P95 of each metric and writes them with --out (a Measured[] JSON, report.ts).
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { rmSync } from 'node:fs';
import { _electron, type ElectronApplication, type Page } from 'playwright-core';
import { freshProfile, playSession, startsWith, t } from '../apps/desktop/e2e/app';
import { median, percentile, type Measured } from './report';

const { values: args } = parseArgs({
  options: {
    app: { type: 'string', default: join(import.meta.dirname, '..', 'apps', 'desktop') },
    launches: { type: 'string', default: '10' },
    session: { type: 'boolean', default: false },
    cards: { type: 'string', default: '50' },
    out: { type: 'string' },
  },
});
const APP_DIR = resolve(args.app!);
const HOME = '.home .home-session';

async function launch(profile: string): Promise<{ electron: ElectronApplication; page: Page }> {
  const flags = [`--user-data-dir=${profile}`];
  if (process.platform === 'linux') flags.unshift('--no-sandbox');
  const electron = await _electron.launch({
    args: [...flags, join(APP_DIR, 'dist-electron', 'main.cjs')],
    cwd: APP_DIR,
    env: { ...process.env, LERNLAB_PERF: '1' } as Record<string, string>,
  });
  return { electron, page: await electron.firstWindow() };
}

/** Wall-clock time (ms since the epoch) at which Home is on screen, read in the window itself. */
const homeShownAt = (page: Page) =>
  page
    .waitForFunction((sel) => (document.querySelector(sel) ? performance.timeOrigin + performance.now() : 0), HOME, {
      polling: 'raf',
      timeout: 60_000,
    })
    .then((h) => h.jsonValue());

/** The app's own marks, when this version has them: main process (electron/perf.ts) and window (src/perf.ts). */
async function appMarks(electron: ElectronApplication, page: Page): Promise<Record<string, number>> {
  const main = await electron.evaluate(() => (globalThis as Record<string, unknown>).__lernlabPerf ?? {});
  const win = await page.evaluate(() =>
    Object.fromEntries(
      performance
        .getEntriesByType('mark')
        .filter((m) => m.name.startsWith('lernlab:'))
        .map((m) => [m.name.slice('lernlab:'.length), performance.timeOrigin + m.startTime]),
    ),
  );
  return { ...(main as Record<string, number>), ...win };
}

const results: Measured[] = [];
const add = (name: string, xs: number[]) =>
  xs.length && results.push({ name, p50: median(xs), p95: percentile(xs, 95), n: xs.length });

async function startup(profile: string, launches: number) {
  // First start: welcome → sample deck → Home. Not measured: it creates the database and the profile.
  let app = await launch(profile);
  const welcome = app.page.getByRole('button', { name: t('welcome.continue') });
  await Promise.race([welcome.waitFor(), app.page.waitForSelector(HOME)]);
  if (await welcome.isVisible()) await welcome.click();
  await app.page.waitForSelector(HOME);
  await app.electron.close();

  const series: Record<string, number[]> = {};
  for (let i = 0; i < launches; i++) {
    const t0 = Date.now();
    app = await launch(profile);
    const shown = await homeShownAt(app.page);
    (series['startup home'] ??= []).push(shown - t0);
    for (const [name, at] of Object.entries(await appMarks(app.electron, app.page)))
      (series[`startup ${name}`] ??= []).push(at - t0);
    await app.electron.close();
  }
  for (const [name, xs] of Object.entries(series)) add(name, xs);
}

/**
 * Injected into the window: key press / click → next frame painted, and long tasks. A string, because
 * tsx would add helpers to a function that don't exist in the page.
 */
const PROBE = `(() => {
  const probe = { samples: [], longTasks: [], blocks: [] };
  window.__probe = probe;
  const measure = (e) => {
    const start = e.timeStamp;
    // rAF runs just before the frame is painted; a task queued from it runs just after.
    requestAnimationFrame(() => setTimeout(() => probe.samples.push(performance.now() - start)));
  };
  addEventListener('keydown', measure, true);
  addEventListener('pointerdown', measure, true);
  new PerformanceObserver((list) => list.getEntries().forEach((e) => probe.longTasks.push(e.startTime)))
    .observe({ type: 'longtask' });
})()`;

type Probe = { samples: number[]; longTasks: number[]; blocks: number[] };

async function session(profile: string, cards: number) {
  const { electron, page } = await launch(profile);
  try {
    await page.waitForSelector(HOME);
    await page.evaluate(PROBE);
    const read = () => page.evaluate(() => (window as unknown as { __probe: Probe }).__probe);
    for (let round = 0; round < 4 && (await read()).samples.length < cards; round++) {
      await page.getByRole('button', { name: startsWith(t('home.startStudying')) }).click();
      await playSession(page, async () => {
        await page.evaluate(() => (window as unknown as { __probe: Probe }).__probe.blocks.push(performance.now()));
      });
      await page.getByRole('button', { name: startsWith(t('summary.done')) }).click();
      await page.waitForSelector(HOME);
    }
    const probe = await read();
    add('session key-to-paint', probe.samples);
    // Long tasks in each block (a block runs from its start to the next one).
    const edges = [...probe.blocks, Infinity];
    const perBlock = probe.blocks.map((b, i) => probe.longTasks.filter((t) => t >= b && t < edges[i + 1]).length);
    add('session long-tasks per block', perBlock);
  } finally {
    await electron.close();
  }
}

const profile = freshProfile();
try {
  await startup(profile, Number(args.launches));
  if (args.session) await session(profile, Number(args.cards));
} finally {
  rmSync(profile, { recursive: true, force: true });
}
for (const r of results)
  console.log(
    `${r.name.padEnd(30)} P50 ${r.p50.toFixed(1).padStart(8)}   P95 ${r.p95.toFixed(1).padStart(8)}   n=${r.n}`,
  );
if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2));
