// The main process must never touch the database (#56, docs/ARCHITECTURE.md §1): only the data process
// does, so SQL can never freeze the window. This walks the whole import graph of every main-process file
// (esbuild resolves it, as for the real bundle) and fails if it reaches SQLite or LernLab's database code.
// It stands in for the dependency-cruiser rule the architecture describes, without a new dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { options } from './build';

const dir = new URL('.', import.meta.url);
/** Every file that runs in the main process (or preload). build.ts is the bundler script, not app code. */
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'build.ts');

const SQL_MODULES = ['node:sqlite', 'sqlite'];
/** Storage host, and the core modules that run SQL: db/host (the connection) and migrations. */
const DB_CODE = [
  /packages[/\\]storage-sqlite[/\\]/,
  /packages[/\\]core[/\\]src[/\\](db|host|migrate)\.ts$/,
  /packages[/\\]core[/\\]src[/\\]migrations[/\\]/,
];

/** All files and bare modules a file pulls in, directly or not. */
async function graph(file: string) {
  const r = await build({
    ...options('main'),
    entryPoints: [`electron/${file}`],
    outfile: undefined,
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const inputs = Object.keys(r.metafile.inputs);
  const imports = Object.values(r.metafile.inputs).flatMap((i) => i.imports.map((x) => x.path));
  return { inputs, imports };
}

test('the check covers main and preload', () => {
  assert.ok(files.includes('main.ts') && files.includes('preload.ts'));
});

for (const file of files) {
  test(`${file} reaches no SQL code`, async () => {
    const { inputs, imports } = await graph(file);
    for (const mod of SQL_MODULES) assert.ok(!imports.includes(mod), `${file} must not import ${mod}`);
    for (const bad of DB_CODE) {
      const hit = inputs.find((p) => bad.test(p));
      assert.equal(hit, undefined, `${file} must not import database code (${hit}); ask the data process instead`);
    }
  });
}
