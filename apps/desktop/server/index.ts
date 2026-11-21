// CLI entry: `npm start` / `npm run dev`. The desktop app uses server.ts directly.
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../backend/storage';
import { ankiAvailable } from '../backend/anki';
import { runAnkiImport } from '../backend/handlers';
import { startServer } from './server';

// The app's own folder (apps/desktop), so the UI build is found wherever the command runs from.
// Data still goes to ./data in the folder you start from (the repo root for `npm start`).
const appDir = fileURLToPath(new URL('..', import.meta.url));

// For Settings → AI assistant: how an assistant starts the MCP server from source (#148), on this data folder.
process.env.LERNLAB_MCP_COMMAND ??= JSON.stringify({
  command: process.execPath,
  args: [createRequire(import.meta.url).resolve('tsx/cli'), join(appDir, 'backend', 'mcp-stdio.ts')],
  env: { LERNLAB_DATA: resolve(process.env.LERNLAB_DATA ?? 'data') },
});

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    `LernLab needs Node 22.13 or newer (you have ${process.versions.node}). Install it from https://nodejs.org`,
  );
  process.exit(1);
}

startServer({
  port: Number(process.env.PORT ?? 5179),
  dev: process.env.LERNLAB_DEV === '1',
  distDir: join(appDir, 'dist'),
  root: appDir,
})
  .then(async ({ port }) => {
    console.log(`\n  LernLab is running → http://localhost:${port}\n`);
    const decks = Number(getDb().prepare('SELECT COUNT(*) AS n FROM decks').get()!.n);
    if (decks === 0 && process.env.LERNLAB_AUTO_ANKI !== '0' && (await ankiAvailable())) {
      console.log('  First start: importing Lang::German from Anki…');
      void runAnkiImport();
    }
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
