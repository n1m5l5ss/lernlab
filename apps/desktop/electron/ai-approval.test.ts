// AI requests (#148) are applied only when the user accepts them in the window. This checks the two ends:
// the MCP server process can only read the database and has no way to apply a request, and the only way
// into the data process's handlers (aiRequests.accept among them) is the window's IPC with its sender check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { options } from './build';

const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

test('the MCP server bundle cannot apply a request or open the database for writing', async () => {
  const r = await build({ ...options('mcp'), outfile: undefined, write: false, metafile: true, logLevel: 'silent' });
  const inputs = Object.keys(r.metafile.inputs);
  for (const bad of [/backend[/\\]handlers\.ts$/, /backend[/\\]process\.ts$/])
    assert.equal(
      inputs.find((p) => bad.test(p)),
      undefined,
      `${bad} must not be in the MCP bundle`,
    );
  const code = r.outputFiles[0].text;
  assert.match(code, /function openAppDbReadonly\b/, 'the check looks at the real bundle');
  assert.doesNotMatch(code, /function applyAiRequest\b/, 'applying a request is not even in the bundle');
  assert.doesNotMatch(code, /function (openAppDb|upsertCards|bulkCards)\b/, 'nor any code that writes cards');
  // Without a host, core's getDb() cannot open anything: every read goes through openAppDbReadonly.
  assert.doesNotMatch(code, /installNodeHost\(\)/);
  for (const file of ['../backend/mcp-process.ts', '../backend/mcp-stdio.ts', '../backend/mcp.ts']) {
    const src = read(file);
    assert.doesNotMatch(src, /\bopenAppDb\(|\bgetAppDb\(|\bgetDb\(|installNodeHost/, file);
  }
  assert.match(read('../backend/mcp-process.ts'), /openDb: \(\) => openAppDbReadonly\(\)/);
});

test('the window reaches the data process only through IPC that checks the sender', () => {
  const main = read('main.ts');
  const handles = [...main.matchAll(/ipcMain\.handle\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(handles.sort(), ['lernlab:data-status', 'lernlab:invoke']);
  const invoke = main.slice(main.indexOf("ipcMain.handle('lernlab:invoke'"));
  const firstStatement = invoke.slice(invoke.indexOf('{') + 1, invoke.indexOf('callData(')).trim();
  assert.match(firstStatement, /^if \(!trusted\(e\.senderFrame\)/, 'the sender check comes before any call');
  assert.match(main, /const trusted = \(frame: WebFrameMain \| null\) => !!frame && isAppUrl\(frame\.url\);/);
  // Main itself never accepts a request, and the MCP relay has no route into the data process.
  assert.doesNotMatch(main, /aiRequests\.accept/);
  assert.doesNotMatch(read('mcp-relay.ts'), /callData|aiRequests/);
  assert.doesNotMatch(read('preload.ts'), /aiRequests/);
});
