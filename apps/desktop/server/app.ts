// Web dev mode only (`npm start`, `npm run dev`): the same request table as the desktop bridge,
// served over HTTP on localhost. The desktop app never starts this server.
import { Hono } from 'hono';
import { basename, extname } from 'node:path';
import { readMedia } from '@lernlab/core/library';
import { handle } from '../backend/handlers';
import { fromWire, toWire } from '../backend/wire';

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.weba': 'audio/webm',
  '.flac': 'audio/flac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
};

export function createApp() {
  const app = new Hono();

  app.post('/api/invoke/:channel', async (c) => {
    const result = await handle(c.req.param('channel'), fromWire((await c.req.text()) || 'null'));
    return c.body(toWire(result), 200, { 'Content-Type': 'application/json' });
  });

  app.get('/media/:file', (c) => {
    const file = basename(c.req.param('file'));
    const buf = readMedia(file);
    if (!buf) return c.notFound();
    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'max-age=31536000',
      },
    });
  });

  return app;
}
