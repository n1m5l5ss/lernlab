// Bundles the three Electron entry points into dist-electron/ (run by `npm run build:electron`).
// The renderer is built separately by Vite into dist/.
import { build, type BuildOptions } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** main: windows, menu, IPC routing. preload: the bridge. data: the database process. */
export const entries = {
  main: 'electron/main.ts',
  preload: 'electron/preload.ts',
  data: 'backend/process.ts',
} as const;

export const options = (entry: keyof typeof entries): BuildOptions => ({
  absWorkingDir: root,
  entryPoints: [entries[entry]],
  outfile: `dist-electron/${entry}.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'warning',
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await Promise.all((Object.keys(entries) as (keyof typeof entries)[]).map((e) => build(options(e))));
}
