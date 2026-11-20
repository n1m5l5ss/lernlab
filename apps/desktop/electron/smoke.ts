// Installer smoke test (.github/workflows/release.yml): `LernLab --smoke-test` starts the installed app
// with a fresh, throw-away data folder, skips the welcome, waits until Home is on screen, prints the
// result and quits (exit code 0 = Home shown). It never touches the user's own data.

export const SMOKE_FLAG = '--smoke-test';
export const SMOKE_OK = 'LERNLAB_SMOKE_OK';
export const SMOKE_FAIL = 'LERNLAB_SMOKE_FAIL';

/** Home's main panel: only rendered once the data process answered and the welcome is done. */
export const HOME_SELECTOR = '.home .home-session';

export const isSmokeTest = (argv: readonly string[]) => argv.includes(SMOKE_FLAG);

/** Poll `check` until it returns true (→ true) or the time is up (→ false). Errors count as "not yet". */
export async function waitFor(
  check: () => Promise<boolean>,
  { timeoutMs, intervalMs }: { timeoutMs: number; intervalMs: number },
): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await check()) return true;
    } catch {
      // Page still loading: try again.
    }
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
