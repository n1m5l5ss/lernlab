// The absolute budgets (docs/TESTING.md), run nightly on Windows, macOS and Linux by perf.yml:
//
//   tsx bench/budgets.ts [--out results.json]
//
// Runs every database benchmark (with 100,000-card imports) and, with a built app, 10 launches plus the
// 50-card session (bench/startup.ts). Writes a table to the job summary when there is one and exits with
// 1 if a P50 or P95 is over its budget.
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { budgetRows, markdownBudgets, type Measured } from './report';

const { values: args } = parseArgs({ options: { out: { type: 'string' }, 'no-startup': { type: 'boolean' } } });
const ROOT = join(import.meta.dirname, '..');
const bin = (name: string) => join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
const tmp = mkdtempSync(join(tmpdir(), 'lernlab-budgets-'));
const shell = process.platform === 'win32';

function run(cmd: string, argv: string[], env: Record<string, string> = {}) {
  const r = spawnSync(cmd, argv, {
    cwd: import.meta.dirname,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell,
  });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed`);
}

run(bin('tsx'), ['--no-warnings', 'fixtures.ts']);
run(bin('vitest'), ['bench', '--run'], { BENCH_OUT: join(tmp, 'db.json'), BENCH_FULL: '1' });
const measured: Measured[] = JSON.parse(readFileSync(join(tmp, 'db.json'), 'utf8'));
if (!args['no-startup']) {
  run(bin('tsx'), ['--no-warnings', 'startup.ts', '--launches', '10', '--session', '--out', join(tmp, 'startup.json')]);
  measured.push(...(JSON.parse(readFileSync(join(tmp, 'startup.json'), 'utf8')) as Measured[]));
}

const rows = budgetRows(measured);
const system = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform as string] ?? process.platform;
const md = markdownBudgets(rows, system);
console.log(`\n${md}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
if (args.out) writeFileSync(args.out, JSON.stringify(measured, null, 2));
if (rows.some((r) => !r.ok)) process.exitCode = 1;
