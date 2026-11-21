// Startup marks for the performance check (bench/startup.ts, docs/TESTING.md "Performance budgets").
// Test-only: with LERNLAB_PERF=1 the main process keeps the time of each mark (ms since the epoch) in
// `globalThis.__lernlabPerf`, where Playwright reads it. Without it, marking does nothing.

export type PerfMarks = Record<string, number>;
export const PERF_GLOBAL = '__lernlabPerf';

export function startupMarks(env: Record<string, string | undefined> = process.env): (name: string) => void {
  if (env.LERNLAB_PERF !== '1') return () => {};
  const marks: PerfMarks = {};
  (globalThis as Record<string, unknown>)[PERF_GLOBAL] = marks;
  return (name) => {
    marks[name] ??= performance.timeOrigin + performance.now();
  };
}
