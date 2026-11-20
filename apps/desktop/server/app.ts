import { Hono } from 'hono';
import { basename, extname } from 'node:path';
import { getDb, setMeta } from './db';
import { ankiAvailable, anki } from './anki';
import { importFile, importFromAnki } from './importer';
import { exportDeck } from './exporter';
import {
  activeDeckId,
  getSettings,
  overrideToCorrect,
  recordAttempt,
  rowToItem,
  ITEM_SELECT,
  type Settings,
} from './learn';
import {
  createDeck,
  deckByName,
  deleteDeck,
  getDeck,
  mediaKind,
  readMedia,
  stableId,
  storeMedia,
  updateDeck,
  upsertCards,
  LANGUAGES,
} from './library';
import { pastedToCards } from './formats/csv';
import { planSession } from './session';
import { appState, dailySummary, finishSession, progressReport, stats, ACHIEVEMENTS } from './progress';
import type { Attempt, SessionLength } from '../shared/types';

export const importStatus = { running: false, log: [] as string[], error: null as string | null, result: null as any };

export async function runAnkiImport(source?: string, deckName?: string) {
  if (importStatus.running) return;
  Object.assign(importStatus, { running: true, error: null, log: [], result: null });
  try {
    importStatus.result = await importFromAnki(source ?? getSettings().deck, { deckName }, (m) => {
      importStatus.log.push(m);
      console.log(`[import] ${m}`);
    });
  } catch (e: any) {
    importStatus.error = e.message;
  } finally {
    importStatus.running = false;
  }
}

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
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
  const err = (c: any, e: any, code = 400) => c.json({ error: e?.message ?? String(e) }, code);

  app.get('/api/state', (c) => c.json({ ...appState(), importing: importStatus.running, languages: LANGUAGES }));

  /* ── Decks ─────────────────────────────────────────── */
  app.post('/api/decks', async (c) => {
    const b = await c.req.json();
    if (!b.name?.trim()) return err(c, 'Name required');
    const deck = createDeck(b.name.trim(), b.language || null, b.goal ? { goal: b.goal } : {}, b.description ?? '');
    setMeta(getDb(), 'activeDeck', deck.id);
    return c.json(deck);
  });
  app.put('/api/decks/:id', async (c) => {
    try {
      return c.json(updateDeck(Number(c.req.param('id')), await c.req.json()));
    } catch (e) {
      return err(c, e);
    }
  });
  app.delete('/api/decks/:id', (c) => {
    deleteDeck(Number(c.req.param('id')));
    return c.json({ ok: true });
  });
  app.post('/api/decks/:id/activate', (c) => {
    const id = Number(c.req.param('id'));
    if (!getDeck(id)) return err(c, 'Deck not found', 404);
    setMeta(getDb(), 'activeDeck', id);
    return c.json({ ok: true });
  });
  app.get('/api/decks/:id/export', (c) => {
    try {
      const f = exportDeck(Number(c.req.param('id')), c.req.query('format') === 'csv' ? 'csv' : 'lernpack');
      return new Response(f.data as unknown as BodyInit, {
        headers: {
          'Content-Type': f.type,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(f.name)}"`,
        },
      });
    } catch (e) {
      return err(c, e);
    }
  });

  /* ── Cards ─────────────────────────────────────────── */
  app.get('/api/decks/:id/cards', (c) => {
    const id = Number(c.req.param('id'));
    const q = `%${c.req.query('q') ?? ''}%`;
    const offset = Number(c.req.query('offset') ?? 0);
    const d = getDb();
    const rows = d
      .prepare(
        `${ITEM_SELECT} WHERE i.deck_id = ? AND (i.target LIKE ? OR i.meaning LIKE ? OR i.tags LIKE ? OR i.sentence LIKE ?) ORDER BY i.ord LIMIT 100 OFFSET ?`,
      )
      .all(id, q, q, q, q, offset);
    const total = Number(
      d
        .prepare(
          `SELECT COUNT(*) AS n FROM items i WHERE i.deck_id = ? AND (i.target LIKE ? OR i.meaning LIKE ? OR i.tags LIKE ? OR i.sentence LIKE ?)`,
        )
        .get(id, q, q, q, q).n,
    );
    const state = new Map(
      d
        .prepare(
          `SELECT st.item_id, st.mastery, s.due FROM item_state st LEFT JOIN srs s ON s.item_id = st.item_id WHERE st.item_id IN (SELECT id FROM items WHERE deck_id = ?)`,
        )
        .all(id)
        .map((r: any) => [Number(r.item_id), r]),
    );
    return c.json({
      total,
      cards: rows.map((r: any) => ({
        ...rowToItem(r),
        suspended: !!r.suspended,
        starred: !!r.starred,
        mastery: Number(state.get(Number(r.id))?.mastery ?? 0),
        due: state.get(Number(r.id))?.due ?? null,
        extra: JSON.parse(r.extra ?? '{}'),
      })),
    });
  });
  app.post('/api/decks/:id/cards', async (c) => {
    const deck = getDeck(Number(c.req.param('id')));
    if (!deck) return err(c, 'Deck not found', 404);
    const b = await c.req.json();
    if (!b.front?.trim()) return err(c, 'Front required');
    const sourceId = stableId(`${deck.name}\u0000manual\u0000${Date.now()}\u0000${Math.random()}`);
    upsertCards(deck, [
      {
        ...b,
        altAnswers: b.alt,
        image: b.image || undefined,
        audio: b.audio || undefined,
        video: b.video || undefined,
        sourceId,
        tags: typeof b.tags === 'string' ? b.tags.split(/[\s,]+/) : b.tags,
      },
    ]);
    return c.json({ id: sourceId });
  });
  app.put('/api/cards/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const d = getDb();
    const r = d.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!r) return err(c, 'Card not found', 404);
    const b = await c.req.json();
    if (typeof b.suspended === 'boolean')
      d.prepare('UPDATE items SET suspended = ? WHERE id = ?').run(b.suspended ? 1 : 0, id);
    if (typeof b.starred === 'boolean')
      d.prepare('UPDATE items SET starred = ? WHERE id = ?').run(b.starred ? 1 : 0, id);
    if (b.front !== undefined) {
      const deck = getDeck(Number(r.deck_id))!;
      upsertCards(deck, [
        {
          sourceId: id,
          front: b.front,
          back: b.back ?? '',
          example: b.example,
          exampleTranslation: b.exampleTranslation,
          explanation: b.explanation,
          notes: b.notes,
          image: b.image || undefined,
          audio: b.audio || undefined,
          video: b.video || undefined,
          category: b.category,
          tags: typeof b.tags === 'string' ? b.tags.split(/[\s,]+/) : b.tags,
          subdeck: r.deck,
          group: r.grp,
          rank: Number(r.rank),
          type: b.type,
          choices: b.choices,
          correct: b.correct,
          steps: b.steps,
          altAnswers: b.alt,
          extra: JSON.parse(r.extra ?? '{}'),
        },
      ]);
    }
    return c.json({ ok: true });
  });
  app.delete('/api/cards/:id', (c) => {
    const id = Number(c.req.param('id'));
    const d = getDb();
    for (const t of ['srs', 'item_state']) d.prepare(`DELETE FROM ${t} WHERE item_id = ?`).run(id);
    d.prepare('DELETE FROM items WHERE id = ?').run(id);
    return c.json({ ok: true });
  });

  /* ── Import / media ────────────────────────────────── */
  app.post('/api/import/file', async (c) => {
    const name = c.req.query('name') ?? 'deck.csv';
    const data = new Uint8Array(await c.req.arrayBuffer());
    try {
      const res = importFile(name, data, {
        deckId: c.req.query('deckId') ? Number(c.req.query('deckId')) : undefined,
        deckName: c.req.query('deckName') || undefined,
        language: c.req.query('language') !== undefined ? c.req.query('language') || null : undefined,
      });
      setMeta(getDb(), 'activeDeck', res.deck.id);
      return c.json(res);
    } catch (e) {
      return err(c, e);
    }
  });
  app.post('/api/import/text', async (c) => {
    const b = await c.req.json();
    const cards = pastedToCards(b.text ?? '', b.fieldSep || '\t', b.cardSep || '\n');
    if (!cards.length) return err(c, 'No cards found in the pasted text');
    const name = (b.deckName || 'Pasted cards').trim();
    const deck = (b.deckId && getDeck(Number(b.deckId))) || deckByName(name) || createDeck(name, b.language || null);
    const res = upsertCards(deck, cards);
    setMeta(getDb(), 'activeDeck', deck.id);
    return c.json({ ...res, format: 'paste', media: 0, mediaMissing: 0 });
  });
  app.get('/api/import/anki', async (c) => {
    const ok = await ankiAvailable();
    const decks = ok ? await anki<string[]>('deckNames').catch(() => []) : [];
    return c.json({ ...importStatus, anki: ok, ankiDecks: decks });
  });
  app.post('/api/import/anki', async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (!(await ankiAvailable()))
      return err(c, 'Anki is not reachable. Open Anki (with the AnkiConnect add-on) and try again.', 503);
    void runAnkiImport(b.source, b.deckName);
    return c.json({ started: true });
  });
  // v0.1 compatibility
  app.get('/api/import', async (c) => c.json({ ...importStatus, anki: await ankiAvailable() }));
  app.post('/api/import', async (c) => {
    if (!(await ankiAvailable())) return err(c, 'Anki is not reachable.', 503);
    void runAnkiImport();
    return c.json({ started: true });
  });

  app.post('/api/media', async (c) => {
    const name = c.req.query('name') ?? 'file';
    if (!mediaKind(name)) return err(c, 'Unsupported media type');
    const buf = Buffer.from(await c.req.arrayBuffer());
    if (buf.length > 50 * 1024 * 1024) return err(c, 'File too large (max 50 MB)');
    return c.json({ file: storeMedia(name, buf), kind: mediaKind(name) });
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

  /* ── Study ─────────────────────────────────────────── */
  app.post('/api/session', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const length = (
      ['mini', 'standard', 'long'].includes(body.length) ? body.length : getSettings().sessionLength
    ) as SessionLength;
    return c.json(planSession(length, getDb(), new Date(), body.deckId ?? activeDeckId()));
  });
  app.post('/api/attempt', async (c) => c.json(recordAttempt((await c.req.json()) as Attempt)));
  app.post('/api/attempt/override', async (c) => c.json(overrideToCorrect(Number((await c.req.json()).itemId))));
  app.post('/api/session/finish', async (c) => c.json(finishSession(await c.req.json())));

  /* ── Progress ──────────────────────────────────────── */
  app.get('/api/stats', (c) => c.json({ ...stats(), achievements: ACHIEVEMENTS }));
  app.get('/api/summary/today', (c) => c.json(dailySummary()));
  app.get('/api/progress', (c) => c.json(progressReport()));

  app.put('/api/settings', async (c) => {
    const body = (await c.req.json()) as Partial<Settings>;
    const next = { ...getSettings(), ...body };
    next.newPerDay = Math.max(0, Math.min(100, Number(next.newPerDay) || 0));
    next.dailyGoalSessions = Math.max(1, Math.min(5, Number(next.dailyGoalSessions) || 1));
    next.blitzSeconds = Number(next.blitzSeconds) === 0 ? 0 : Math.max(3, Math.min(60, Number(next.blitzSeconds) || 8));
    next.questionTimer = Math.max(0, Math.min(60, Number(next.questionTimer) || 0));
    setMeta(getDb(), 'settings', next);
    return c.json(next);
  });

  return app;
}
