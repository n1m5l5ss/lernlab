import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tokens from '../../../docs/design/tokens.json';
import { colourTable, contrastTables, fillStyleDoc } from './style-doc';

const doc = readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs', 'design', 'style.md'), 'utf8');

test('docs/design/style.md shows the current tokens and their measured contrast', () => {
  assert.match(doc, /<!-- generated:colours -->/);
  assert.match(doc, /<!-- generated:contrast -->/);
  assert.equal(doc, fillStyleDoc(doc), 'Run `npm run tokens -w @lernlab/ui` and commit docs/design/style.md');
});

test('the colour table lists every colour in both themes', () => {
  const table = colourTable();
  for (const [k, v] of Object.entries(tokens.color.light)) {
    assert.ok(table.includes(`\`${k}\``), k);
    assert.ok(table.includes(`\`${v}\``), `${k} light`);
    assert.ok(table.includes(`\`${tokens.color.dark[k as keyof typeof tokens.color.dark]}\``), `${k} dark`);
  }
});

test('the contrast tables are measured, not typed', () => {
  assert.match(contrastTables(), /\| `text` on `bg` \| \d+\.\d\d:1 \| \d+\.\d\d:1 \|/);
  assert.equal(
    fillStyleDoc('<!-- generated:contrast -->\nold\n<!-- /generated:contrast -->'),
    `<!-- generated:contrast -->\n${contrastTables()}\n<!-- /generated:contrast -->`,
  );
});
