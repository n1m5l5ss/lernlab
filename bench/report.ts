// Numbers and tables for the performance check (docs/TESTING.md, "Performance budgets"): medians and
// percentiles, the branch-vs-dev comparison with its limits, the absolute budgets, and the markdown that
// CI posts on the pull request (perf.yml) or writes to the nightly job summary.

/** One measured metric: median and P95 in milliseconds over `n` samples. */
export type Measured = { name: string; p50: number; p95: number; n: number };

export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile (p in 0–100). */
export function percentile(xs: readonly number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

export type Kind = 'db' | 'startup' | 'latency';
export const kindOf = (name: string): Kind =>
  name.startsWith('startup') ? 'startup' : name.startsWith('session') ? 'latency' : 'db';

/**
 * How much slower the branch may be than dev (median of the runs), and the smallest absolute change that
 * counts, so timer noise on a 20 µs query never fails a pull request. Latency is reported, not gated.
 */
export const LIMITS: Record<Kind, { pct: number; minMs: number } | null> = {
  db: { pct: 15, minMs: 0.05 },
  startup: { pct: 25, minMs: 30 },
  latency: null,
};

/** The locked budgets from docs/TESTING.md, in ms (long tasks: a count per block). */
export const BUDGETS: Record<string, { p50: number; p95: number; unit?: string }> = {
  'startup home': { p50: 1200, p95: 2000 },
  'session key-to-paint': { p50: 50, p95: 100 },
  'session long-tasks per block': { p50: 0, p95: 1, unit: '' },
  'due-queue 100k': { p50: 5, p95: 15 },
  'review-write 100k': { p50: 3, p95: 10 },
  'deck-stats 100k': { p50: 50, p95: 150 },
  'import 10k': { p50: 2000, p95: 4000 },
  'import 100k': { p50: 15000, p95: 25000 },
};

export type Status = 'ok' | 'fail' | 'faster' | 'new' | 'info';
export type CompareRow = { name: string; base: number; head: number; deltaPct: number; status: Status };

/** Branch (`head`) against dev (`base`): each metric's runs → their median → the change. */
export function compare(base: Record<string, number[]>, head: Record<string, number[]>): CompareRow[] {
  return Object.keys(head).map((name) => {
    const h = median(head[name]);
    const b = base[name]?.length ? median(base[name]) : NaN;
    const deltaPct = ((h - b) / b) * 100;
    const limit = LIMITS[kindOf(name)];
    let status: Status;
    if (Number.isNaN(b)) status = 'new';
    else if (!limit) status = 'info';
    else if (deltaPct > limit.pct && h - b >= limit.minMs) status = 'fail';
    else if (deltaPct < -limit.pct && b - h >= limit.minMs) status = 'faster';
    else status = 'ok';
    return { name, base: b, head: h, deltaPct, status };
  });
}

/** Hidden in the comment, so the workflow finds and updates its own comment instead of adding one. */
export const MARKER = '<!-- lernlab-perf -->';
const ICON: Record<Status, string> = { ok: '✅', fail: '❌', faster: '🚀', new: '🆕', info: 'ℹ️' };
const ms = (x: number, unit = 'ms') => (Number.isNaN(x) ? '–' : `${x.toFixed(2)}${unit ? ` ${unit}` : ''}`);
const pct = (x: number) => (Number.isFinite(x) ? `${x > 0 ? '+' : ''}${Math.round(x)}%` : '–');

export function markdownCompare(rows: CompareRow[], { runs }: { runs: number }): string {
  const failed = rows.filter((r) => r.status === 'fail');
  return [
    MARKER,
    '### Performance: this branch vs `dev`',
    '',
    `Same runner, ${runs} interleaved runs each, medians. Fails above +${LIMITS.db!.pct}% (database) or +${LIMITS.startup!.pct}% (startup). Latency is shown for information.`,
    '',
    '| Metric | dev | this branch | change | |',
    '|---|---|---|---|---|',
    ...rows.map((r) => {
      const unit = BUDGETS[r.name]?.unit;
      return `| ${r.name} | ${ms(r.base, unit)} | ${ms(r.head, unit)} | ${pct(r.deltaPct)} | ${ICON[r.status]} |`;
    }),
    '',
    failed.length
      ? `**${failed.length} regression${failed.length > 1 ? 's' : ''} over the limit:** ${failed.map((r) => r.name).join(', ')}.`
      : 'No regression over the limits.',
    '',
  ].join('\n');
}

export type BudgetRow = Measured & { budget: { p50: number; p95: number; unit?: string }; ok: boolean };

/** Each measured metric that has a budget, and whether both its P50 and P95 are within it. */
export function budgetRows(measured: Measured[]): BudgetRow[] {
  return measured
    .filter((m) => BUDGETS[m.name])
    .map((m) => {
      const budget = BUDGETS[m.name];
      return { ...m, budget, ok: m.p50 <= budget.p50 && m.p95 <= budget.p95 };
    });
}

export function markdownBudgets(rows: BudgetRow[], system: string): string {
  const cell = (x: number, limit: number, unit?: string) => `${ms(x, unit)} / ≤ ${limit}${unit === '' ? '' : ' ms'}`;
  return [
    `### Performance budgets (${system})`,
    '',
    '| Metric | P50 / budget | P95 / budget | |',
    '|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.name} | ${cell(r.p50, r.budget.p50, r.budget.unit)} | ${cell(r.p95, r.budget.p95, r.budget.unit)} | ${r.ok ? '✅' : '❌'} |`,
    ),
    '',
  ].join('\n');
}

/**
 * Long tasks in each study block. A block runs from its start to the next block's start or to the end of
 * its session (the summary showing), whichever is first, so the summary and Home screens between
 * sessions don't count against a block.
 */
export function longTasksPerBlock(probe: {
  blocks: readonly number[];
  ends: readonly number[];
  longTasks: readonly number[];
}): number[] {
  return probe.blocks.map((start, i) => {
    const next = probe.blocks[i + 1] ?? Infinity;
    const end = Math.min(next, probe.ends.find((e) => e > start) ?? Infinity);
    return probe.longTasks.filter((t) => t >= start && t < end).length;
  });
}
