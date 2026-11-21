// Renderer startup marks (docs/TESTING.md "Performance budgets"): standard User Timing marks, set once.
// They stay inside the window; only the performance check (bench/startup.ts) reads them.

export const MARKS = { firstRender: 'lernlab:first-render', homeInteractive: 'lernlab:home-interactive' } as const;

export function markOnce(name: string) {
  if (!performance.getEntriesByName(name, 'mark').length) performance.mark(name);
}
