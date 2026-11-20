// Start the local server: API + media + game UI on one localhost port. Used by the CLI and the desktop app.
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app';
import { getDb } from './storage';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

export async function startServer(
  opts: { port?: number; distDir?: string; dev?: boolean; root?: string } = {},
): Promise<{ server: Server; port: number }> {
  getDb();
  const api = getRequestListener(createApp().fetch);
  const dist = resolve(opts.distDir ?? 'dist');
  let vite: any = null;
  if (opts.dev) {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({ root: opts.root, server: { middlewareMode: true }, appType: 'spa' });
  } else if (!existsSync(join(dist, 'index.html'))) {
    throw new Error('No UI build found. Run "npm run build" first.');
  }
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/') || url.startsWith('/media/')) return api(req, res);
    if (vite) return vite.middlewares(req, res);
    const path = normalize(join(dist, decodeURIComponent(url.split('?')[0].split('#')[0])));
    const file = path.startsWith(dist) && existsSync(path) && extname(path) ? path : join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  const port: number = await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port ?? 0, '127.0.0.1', () => ok((server.address() as any).port));
  });
  return { server, port };
}
