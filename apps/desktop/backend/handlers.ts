// Every request the window can make, as one typed table. The data process runs these for the desktop
// app (over IPC); the web dev server runs the same table over HTTP (server/app.ts).
import { setMeta } from '@lernlab/core/db';
import { exportDeck } from '@lernlab/core/exporter';
import { pastedToCards } from '@lernlab/core/formats/csv';
import { importFile, importFromAnki, type ImportResult } from '@lernlab/core/importer';
import {
  asStudySource,
  getSettings,
  ITEM_SELECT,
  overrideToCorrect,
  recordAttempt,
  rowToItem,
  type Settings,
  type StudySource,
} from '@lernlab/core/learn';
import {
  cleanDeckSettings,
  createDeck,
  deckByName,
  deleteDeck,
  getDeck,
  LANGUAGES,
  mediaKind,
  stableId,
  storeMedia,
  updateDeck,
  upsertCards,
  type DeckSettings,
  type NormalizedCard,
} from '@lernlab/core/library';
import { ACHIEVEMENTS, appState, dailySummary, finishSession, journey, stats } from '@lernlab/core/progress';
import { MigrationError } from '@lernlab/core/migrate';
import { UserError as AppError } from '@lernlab/core/errors';
import { bulkCards, CARD_STATES, findCards, MAX_ROWS, type BulkAction } from '@lernlab/core/browse';
import { planSession } from '@lernlab/core/session';
import type { Attempt, Format, SessionLength } from '@lernlab/core/types';
import { anki, ankiAvailable, ankiConnect } from './anki';
import { getDb } from './storage';
import { backupAppDb, dataDir } from '@lernlab/storage-sqlite';
import { basename, join } from 'node:path';
import pkg from '../package.json';
import { InvalidInput, v, type Check } from './validate';

/** A failure the window can show: `code` is stable (and names its translation), `message` is the English fallback. */
export { UserError as AppError } from '@lernlab/core/errors';

const MB = 1024 * 1024;
const text = v.optional(v.nullable(v.string()));
const tags: Check<string | string[] | undefined> = (value, path) =>
  typeof value === 'string' ? v.string()(value, path) : v.optional(v.array(v.string(200), 500))(value, path);

/** Card fields the editor sends. */
const cardInput = v.object({
  front: text,
  back: text,
  example: text,
  exampleTranslation: text,
  explanation: text,
  notes: text,
  image: text,
  audio: text,
  video: text,
  category: text,
  tags,
  type: text,
  choices: text,
  correct: text,
  steps: text,
  alt: text,
  suspended: v.optional(v.boolean),
  starred: v.optional(v.boolean),
});

const splitTags = (t: string | string[] | undefined) => (typeof t === 'string' ? t.split(/[\s,]+/) : t);

/* ── Anki import runs in the background; the window polls its status ── */

/** Study one deck (or every deck, with null): it becomes the session source too. */
function chooseDeck(id: number | null) {
  setMeta(getDb(), 'activeDeck', id);
  setMeta(getDb(), 'studySource', null);
}

const studySource: Check<StudySource> = (value, path = '') => {
  const source = asStudySource(value);
  if (!source) throw new InvalidInput(`${path || 'input'} must be a study source`);
  return source;
};

const tagName = (value: unknown, path = '') => {
  const tag = v.string(200)(value, path).trim();
  if (!tag || /\s/.test(tag)) throw new InvalidInput(`${path || 'input'} must be one tag`);
  return tag;
};
const bulkAction: Check<BulkAction> = (value, path = 'action') => {
  const kind = v.oneOf(
    'tag',
    'untag',
    'move',
    'suspend',
    'unsuspend',
    'star',
    'unstar',
    'delete',
  )(v.record(value, path).kind, `${path}.kind`);
  if (kind === 'tag' || kind === 'untag') return { kind, ...v.object({ tag: tagName })(value, path) };
  if (kind === 'move') return { kind, ...v.object({ deckId: v.id })(value, path) };
  return { kind };
};

export const importStatus = {
  running: false,
  log: [] as string[],
  error: null as string | null,
  result: null as ImportResult | null,
};

export async function runAnkiImport(source?: string, deckName?: string) {
  if (importStatus.running) return;
  Object.assign(importStatus, { running: true, error: null, log: [], result: null });
  try {
    importStatus.result = await importFromAnki(ankiConnect, source ?? getSettings().deck, { deckName }, (m) => {
      importStatus.log.push(m);
      console.log(`[import] ${m}`);
    });
  } catch (e) {
    importStatus.error = (e as Error).message;
  } finally {
    importStatus.running = false;
  }
}

