// The Mac first-open guide (#39): why → choice → steps, and "No thanks" downloads nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { guideView, isMacDownload } from './first-open-guide';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
const guide = html.slice(html.indexOf('id="mac-guide"'), html.indexOf('<!-- /mac-guide -->'));
const text = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

test('a Mac download first explains why and asks; nothing else shows yet', () => {
  assert.deepEqual(guideView('ask'), {
    guide: true,
    why: true,
    choice: true,
    steps: false,
    cancelled: false,
    focus: 'guide',
  });
});

test('"Continue" shows the steps and moves focus to them', () => {
  const view = guideView('steps');
  assert.equal(view.choice, false);
  assert.equal(view.steps, true);
  assert.equal(view.focus, 'steps');
});

test('"No thanks" closes the guide and says nothing was downloaded', () => {
  const view = guideView('cancelled');
  assert.deepEqual([view.why, view.choice, view.steps, view.cancelled], [false, false, false, true]);
  assert.equal(view.focus, 'cancelled');
  assert.equal(guideView('closed').guide, false);
});

test('only the Mac downloads go through the guide', () => {
  assert.equal(isMacDownload('mac-arm64'), true);
  assert.equal(isMacDownload('mac-x64'), true);
  for (const key of ['windows', 'linux-appimage', 'linux-deb', undefined]) assert.equal(isMacDownload(key), false);
});

test('without JavaScript the guide is a plain section: why and steps visible, the choice hidden', () => {
  assert.ok(guide.length > 500, 'the guide is on the page');
  assert.match(guide, /^id="mac-guide"[^>]*tabindex="-1"/);
  assert.match(guide, /<div class="os-why" data-mac-why>/);
  assert.match(guide, /data-mac-choice hidden/);
  assert.match(guide, /data-mac-cancelled hidden/);
  assert.match(guide, /<div class="os-steps" data-mac-steps>/);
  assert.match(guide, /data-mac-steps-title[^>]*tabindex="-1"/);
  // The Mac cards and the first-open note link to it.
  assert.ok((html.match(/href="#mac-guide"/g) ?? []).length >= 2);
});

test('the guide says why before the steps, offers both choices, and explains how to undo', () => {
  const words = text(guide);
  const why = words.indexOf('paid Apple');
  assert.ok(why > 0 && why < words.indexOf('Open Anyway'), 'the reason comes before the steps');
  for (const phrase of [
    'free and open source',
    'same file',
    'GitHub',
    'Continue',
    'No thanks',
    'Nothing was downloaded or installed',
    'Bin',
    'Done',
    'Privacy & Security',
    'Open Anyway',
    'password',
    'macOS 14',
    'Control-click',
  ]) {
    assert.ok(words.includes(phrase), phrase);
  }
  assert.match(guide, /<button type="button" class="btn" data-mac-cancel>/);
  assert.match(guide, /<a class="btn primary" data-mac-continue href="https:\/\//);
});

test('each step picture exists, is small, has alt text, and uses only design-token colours', () => {
  const tokens = readFileSync(join(import.meta.dirname, '..', '..', '..', 'packages', 'ui', 'tokens.css'), 'utf8');
  const palette = new Set([...tokens.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toUpperCase()));
  const images = [...guide.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.length, 4);
  for (const img of images) {
    const src = /src="([^"]+)"/.exec(img)![1];
    assert.match(img, /alt="[^"]{30,}"/, `${src} has meaningful alt text`);
    const path = join(PUBLIC, src);
    assert.ok(existsSync(path), src);
    const svg = readFileSync(path, 'utf8');
    assert.ok(svg.length < 6000, `${src} is small`);
    assert.match(svg, /prefers-color-scheme: dark/, `${src} follows dark mode`);
    assert.doesNotMatch(svg, /<script|href=|url\(/, `${src} loads and runs nothing`);
    for (const colour of svg.match(/#[0-9a-f]{3,8}\b/gi) ?? []) {
      assert.ok(palette.has(colour.toUpperCase()), `${src}: ${colour} is not a design token`);
    }
  }
});
