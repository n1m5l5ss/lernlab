// Visual and accessibility check of every Storybook story (issue #55; docs/TESTING.md, "A new button must
// not break other buttons"). Run `npm run test:visual` from the repo root: it builds Storybook, then for
// every story × light/dark × left-to-right/right-to-left it
//   - runs axe-core and fails on serious or critical problems;
//   - screenshots the default state, and hover and keyboard focus when the story has something to focus;
//   - compares each screenshot with visual/baselines/<name>.png.
// Fonts render differently on each system, so baselines are made and compared only in the pinned Linux
// Docker image used by .github/workflows/visual.yml. Elsewhere the comparison is skipped unless
// LERNLAB_VISUAL_COMPARE=1. LERNLAB_UPDATE_BASELINES=1 writes new baselines instead of comparing.
// Failures and new screenshots go to visual-results/ (actual, expected and diff images).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type Browser, type Locator, type Page } from 'playwright-core';
import { AxeBuilder } from '@axe-core/playwright';

const APP_DIR = join(import.meta.dirname, '..');
const STATIC = join(APP_DIR, 'storybook-static');
const BASELINES = join(import.meta.dirname, 'baselines');
const RESULTS = join(APP_DIR, 'visual-results');

const UPDATE = process.env.LERNLAB_UPDATE_BASELINES === '1';
/** Set in the Docker job; a laptop or a Windows/macOS runner draws fonts differently. */
const COMPARE = UPDATE || process.env.LERNLAB_VISUAL_COMPARE === '1';

const THEMES = ['light', 'dark'] as const;
const DIRS = ['ltr', 'rtl'] as const;
/** axe impacts that fail the run. Moderate and minor ones are printed only. */
const BLOCKING = new Set(['serious', 'critical']);
/** What a keyboard or pointer user can reach in a story. */
const INTERACTIVE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]';

type Comparator = (
  actual: Buffer,
  expected: Buffer,
  options: { threshold?: number; maxDiffPixels?: number },
) => { errorMessage: string; diff?: Buffer } | null | undefined;

// Playwright's own PNG comparator (what toHaveScreenshot uses). Not a public API, so playwright-core is
// pinned to an exact version in package.json.
const require = createRequire(import.meta.url);
const { utils } = require('playwright-core/lib/coreBundle') as {
  utils: { getComparator: (mime: string) => Comparator };
};
const comparePng = utils.getComparator('image/png');

type Entry = { id: string; title: string; name: string; type: string };

function stories(): Entry[] {
  if (!existsSync(join(STATIC, 'index.json'))) return [];
  const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8')) as { entries: Record<string, Entry> };
  return Object.values(index.entries).filter((e) => e.type === 'story');
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Serves storybook-static on a free localhost port. */
function serve(): Promise<Server> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
    const file = join(STATIC, path || 'index.html');
    if (!file.startsWith(STATIC) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function save(dir: string, name: string, png: Buffer) {
  mkdirSync(join(RESULTS, dir), { recursive: true });
  writeFileSync(join(RESULTS, dir, name), png);
}

/** Compares a screenshot with its baseline; returns a problem, or null when it matches. */
function check(name: string, png: Buffer): string | null {
  const file = join(BASELINES, `${name}.png`);
  if (UPDATE) {
    mkdirSync(BASELINES, { recursive: true });
    writeFileSync(file, png);
    return null;
  }
  save('actual', `${name}.png`, png);
  if (!COMPARE) return null;
  if (!existsSync(file)) return `${name}: no baseline (add the visual-change label to make one)`;
  const expected = readFileSync(file);
  const result = comparePng(png, expected, { threshold: 0.2, maxDiffPixels: 0 });
  if (!result) return null;
  save('expected', `${name}.png`, expected);
  if (result.diff) save('diff', `${name}.png`, result.diff);
  return `${name}: ${result.errorMessage}`;
}

async function shot(page: Page, root: Locator, name: string, problems: string[]) {
  await page.evaluate(() => document.fonts.ready);
  // The story's box plus a margin, so focus rings and shadows drawn outside it are in the picture.
  const box = await root.evaluate((el) => {
    const rects = [...el.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width && r.height);
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return rects.length ? { x: left, y: top, width: right - left, height: bottom - top } : null;
  });
  assert.ok(box, `${name}: the story drew nothing`);
  const m = 8;
  const clip = {
    x: Math.max(0, box.x - m),
    y: Math.max(0, box.y - m),
    width: box.width + 2 * m,
    height: box.height + 2 * m,
  };
  const problem = check(name, await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }));
  if (problem) problems.push(problem);
}

let server: Server;
let browser: Browser;
let base: string;

before(async () => {
  assert.ok(existsSync(join(STATIC, 'index.json')), 'build Storybook first: npm run build-storybook');
  server = await serve();
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // LERNLAB_CHROMIUM: a Chromium already on this computer, when Playwright's own build is not installed.
  browser = await chromium.launch({ executablePath: process.env.LERNLAB_CHROMIUM || undefined });
});

after(async () => {
  await browser?.close();
  server?.close();
});

describe('stories', () => {
  for (const story of stories()) {
    test(`${story.title} / ${story.name}`, async () => {
      const problems: string[] = [];
      for (const theme of THEMES) {
        for (const dir of DIRS) {
          // axe needs a page from its own context.
          const context = await browser.newContext({
            viewport: { width: 1024, height: 640 },
            deviceScaleFactor: 1,
            colorScheme: theme,
            reducedMotion: 'reduce',
          });
          const page = await context.newPage();
          try {
            await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme};dir:${dir}`);
            const root = page.locator('#storybook-root');
            await root.locator(':scope > *').first().waitFor();
            const name = `${story.id}--${theme}-${dir}`;

            const axe = await new AxeBuilder({ page }).include('#storybook-root').analyze();
            for (const v of axe.violations) {
              const line = `${name}: axe ${v.impact} ${v.id} (${v.nodes.length}×) ${v.helpUrl}`;
              if (BLOCKING.has(v.impact ?? '')) problems.push(line);
              else console.log(`note: ${line}`);
            }

            await shot(page, root, `${name}-default`, problems);
            const target = root.locator(INTERACTIVE).first();
            if ((await target.count()) > 0) {
              await target.hover();
              await shot(page, root, `${name}-hover`, problems);
              await page.mouse.move(0, 0);
              // Keyboard focus, so :focus-visible shows the ring a keyboard user sees.
              await page.keyboard.press('Tab');
              const inside = await root.evaluate((el) => el.contains(document.activeElement));
              if (!inside) await target.focus();
              await shot(page, root, `${name}-focus`, problems);
            }
          } finally {
            await context.close();
          }
        }
      }
      assert.deepEqual(problems, []);
    });
  }
});
