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
    // The MCP SDK's server/ folder is the stdio MCP server (#148), not an HTTP server; its HTTP transports stay out.
    const app = inputs.filter(
      (p) => !/node_modules[/\\]@modelcontextprotocol[/\\]sdk[/\\]dist[/\\]esm[/\\]server[/\\]/.test(p),
    );
    for (const bad of [/node_modules[/\\](hono|@hono|express)[/\\]/, /[/\\]server[/\\]/])
      assert.ok(!app.some((p) => bad.test(p)), `${entry} must not include ${app.find((p) => bad.test(p))}`);
    assert.ok(
      !inputs.some((p) => /(sse|streamableHttp|express)\.js$/i.test(p)),
      `${entry} must not include an HTTP transport`,
    );
    for (const mod of ['node:http', 'node:https', 'node:net', 'http', 'https', 'net', 'node:http2', 'http2'])
      assert.ok(!imports.includes(mod), `${entry} must not import ${mod}`);
    const code = r.outputFiles[0].text;
    assert.ok(!/\.listen\(/.test(code), `${entry} must not call listen()`);
  });
}
