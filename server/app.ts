import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { getDb, MEDIA_DIR, setMeta } from './db';
import { ankiAvailable } from './anki';
import { importDeck } from './importer';
import { getSettings, recordAttempt, type Settings } from './learn';
import { planSession } from './session';
import { appState, dailySummary, finishSession, stats, progressReport, ACHIEVEMENTS } from './progress';
import type { Attempt, SessionLength } from '../shared/types';

export const importStatus = { running: false, log: [] as string[], error: null as string | null, result: null as any };

export async function runImport(deck?: string) {
  if (importStatus.running) return;
  importStatus.running = true;
  importStatus.error = null;
  importStatus.log = [];
  try {
    importStatus.result = await importDeck(deck ?? getSettings().deck, (m) => {
      importStatus.log.push(m);
      console.log(`[import] ${m}`);
    });
  } catch (e: any) {
    importStatus.error = e.message;
    console.error(`[import] ${e.message}`);
  } finally {
    importStatus.running = false;
  }
}

export function createApp() {
  const app = new Hono();

  app.get('/api/state', async (c) => c.json({ ...appState(), importing: importStatus.running }));

  app.get('/api/import', async (c) => c.json({ ...importStatus, anki: await ankiAvailable() }));
  app.post('/api/import', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!(await ankiAvailable())) return c.json({ error: 'Anki is not reachable. Open Anki (with AnkiConnect) and try again.' }, 503);
    void runImport(body.deck);
    return c.json({ started: true });
  });

  app.post('/api/session', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const length = (['mini', 'standard', 'long'].includes(body.length) ? body.length : getSettings().sessionLength) as SessionLength;
    return c.json(planSession(length));
  });

  app.post('/api/attempt', async (c) => {
    const a = (await c.req.json()) as Attempt;
    return c.json(recordAttempt(a));
  });

  app.post('/api/session/finish', async (c) => c.json(finishSession(await c.req.json())));

  app.get('/api/stats', (c) => c.json({ ...stats(), achievements: ACHIEVEMENTS }));
  app.get('/api/summary/today', (c) => c.json(dailySummary()));
  app.get('/api/progress', (c) => c.json(progressReport()));

  app.put('/api/settings', async (c) => {
    const body = (await c.req.json()) as Partial<Settings>;
    const next = { ...getSettings(), ...body };
    next.newPerDay = Math.max(0, Math.min(50, Number(next.newPerDay) || 0));
    next.dailyGoalSessions = Math.max(1, Math.min(5, Number(next.dailyGoalSessions) || 1));
    setMeta(getDb(), 'settings', next);
    return c.json(next);
  });

  app.get('/media/:file', (c) => {
    const file = basename(c.req.param('file'));
    const path = resolve(MEDIA_DIR, file);
    if (!existsSync(path)) return c.notFound();
    const type = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' }[extname(file)] ?? 'application/octet-stream';
    return new Response(readFileSync(path), { headers: { 'Content-Type': type, 'Cache-Control': 'max-age=31536000' } });
  });

  return app;
}
