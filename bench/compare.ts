// Branch vs dev on the same machine (docs/TESTING.md, "How the checks run"), run by .github/workflows/perf.yml:
//
//   tsx bench/compare.ts --base <dev checkout> [--runs 5] [--launches 3] [--startup] [--md perf.md]
//
// This checkout is the branch. Both checkouts need `npm ci`; with --startup also `npm run build:electron`
// (and a screen: xvfb-run on Linux). This branch's benchmark code is copied into the dev checkout, so both
// run the same measurements on their own core, storage and app. The runs are interleaved (dev, branch,
// branch, dev, …) so a busy moment on the runner hits both. Each metric's median per run, then the median
// of the runs, is compared; the exit code is 1 when a regression is over the limit (report.ts LIMITS).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { compare, markdownCompare, type Measured } from './report';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string' },
    runs: { type: 'string', default: '5' },
    launches: { type: 'string', default: '3' },
    startup: { type: 'boolean', default: false },
    md: { type: 'string' },
  },
});
if (!args.base) throw new Error('--base <dev checkout> is required');

const HEAD = resolve(import.meta.dirname, '..');
const BASE = resolve(args.base);
const bin = (name: string) => join(HEAD, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
const tmp = mkdtempSync(join(tmpdir(), 'lernlab-compare-'));

function run(cmd: string, argv: string[], cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync(cmd, argv, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed in ${cwd}`);
}

// The dev checkout may not have vitest yet, so the config (and vitest) always come from this checkout.
const BENCH_FILES = ['fixtures.ts', 'db.bench.ts', 'report.ts'];
mkdirSync(join(BASE, 'bench'), { recursive: true });
for (const f of BENCH_FILES) cpSync(join(HEAD, 'bench', f), join(BASE, 'bench', f));
// Each checkout builds its fixtures with its own importer and schema.
for (const side of [BASE, HEAD]) run(bin('tsx'), ['--no-warnings', 'bench/fixtures.ts'], side);

type Series = Record<string, number[]>;
const series: { base: Series; head: Series } = { base: {}, head: {} };

function measure(which: 'base' | 'head', round: number) {
  const side = which === 'base' ? BASE : HEAD;
  const out = join(tmp, `${which}-${round}.json`);
  run(
    bin('vitest'),
    ['bench', '--run', '--config', join(HEAD, 'bench', 'vitest.config.ts'), '--root', join(side, 'bench')],
    join(side, 'bench'),
    { BENCH_OUT: out },
  );
  const measured: Measured[] = JSON.parse(readFileSync(out, 'utf8'));
  if (args.startup) {
    const sOut = join(tmp, `${which}-${round}-startup.json`);
    const extra = round === 0 ? ['--session'] : [];
    run(
      bin('tsx'),
      [
        '--no-warnings',
        join(HEAD, 'bench', 'startup.ts'),
        '--app',
        join(side, 'apps', 'desktop'),
        '--launches',
        args.launches!,
        '--out',
        sOut,
        ...extra,
      ],
      HEAD,
    );
    measured.push(...(JSON.parse(readFileSync(sOut, 'utf8')) as Measured[]));
  }
  for (const m of measured) (series[which][m.name] ??= []).push(m.p50);
}

const runs = Number(args.runs);
for (let round = 0; round < runs; round++) {
  const order: ('base' | 'head')[] = round % 2 ? ['head', 'base'] : ['base', 'head'];
  for (const which of order) {
    console.log(`\n=== run ${round + 1}/${runs}: ${which === 'base' ? 'dev' : 'branch'} ===`);
    measure(which, round);
  }
}

const rows = compare(series.base, series.head);
const md = markdownCompare(rows, { runs });
console.log(`\n${md}`);
if (args.md) writeFileSync(args.md, md);
writeFileSync(join(tmp, 'series.json'), JSON.stringify(series, null, 2));
if (rows.some((r) => r.status === 'fail')) process.exitCode = 1;
