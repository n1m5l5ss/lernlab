// The page itself: it loads nothing from other sites, and every download has a button and a file name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOWNLOAD_KEYS } from './downloads';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
const css = readFileSync(join(PUBLIC, 'site.css'), 'utf8');

test('the page loads nothing from another site (no fonts, CDNs, trackers or embeds)', () => {
  const loaded = [...html.matchAll(/<(?:script|img|source|link|video|iframe)\b[^>]*>/g)].flatMap((m) =>
    [...m[0].matchAll(/\b(?:src|href|srcset|poster)="([^"]*)"/g)].map((a) => a[1]),
  );
  assert.ok(loaded.length > 10);
  for (const url of loaded) assert.doesNotMatch(url, /^(https?:)?\/\//, `${url} comes from another site`);
  assert.doesNotMatch(css, /url\(|@import/, 'site.css loads nothing');
  assert.doesNotMatch(html, /<iframe|googleapis|googletagmanager|google-analytics|gtag\(|plausible|cdn\./i);
  // The browser enforces it too.
  assert.match(html, /Content-Security-Policy"\s+content="default-src 'none'; script-src 'self'/);
});

test('every local file the page uses exists', () => {
  const local = [...html.matchAll(/\b(?:src|href|srcset|poster)="([^"#:]+)"/g)].map((m) => m[1]);
  const built = new Set(['tokens.css', 'js/main.js']);
  for (const path of local) {
    if (built.has(path)) continue;
    assert.ok(existsSync(join(PUBLIC, path)), `${path} is missing from apps/site/public`);
  }
  assert.ok(existsSync(join(import.meta.dirname, 'main.ts')));
});

test('every system has its download button, file name and highlight target', () => {
  for (const key of DOWNLOAD_KEYS) {
    assert.match(html, new RegExp(`data-download="${key}"\\s+href=`), `button for ${key}`);
    assert.match(html, new RegExp(`data-file="${key}"`), `file name for ${key}`);
    assert.match(html, new RegExp(`data-option="${key}"`), `option for ${key}`);
  }
  for (const system of ['windows', 'mac', 'linux']) assert.match(html, new RegExp(`data-system-card="${system}"`));
  for (const system of ['mobile', 'other']) assert.match(html, new RegExp(`data-note="${system}" hidden`));
});

test('the main button has a label for each first choice', () => {
  for (const key of ['windows', 'mac-arm64', 'mac-x64', 'linux-appimage']) {
    assert.match(html, new RegExp(`data-label-${key}="Download for `));
  }
});

test('the privacy statement is on the page', () => {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const promise of ['No account.', 'No tracking and no analytics', 'No cookies.']) {
    assert.ok(text.includes(promise), promise);
  }
});

test('every image has alt text and size, and dark screenshots exist for each light one', () => {
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    assert.match(img, /\balt="/, img);
    assert.match(img, /\bwidth="\d+"\s+height="\d+"/, img);
  }
  const media = readdirSync(join(PUBLIC, 'media'));
  for (const file of media.filter((f) => f.endsWith('-light.webp'))) {
    assert.ok(media.includes(file.replace('-light', '-dark')), `${file} has no dark twin`);
  }
});

test('no raw colours in the stylesheet: design tokens only', () => {
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('the download page links the code signing policy', () => {
  // The SignPath credit (SignPath Foundation terms) comes back when Windows signing is switched on;
  // win-guide.test.ts checks it waits in a comment until then.
  assert.match(
    html,
    /href="https:\/\/github\.com\/n1m5l5ss\/lernlab\/blob\/main\/docs\/CODE_SIGNING\.md">Code signing policy</,
  );
});
