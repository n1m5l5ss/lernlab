// End-to-end helpers (issue #40): start the real Electron app with Playwright, read the English strings
// the screens show, play a session, take screenshots and run axe (issue #35). Run with `npm run test:e2e`.
// Each test gets a fresh, throw-away profile (--user-data-dir), so it never touches the user's own data.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { _electron, type ElectronApplication, type Page } from 'playwright-core';
import { AxeBuilder } from '@axe-core/playwright';
import en from '../../../locales/en.json';

const APP_DIR = join(import.meta.dirname, '..');
/** Screenshots and axe reports; CI keeps this folder as an artifact. */
export const RESULTS = join(APP_DIR, 'e2e-results');

export type App = { electron: ElectronApplication; page: Page; profile: string };

/** A new, empty profile folder (config.json and the data folder live inside it). */
export const freshProfile = () => mkdtempSync(join(tmpdir(), 'lernlab-e2e-'));

/**
 * Start LernLab on `profile`. By default this is the built app (`npm run build:electron`); set
 * LERNLAB_E2E_APP to an installed or unpacked LernLab executable to test a packaged build instead.
 */
export async function launch(profile = freshProfile()): Promise<App> {
  const args = [`--user-data-dir=${profile}`];
  // CI runners and containers allow neither Chromium's setuid sandbox nor user namespaces.
  if (process.platform === 'linux') args.unshift('--no-sandbox');
  const packaged = process.env.LERNLAB_E2E_APP;
  const electron = await _electron.launch(
    packaged
      ? { executablePath: packaged, args }
      : { args: [...args, join(APP_DIR, 'dist-electron', 'main.cjs')], cwd: APP_DIR },
  );
  const page = await electron.firstWindow();
  return { electron, page, profile };
}

export async function close(app: App, { keepProfile = false } = {}) {
  await app.electron.close();
  if (!keepProfile) rmSync(app.profile, { recursive: true, force: true });
}

type Messages = { [key: string]: unknown };

/**
 * The English text for a locales/en.json key, like i18next's t(): `_one`/`_other` plurals and {{values}}
 * (unformatted: keep numbers in tests below 1,000).
 */
export function t(key: string, values: Record<string, string | number> = {}): string {
  const lookup = (k: string) =>
    k.split('.').reduce<unknown>((m, part) => (m && typeof m === 'object' ? (m as Messages)[part] : undefined), en);
  const plural = typeof values.count === 'number' ? (values.count === 1 ? '_one' : '_other') : '';
  const text = (plural && lookup(key + plural)) || lookup(key);
  assert.equal(typeof text, 'string', `no string for ${key} in locales/en.json`);
  return (text as string).replace(/\{\{\s*(\w+)(?:,[^}]*)?\}\}/g, (_, name: string) => String(values[name] ?? ''));
}

/** Matches an element whose accessible name starts with this text (buttons often add a key hint after it). */
export const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

/** Go to a screen through the sidebar, as a user would. */
export async function nav(page: Page, route: 'home' | 'decks' | 'cards' | 'progress' | 'settings') {
  await page
    .getByRole('navigation', { name: t('nav.label') })
    .getByRole('link', { name: t(`nav.${route}`) })
    .click();
  await page.getByRole('heading', { level: 1, name: t(`pages.${route}`) }).waitFor();
}

export async function screenshot(page: Page, name: string) {
  mkdirSync(RESULTS, { recursive: true });
  await page.screenshot({ path: join(RESULTS, `${name}.png`) });
}

/**
 * axe rules switched off, each with the reason. Only for a rule that is wrong about this app;
 * a real problem is fixed in the screen instead.
 */
export const AXE_DISABLED: Record<string, string> = {};

/**
 * Run axe (WCAG 2.0–2.2 A and AA) on what is on screen now, in the light and the dark theme, and fail on
 * any serious or critical violation. The theme follows the system setting by default, so the test switches
 * the emulated system colour scheme.
 */
export async function checkA11y(page: Page, name: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    // Let colour transitions finish before axe measures contrast.
    await page.waitForTimeout(250);
    await screenshot(page, `${name}-${colorScheme}`);
    const result = await new AxeBuilder({ page })
      // Run inside the window itself: Electron can't open the blank page axe uses to merge iframe results,
      // and LernLab has no iframes.
      .setLegacyMode()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .disableRules(Object.keys(AXE_DISABLED))
      .analyze();
    const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const report = bad
      .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(' ')}`).join('\n')}`)
      .join('\n');
    assert.equal(bad.length, 0, `axe found serious or critical problems on ${name} (${colorScheme}):\n${report}`);
  }
  await page.emulateMedia({ colorScheme: null });
}

/** A small seeded random generator, so a session is played the same way on every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

/** Placeholders that only invite an answer. Any other placeholder in a typed exercise shows the answer to copy. */
const ASKING = new Set([t('ex.typed.placeholder'), t('games.rainPlaceholder'), '…', '']);

/**
 * Play the session on screen until its summary shows, like a learner who knows few answers: type a guess,
 * copy the answer when it is shown, press Continue, and pick options (pairs, articles, choices) at random.
 * Games on a clock simply run out. Calls `onBlock` once for each new block, with its title.
 */
export async function playSession(page: Page, onBlock: (title: string) => Promise<void> = async () => {}) {
  const random = seeded(40);
  const stage = page.locator('.stage');
  const summary = page.locator('.summary');
  const end = Date.now() + 240_000;
  let block = '';
  while (!(await summary.isVisible())) {
    assert.ok(Date.now() < end, `the session did not reach its summary (stuck in "${block}")`);
    const title =
      (await page
        .locator('.session-title')
        .textContent()
        .catch(() => null)) ?? '';
    if (title && title !== block) {
      block = title;
      await onBlock(title);
    }
    try {
      const input = stage.locator('input:not([type]):visible:enabled').first();
      if ((await input.count()) && !(await input.inputValue())) {
        const placeholder = (await input.getAttribute('placeholder')) ?? '';
        await input.fill(ASKING.has(placeholder) ? 'x' : placeholder);
        await input.press('Enter');
        continue;
      }
      const next = stage.locator('button.btn.primary:visible:enabled').first();
      if (await next.count()) {
        await next.click({ timeout: 1000 });
        continue;
      }
      const options = stage.locator('button:visible:enabled:not(.wrong):not(.right)');
      const n = await options.count();
      if (n) await options.nth(Math.floor(random() * n)).click({ timeout: 1000 });
      else await page.waitForTimeout(200); // a game on a clock, or the next exercise on its way
    } catch {
      // The screen moved on while we looked (an answer advanced by itself): look again.
    }
  }
}
