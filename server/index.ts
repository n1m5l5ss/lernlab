// One process, one port: the API, the audio files and the game UI.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname, join, normalize } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { createApp, runImport } from './app';
import { getDb } from './db';
import { ankiAvailable } from './anki';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`LernLab needs Node 22.13 or newer (you have ${process.versions.node}). Install it from https://nodejs.org`);
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 5179);
const DEV = process.env.LERNLAB_DEV === '1';
const api = getRequestListener(createApp().fetch);
const dist = resolve('dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

async function main() {
  getDb();
  let vite: any = null;
  if (DEV) {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' });
  } else if (!existsSync(join(dist, 'index.html'))) {
    console.error('No build found. Run "npm start" (it builds first) or "npm run dev".');
    process.exit(1);
  }

  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/') || url.startsWith('/media/')) return api(req, res);
    if (vite) return vite.middlewares(req, res);
    const path = normalize(join(dist, decodeURIComponent(url.split('?')[0])));
    const file = path.startsWith(dist) && existsSync(path) && extname(path) ? path : join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });

  server.listen(PORT, '127.0.0.1', async () => {
    console.log(`\n  LernLab is running → http://localhost:${PORT}\n`);
    const items = Number(getDb().prepare('SELECT COUNT(*) AS n FROM items').get().n);
    if (items === 0) {
      if (await ankiAvailable()) {
        console.log('  First start: importing your words from Anki…');
        void runImport();
      } else {
        console.log('  No words yet. Open Anki (with AnkiConnect), then click "Import from Anki" in the app.');
      }
    }
  });
}

main();
