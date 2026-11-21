// Supply-chain rules for the CI workflows (docs/SECURITY-PRACTICES.md). A tag like `@v4` can be moved
// to different code by whoever controls that repository, so every action is pinned to a full commit
// SHA (Dependabot keeps the pins current), every container image to a digest, and tokens get write
// access only in the job that needs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const dir = join(root, '.github', 'workflows');
const workflows = readdirSync(dir)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));

test('every third-party action is pinned to a commit SHA with its version beside it', () => {
  for (const { name, text } of workflows) {
    for (const [, ref] of text.matchAll(/^\s*-?\s*uses:\s*(\S+.*)$/gm)) {
      if (ref.startsWith('./')) continue; // a workflow in this repository
      assert.match(ref, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/, `${name}: ${ref}`);
    }
  }
});

test('container images are pinned by digest', () => {
  for (const { name, text } of workflows) {
    for (const [, image] of text.matchAll(/^\s*image:\s*(\S+)/gm)) {
      assert.match(image, /@sha256:[0-9a-f]{64}$/, `${name}: ${image}`);
    }
  }
});

test('workflow-wide token permissions are read-only; writes are granted per job', () => {
  for (const { name, text } of workflows) {
    const top = text.match(/^permissions:(.*(?:\n {2}.*)*)/m);
    assert.ok(top, `${name} sets no top-level permissions`);
    assert.doesNotMatch(top[1], /write/, `${name}: top-level permissions grant write`);
  }
});

test('Dependabot watches both npm packages and CI actions', () => {
  const config = readFileSync(join(root, '.github', 'dependabot.yml'), 'utf8');
  assert.match(config, /package-ecosystem: npm/);
  assert.match(config, /package-ecosystem: github-actions/);
});
