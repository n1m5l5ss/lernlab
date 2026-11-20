// When the data process stops unexpectedly, main starts it again with backoff (#56): 0.5 s, 1 s, 2 s, 4 s, 8 s,
// then it gives up and the window says so. A process that ran for a while before crashing starts the count
// again, so one crash a day never adds up to giving up.

export const MAX_RESTARTS = 5;
export const BASE_DELAY_MS = 500;
/** Up at least this long before it stopped: count it as a fresh crash, not part of a crash loop. */
export const STABLE_MS = 30_000;

/**
 * The next restart after `crashes` crashes in a row and `upMs` of running time, or null to give up.
 * `crashes` in the result is the count to pass next time.
 */
export function planRestart(crashes: number, upMs: number): { delayMs: number; crashes: number } | null {
  const n = upMs >= STABLE_MS ? 0 : crashes;
  if (n >= MAX_RESTARTS) return null;
  return { delayMs: BASE_DELAY_MS * 2 ** n, crashes: n + 1 };
}