/** A handler: a validator for its input and the function that does the work. */
type Handler<I, O> = { input: Check<I>; run: (input: I) => O | Promise<O> };
const h = <I, O>(input: Check<I>, run: (input: I) => O | Promise<O>): Handler<I, O> => ({ input, run });

export const handlers = {
  'state.get': h(v.none, () => ({ ...appState(), importing: importStatus.running, languages: LANGUAGES })),

  /* ── Decks ── */
  'decks.create': h(
    v.object({
      name: v.string(200),
      language: v.optional(v.nullable(v.string(20))),
      goal: v.optional(v.record),
      settings: v.optional(v.record),
      description: v.optional(v.string(10_000)),
    }),
    (b) => {
      if (!b.name.trim()) throw new AppError('name_required', 'Name required');
      const settings = cleanDeckSettings({ ...(b.goal ? { goal: b.goal } : {}), ...(b.settings ?? {}) });
      const deck = createDeck(b.name.trim(), b.language || null, settings as DeckSettings, b.description ?? '');
      chooseDeck(deck.id);
      return deck;
    },
  ),
  'decks.update': h(
    v.object({
      id: v.id,
      patch: v.object({
        name: v.optional(v.string(200)),
        language: v.optional(v.nullable(v.string(20))),
        description: v.optional(v.string(10_000)),
        settings: v.optional(v.record),
      }),
    }),
    ({ id, patch }) => {
      if (patch.name !== undefined && !patch.name.trim()) throw new AppError('name_required', 'Name required');
      return updateDeck(id, {
        ...patch,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        settings: patch.settings ? (cleanDeckSettings(patch.settings) as DeckSettings) : undefined,
      });
    },
  ),
  /** Deleting a deck takes a backup of the whole database first, so it can be undone from backups/. */
  'decks.delete': h(v.object({ id: v.id }), ({ id }) => {
    if (!getDeck(id)) throw new AppError('deck_not_found', 'Deck not found');
    const backup = basename(backupAppDb());
    deleteDeck(id);
    return { ok: true, backup };
  }),
  /** Study one deck, or every deck when `id` is null. */
  'decks.activate': h(v.object({ id: v.nullable(v.id) }), ({ id }) => {
    if (id !== null && !getDeck(id)) throw new AppError('deck_not_found', 'Deck not found');
    chooseDeck(id);
    return { ok: true };
  }),
  'study.choose': h(v.object({ source: studySource }), ({ source }) => {
    const ids = source.kind === 'deck' ? [source.deckId] : source.kind === 'decks' ? source.deckIds : [];
    if (ids.some((id) => !getDeck(id))) throw new AppError('deck_not_found', 'Deck not found');
    if (source.kind === 'deck' || source.kind === 'all') chooseDeck(source.kind === 'deck' ? source.deckId : null);
    else setMeta(getDb(), 'studySource', source);
    return { ok: true };
  }),
  'decks.export': h(v.object({ id: v.id, format: v.oneOf('csv', 'lernpack') }), ({ id, format }) =>
    exportDeck(id, format),
  ),

  /* ── Cards ── */
  /** Light rows for the browser, across every deck unless one is given. */
  'cards.find': h(
    v.object({
      deckId: v.optional(v.nullable(v.id)),
      q: v.optional(v.string(500)),
      tag: v.optional(v.string(200)),
      state: v.optional(v.oneOf(...CARD_STATES)),
    }),
    (filter) => ({ ...findCards(filter), limit: MAX_ROWS }),
  ),
  /** One full card for the editor. */
  'cards.get': h(v.object({ id: v.id }), ({ id }) => {
    const r = getDb().prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id);
    if (!r) throw new AppError('card_not_found', 'Card not found');
    return {
      ...rowToItem(r),
      suspended: !!r.suspended,
      starred: !!r.starred,
      extra: JSON.parse((r.extra as string | null) ?? '{}') as Record<string, string>,
    };
  }),
  /** One change to many cards. Deleting takes a backup of the whole database first. */
  'cards.bulk': h(v.object({ ids: v.array(v.id, 100_000), action: bulkAction }), ({ ids, action }) => {
    if (action.kind === 'move' && !getDeck(action.deckId)) throw new AppError('deck_not_found', 'Deck not found');
    const backup = action.kind === 'delete' ? basename(backupAppDb()) : undefined;
    const count = bulkCards(ids, action);
    return backup ? { count, backup } : { count };
  }),
  'cards.add': h(v.object({ deckId: v.id, card: cardInput }), ({ deckId, card: b }) => {
    const deck = getDeck(deckId);
    if (!deck) throw new AppError('deck_not_found', 'Deck not found');
    if (!b.front?.trim()) throw new AppError('front_required', 'Front required');
    const sourceId = stableId(`${deck.name}\u0000manual\u0000${Date.now()}\u0000${Math.random()}`);
    upsertCards(deck, [
      {
        ...(b as NormalizedCard),
        altAnswers: b.alt ?? undefined,
        image: b.image || undefined,
        audio: b.audio || undefined,
        video: b.video || undefined,
        sourceId,
        tags: splitTags(b.tags),
      },
    ]);
    return { id: sourceId };
  }),
  'cards.update': h(v.object({ id: v.id, card: cardInput }), ({ id, card: b }) => {
    const d = getDb();
    const r = d.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!r) throw new AppError('card_not_found', 'Card not found');
    if (typeof b.suspended === 'boolean')
      d.prepare('UPDATE items SET suspended = ? WHERE id = ?').run(b.suspended ? 1 : 0, id);
    if (typeof b.starred === 'boolean')
      d.prepare('UPDATE items SET starred = ? WHERE id = ?').run(b.starred ? 1 : 0, id);
    if (b.front !== undefined) {
      const deck = getDeck(Number(r.deck_id))!;
      const opt = (x: string | null | undefined) => x ?? undefined;
      upsertCards(deck, [
        {
          sourceId: id,
          front: b.front ?? '',
          back: b.back ?? '',
          example: opt(b.example),
          exampleTranslation: opt(b.exampleTranslation),
          explanation: opt(b.explanation),
          notes: opt(b.notes),
          image: b.image || undefined,
          audio: b.audio || undefined,
          video: b.video || undefined,
          category: opt(b.category),
          tags: splitTags(b.tags),
          subdeck: r.deck as string | undefined,
          group: r.grp as string | undefined,
          rank: Number(r.rank),
          type: opt(b.type),
          choices: opt(b.choices),
          correct: opt(b.correct),
          steps: opt(b.steps),
          altAnswers: opt(b.alt),
          extra: JSON.parse((r.extra as string | null) ?? '{}'),
        },
      ]);
    }
    return { ok: true };
  }),

  /* ── Import / media ── */
  'import.file': h(
    v.object({
      name: v.string(500),
      data: v.bytes(500 * MB),
      deckId: v.optional(v.id),
      deckName: v.optional(v.string(200)),
      language: v.optional(v.nullable(v.string(20))),
    }),
    ({ name, data, deckId, deckName, language }) => {
      const res = importFile(name, data, { deckId, deckName: deckName || undefined, language });
      chooseDeck(res.deck.id);
      return res;
    },
  ),
  'import.text': h(
    v.object({
      text: v.optional(v.string(50 * MB)),
      fieldSep: v.optional(v.string(10)),
      cardSep: v.optional(v.string(10)),
      deckName: v.optional(v.string(200)),
      deckId: v.optional(v.id),
      language: v.optional(v.nullable(v.string(20))),
    }),
    (b) => {
      const cards = pastedToCards(b.text ?? '', b.fieldSep || '\t', b.cardSep || '\n');
      if (!cards.length) throw new AppError('no_cards', 'No cards found in the pasted text');
      const name = (b.deckName || 'Pasted cards').trim();
      const deck = (b.deckId && getDeck(b.deckId)) || deckByName(name) || createDeck(name, b.language || null);
      const res = upsertCards(deck, cards);
      chooseDeck(deck.id);
      return { ...res, format: 'paste', media: 0, mediaMissing: 0 };
    },
  ),
  'import.ankiInfo': h(v.none, async () => {
    const ok = await ankiAvailable();
    const decks = ok ? await anki<string[]>('deckNames').catch(() => [] as string[]) : [];
    return { ...importStatus, anki: ok, ankiDecks: decks };
  }),
  'import.anki': h(
    v.optional(v.object({ source: v.optional(v.string(500)), deckName: v.optional(v.string(200)) })),
    async (b) => {
      if (!(await ankiAvailable()))
        throw new AppError(
          'anki_unreachable',
          'Anki is not reachable. Open Anki (with the AnkiConnect add-on) and try again.',
        );
      void runAnkiImport(b?.source, b?.deckName);
      return { started: true };
    },
  ),
  'import.status': h(v.none, async () => ({ ...importStatus, anki: await ankiAvailable() })),
  'media.upload': h(v.object({ name: v.string(500), data: v.bytes(50 * MB) }), ({ name, data }) => {
    if (!mediaKind(name)) throw new AppError('unsupported_media', 'Unsupported media type');
    return { file: storeMedia(name, data), kind: mediaKind(name) };
  }),

  /* ── Study ── */
  'session.plan': h(
    v.optional(
      v.object({ length: v.optional(v.string(20)), deckId: v.optional(v.id), practice: v.optional(v.boolean) }),
    ),
    (body) => {
      const length = (
        ['mini', 'standard', 'long'].includes(body?.length ?? '') ? body!.length : getSettings().sessionLength
      ) as SessionLength;
      return planSession(length, getDb(), new Date(), body?.deckId, { practice: !!body?.practice });
    },
  ),
  'attempt.record': h(
    v.object({
      sessionId: v.string(100),
      itemId: v.id,
      format: v.string(30) as Check<Format>,
      correct: v.boolean,
      nearMiss: v.optional(v.boolean),
      articleError: v.optional(v.boolean),
      usedHint: v.optional(v.boolean),
      firstTry: v.optional(v.boolean),
      responseMs: v.number,
      given: v.optional(v.string(10_000)),
      xp: v.number,
      genderOnly: v.optional(v.boolean),
      practice: v.optional(v.boolean),
    }),
    (a) => recordAttempt(a as Attempt),
  ),
  'attempt.override': h(v.object({ itemId: v.id }), ({ itemId }) => overrideToCorrect(itemId)),
  'session.finish': h(
    v.object({
      sessionId: v.string(100),
      length: v.string(20),
      seconds: v.number,
      answers: v.number,
      correct: v.number,
      bossWon: v.nullable(v.boolean),
      bestGenderCombo: v.number,
      perfectBlocks: v.number,
      startedAt: v.string(40),
    }),
    (f) => finishSession(f),
  ),

  /* ── Progress ── */
  'stats.get': h(v.none, () => ({ ...stats(), achievements: [...ACHIEVEMENTS] })),
  'summary.today': h(v.none, () => dailySummary()),
  /** The Progress screen: per-deck learned vs remaining, pace and forecast, study days, retention, hardest cards. */
  'progress.get': h(v.none, () => journey()),
  /** A copy of the database in backups/, taken before an app update is installed. */
  'backup.create': h(v.none, () => ({ file: basename(backupAppDb()) })),
  /** For Settings: the version, licence and where the data lives (read only). */
  'app.info': h(v.none, () => ({
    version: pkg.version,
    licence: pkg.license,
    dataDir: dataDir(),
    backupsDir: join(dataDir(), 'backups'),
  })),
  'settings.save': h(v.record, (body) => {
    const next: Settings = { ...getSettings(), ...(body as Partial<Settings>) };
    next.newPerDay = Math.max(0, Math.min(100, Number(next.newPerDay) || 0));
    next.dailyGoalSessions = Math.max(1, Math.min(5, Number(next.dailyGoalSessions) || 1));
    next.blitzSeconds = Number(next.blitzSeconds) === 0 ? 0 : Math.max(3, Math.min(60, Number(next.blitzSeconds) || 8));
    next.questionTimer = Math.max(0, Math.min(60, Number(next.questionTimer) || 0));
    next.autoUpdate = next.autoUpdate !== false;
    next.betaUpdates = next.betaUpdates === true;
    if (!['system', 'light', 'dark'].includes(next.theme)) next.theme = 'system';
    if (!['normal', 'large', 'larger'].includes(next.textSize)) next.textSize = 'normal';
    next.reducedMotion = next.reducedMotion === true;
    setMeta(getDb(), 'settings', next);
    return next;
  }),
};

export type Handlers = typeof handlers;
export type Channel = keyof Handlers;
export type InputOf<C extends Channel> = ReturnType<Handlers[C]['input']>;
export type OutputOf<C extends Channel> = Awaited<ReturnType<Handlers[C]['run']>>;

/** What crosses the bridge: never a thrown error. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; params?: Record<string, string | number> } };

export const isChannel = (c: unknown): c is Channel => typeof c === 'string' && Object.hasOwn(handlers, c);

/** Validate and run one request. Never throws. */
export async function handle(channel: unknown, input: unknown): Promise<Result<unknown>> {
  if (!isChannel(channel)) return { ok: false, error: { code: 'unknown_channel', message: 'Unknown request' } };
  const handler = handlers[channel] as Handler<unknown, unknown>;
  try {
    return { ok: true, value: await handler.run(handler.input(input)) };
  } catch (e) {
    const code = e instanceof AppError || e instanceof InvalidInput || e instanceof MigrationError ? e.code : 'failed';
    const params = e instanceof AppError ? e.params : undefined;
    return { ok: false, error: { code, message: (e as Error)?.message ?? String(e), ...(params && { params }) } };
  }
}
