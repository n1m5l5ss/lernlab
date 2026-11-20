// The desktop app must not open a network port: no HTTP server code may end up in its bundles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { entries, options } from './build';

for (const entry of Object.keys(entries) as (keyof typeof entries)[]) {
  test(`${entry} bundle has no server code`, async () => {
    const r = await build({ ...options(entry), write: false, metafile: true, logLevel: 'silent' });
    const inputs = Object.keys(r.metafile.inputs);
    const imports = Object.values(r.metafile.inputs).flatMap((i) => i.imports.map((x) => x.path));
    for (const bad of [/node_modules[/\\](hono|@hono)[/\\]/, /[/\\]server[/\\]/])
      assert.ok(!inputs.some((p) => bad.test(p)), `${entry} must not include ${inputs.find((p) => bad.test(p))}`);
    for (const mod of ['node:http', 'node:https', 'node:net', 'http', 'https', 'net', 'node:http2', 'http2'])
      assert.ok(!imports.includes(mod), `${entry} must not import ${mod}`);
    const code = r.outputFiles[0].text;
    assert.ok(!/\.listen\(/.test(code), `${entry} must not call listen()`);
  });
}
