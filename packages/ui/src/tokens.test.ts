import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tokens from '../../../docs/design/tokens.json';
import { tokensToCss, windowBackground } from './tokens';

const css = tokensToCss();

test('tokens.css is up to date with docs/design/tokens.json', () => {
  const file = readFileSync(join(import.meta.dirname, '..', 'tokens.css'), 'utf8');
  assert.equal(file, css, 'Run `npm run tokens -w @lernlab/ui` and commit tokens.css');
});

test('every colour exists in both themes', () => {
  assert.deepEqual(Object.keys(tokens.color.dark).sort(), Object.keys(tokens.color.light).sort());
  for (const [k, v] of Object.entries(tokens.color.light)) {
    const name = `--color-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    assert.ok(css.includes(`${name}: ${v};`), `${name} (light)`);
    assert.ok(css.includes(`${name}: ${tokens.color.dark[k as keyof typeof tokens.color.dark]};`), `${name} (dark)`);
  }
});

test('dark applies when chosen, or when the system is dark and light was not chosen', () => {
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme='light'\]\) \{/);
  assert.match(css, /:root\[data-theme='dark'\] \{/);
});

test('sizes, spacing and motion get units', () => {
  assert.match(css, /--text-body: 16px;/);
  assert.match(css, /--space-1: 4px;/);
  assert.match(css, /--space-8: 64px;/);
  assert.match(css, /--size-min-target: 44px;/);
  assert.match(css, /--motion-card: 280ms;/);
  assert.match(css, /--line-body: 1.5;/);
});

test('the window starts in the theme background', () => {
  assert.equal(windowBackground(true), '#1A1917');
  assert.equal(windowBackground(false), '#FAF8F5');
});
