// The Windows first-open guide: why → choice → steps, and "No thanks" downloads nothing.
// It shares its logic with the Mac guide (first-open-guide.ts); this checks the Windows parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { guideFor, isMacDownload, isWindowsDownload } from './first-open-guide';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
const guide = html.slice(html.indexOf('id="win-guide"'), html.indexOf('<!-- /win-guide -->'));
const text = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

test('only the Windows installer goes through the Windows guide; Linux downloads start at once', () => {
  assert.equal(isWindowsDownload('windows'), true);
  for (const key of ['mac-arm64', 'mac-x64', 'linux-appimage', 'linux-deb', undefined]) {
    assert.equal(isWindowsDownload(key), false, String(key));
  }
  assert.equal(guideFor('windows')?.prefix, 'win');
  assert.equal(guideFor('mac-x64')?.prefix, 'mac');
  assert.equal(isMacDownload('windows'), false);
  assert.equal(guideFor('linux-deb'), undefined);
});

test('without JavaScript the Windows guide is a plain section: why and steps visible, the choice hidden', () => {
  assert.ok(guide.length > 500, 'the guide is on the page');
  assert.match(guide, /^id="win-guide"[^>]*tabindex="-1"[^>]*data-win-guide/);
  assert.match(guide, /<div class="os-why" data-win-why>/);
  assert.match(guide, /data-win-choice hidden/);
  assert.match(guide, /data-win-cancelled hidden/);
  assert.match(guide, /<div class="os-steps" data-win-steps>/);
  assert.match(guide, /data-win-steps-title[^>]*tabindex="-1"/);
  // The Windows card and the first-open note link to it; the download button still links to the file.
  assert.ok((html.match(/href="#win-guide"/g) ?? []).length >= 2);
  assert.match(html, /<a class="btn primary" data-download="windows" href="https:\/\//);
});

test('the Windows guide says why before the steps, offers both choices, and explains how to undo', () => {
  const words = text(guide);
  const why = words.indexOf('paid');
  assert.ok(why > 0 && why < words.indexOf('More info'), 'the reason comes before the steps');
  for (const phrase of [
    'free and open source',
    'SmartScreen',
    'Windows protected your PC',
    'same file',
    'GitHub',
    'SHA-256',
    'Continue',
    'No thanks',
    'Nothing was downloaded or installed',
    "isn't commonly downloaded",
    'Keep anyway',
    'More info',
    'Run anyway',
    'Unknown publisher',
    'Uninstall',
  ]) {
    assert.ok(words.includes(phrase), phrase);
  }
  assert.match(guide, /<button type="button" class="btn" data-win-cancel>/);
  assert.match(guide, /<a class="btn primary" data-win-continue href="https:\/\//);
});

test('each Windows picture exists, is small, has alt text, and uses only design-token colours', () => {
  const tokens = readFileSync(join(import.meta.dirname, '..', '..', '..', 'packages', 'ui', 'tokens.css'), 'utf8');
  const palette = new Set([...tokens.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toUpperCase()));
  const images = [...guide.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.length, 4);
  for (const img of images) {
    const src = /src="([^"]+)"/.exec(img)![1];
    assert.match(src, /^media\/win-open-/);
    assert.match(img, /alt="[^"]{30,}"/, `${src} has meaningful alt text`);
    const path = join(PUBLIC, src);
    assert.ok(existsSync(path), src);
    const svg = readFileSync(path, 'utf8');
    assert.ok(svg.length < 6000, `${src} is small`);
    assert.match(svg, /<title id="t">[^<]{20,}<\/title>/, `${src} has a title`);
    assert.match(svg, /prefers-color-scheme: dark/, `${src} follows dark mode`);
    assert.doesNotMatch(svg, /<script|href=|url\(|<image/, `${src} loads and runs nothing`);
    for (const colour of svg.match(/#[0-9a-f]{3,8}\b/gi) ?? []) {
      assert.ok(palette.has(colour.toUpperCase()), `${src}: ${colour} is not a design token`);
    }
  }
});

test('the page no longer says Windows is signed while it ships unsigned', () => {
  const visible = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(visible, /Free code signing provided by/);
  // The SignPath credit waits in a comment, ready for when signing is switched on.
  assert.match(html, /<!--[\s\S]*Free code signing provided by[\s\S]*SignPath Foundation[\s\S]*?-->/);
});
