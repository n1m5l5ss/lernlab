// Every request the window can make, as one typed table. The data process runs these for the desktop
// app (over IPC); the web dev server runs the same table over HTTP (server/app.ts).
import { setMeta } from '@lernlab/core/db';
import { exportDeck } from '@lernlab/core/exporter';
import {
  IMPORT_LIMITS,
  importFile,
  importFromAnki,
  importPasted,
  type AnkiProgress,
  type ImportReport,
} from '@lernlab/core/importer';
import {
  MAPPABLE_FIELDS,
  mapFile,
  previewFile,
  previewText,
  type ColumnMapping,
  type MappableField,
} from '@lernlab/core/importpreview';
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
  deleteDeck,
  getDeck,
  LANGUAGES,
  listDecks,
  mediaKind,
  stableId,
  storeMedia,
  updateDeck,
  upsertCards,
  type DeckSettings,
  type NormalizedCard,
} from '@lernlab/core/library';
import {
  ACHIEVEMENTS,
  appState,
  dailySummary,
  finishSession,
  journey,
  stats,
  studiedToday,
} from '@lernlab/core/progress';
import { cleanReminderTime } from '@lernlab/core/reminder';
import {
  cleanPlanMinutes,
  cleanPlanText,
  recentSessionStarts,
  studyPlanOf,
  usualStudyTime,
} from '@lernlab/core/studyplan';
import { MigrationError } from '@lernlab/core/migrate';
import { UserError as AppError } from '@lernlab/core/errors';
import { bulkCards, CARD_STATES, findCards, findDuplicates, MAX_ROWS, type BulkAction } from '@lernlab/core/browse';
import { planSession } from '@lernlab/core/session';
import { TEACH_POINTS_MAX, teachBackPoints, teachBackTopics } from '@lernlab/core/teachback';
import { setOcclusionMode, withOcclusionBoxes } from '@lernlab/core/occlusion';
import { RECORDING_MAX_BYTES, saveRecording } from '@lernlab/core/recording';
import { buildExam, recordExam, type Exam } from '@lernlab/core/examplan';
import { EXAM_MODES } from '@lernlab/core/exam';
import { finishWelcome, needsWelcome, WELCOME_CHOICES } from '@lernlab/core/welcome';
import { lastSeenVersion, markVersionSeen, whatsNewToShow, type ReleaseNotes } from '@lernlab/core/whatsnew';
import type { Attempt, Format, SessionLength } from '@lernlab/core/types';
import {
  ankiAvailable,
  ankiConnect,
  ankiDecks,
  ankiProbe,
  AnkiUnavailable,
  topLevelDecks,
  type AnkiDeck,
} from './anki';
import { downloadGalleryDeck, loadGallery } from './gallery';
import { getDb } from './storage';
import { backupAppDb, dataDir } from '@lernlab/storage-sqlite';
import {
  deleteAllData,
  exportAllData,
  importAllData,
  listBackups,
  restoreBackup,
} from '@lernlab/storage-sqlite/backups';
import { basename, join } from 'node:path';
import pkg from '../package.json';
// Written from CHANGELOG.md by scripts/whats-new.ts at build time, so the notes work offline.
import bundledNotes from './whats-new.json';
import { SAMPLES } from './samples';
import { InvalidInput, v, type Check } from './validate';
import { LEVELS } from '@lernlab/core/variants';
import { rateConfidence } from '@lernlab/core/confidence';
import { ANSWER_MAX, dismissTwin, makeTwin, twinOffer } from '@lernlab/core/confusions';
import { reportTomorrowCheck, saveTomorrowCheck, TOMORROW_ANSWERS, TOMORROW_MAX } from '@lernlab/core/tomorrow';
import { applyAiRequest, cardSnapshots, currentGoals, requestCardIds, SNAPSHOT_MAX } from '@lernlab/core/airequests';
import { countAiRequests, getAiRequest, listAiRequests, removeAiRequest } from '@lernlab/storage-sqlite/airequests';
import { asRequest, checkBody } from './ai-requests';

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
  imageAlt: text,
  audio: text,
  video: text,
  category: text,
  tags,
  type: text,
  choices: text,
  correct: text,
  steps: text,
  tolerance: text,
  code: text,
  codeLang: text,
  occlusion: text,
  occlusionGroup: text,
  occlusionMode: text,
  alt: text,
  variants: text,
  corrections: text,
  keyPoints: text,
  twin: text,
  workedSteps: text,
  mnemonic: text,
  suspended: v.optional(v.boolean),
  starred: v.optional(v.boolean),
});

const splitTags = (t: string | string[] | undefined) => (typeof t === 'string' ? t.split(/[\s,]+/) : t);

/** A column mapping from the import screen: known card fields only, each a column number. */
const columnMapping: Check<ColumnMapping> = (value, path = 'mapping') => {
  const m = v.object({ header: v.boolean, fields: v.record })(value, path);
  const fields: ColumnMapping['fields'] = {};
  for (const [k, i] of Object.entries(m.fields)) {
    if (!Object.hasOwn(MAPPABLE_FIELDS, k)) continue;
    if (!Number.isInteger(i) || (i as number) < 0 || (i as number) > 1000)
      throw new InvalidInput(`${path}.fields.${k} must be a column number`);
    fields[k as MappableField] = i as number;
  }
  return { header: m.header, fields };
};

/** Exams being taken, by id, until they are handed in. Only the last few are kept. */
const exams = new Map<string, Exam>();

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

/** One Anki deck's import: its report, or the error code it failed with. */
export type AnkiOutcome =
  | { source: string; report: ImportReport }
  | { source: string; error: { code: string; params?: Record<string, string | number> } };

export const importStatus = {
  running: false,
  /** The deck being imported now (index from 0 of count) and how far it is. */
  current: null as { source: string; index: number; count: number; progress: AnkiProgress } | null,
  /** One entry per imported deck, in order. */
  results: [] as AnkiOutcome[],
  /** The last error code and the last report, for older callers. */
  error: null as string | null,
  result: null as ImportReport | null,
};

/** Import Anki decks one after another. A selected parent deck already includes its subdecks. */
export async function runAnkiImport(sources?: string[], deckName?: string) {
  if (importStatus.running) return;
  const list = topLevelDecks(sources?.length ? sources : [getSettings().deck]);
  Object.assign(importStatus, { running: true, current: null, results: [], error: null, result: null });
  for (const [index, source] of list.entries()) {
    const current = { source, index, count: list.length, progress: { step: 'notes' } as AnkiProgress };
    importStatus.current = current;
    try {
      const report = await importFromAnki(
        ankiConnect,
        source,
        { deckName: list.length === 1 ? deckName : undefined },
        (progress) => (importStatus.current = { ...current, progress }),
      );
      importStatus.results.push({ source, report });
      importStatus.result = report;
    } catch (e) {
      const error =
        e instanceof AppError
          ? { code: e.code, ...(e.params && { params: e.params }) }
          : { code: e instanceof AnkiUnavailable ? 'anki_unreachable' : 'failed' };
      console.error(`[import] ${source}: ${(e as Error).message}`);
      importStatus.results.push({ source, error });
      importStatus.error = error.code;
    }
  }
  importStatus.running = false;
  importStatus.current = null;
}

/** The command an AI assistant runs to start LernLab's MCP server (#148). Main (desktop) or the web dev server sets it. */
export type AssistantCommand = { command: string; args: string[]; env?: Record<string, string> };
function assistantCommand(): AssistantCommand | null {
  try {
    const c = JSON.parse(process.env.LERNLAB_MCP_COMMAND ?? 'null') as AssistantCommand | null;
    return c && typeof c.command === 'string' && Array.isArray(c.args) ? c : null;
  } catch {
    return null;
  }
}

/** A handler: a validator for its input and the function that does the work. */
type Handler<I, O> = { input: Check<I>; run: (input: I) => O | Promise<O> };
const h = <I, O>(input: Check<I>, run: (input: I) => O | Promise<O>): Handler<I, O> => ({ input, run });

export const handlers = {
  'state.get': h(v.none, () => ({
    ...appState(),
    importing: importStatus.running,
    /** Changes an AI assistant proposed, waiting for the user (#148). */
    aiRequests: countAiRequests(),
    languages: LANGUAGES,
    welcome: needsWelcome(getDb()),
    /** "What's new in X.Y.Z" on the first launch after an update, or null (issue #58). */
    whatsNew: whatsNewToShow({
      current: pkg.version,
      lastSeen: lastSeenVersion(getDb()),
      isNewUser: needsWelcome(getDb()),
      notes: bundledNotes as ReleaseNotes,
    }),
  })),
  /** First run: a sample deck for "language" or "subject" (bundled, offline), then never show the welcome again. */
  'welcome.finish': h(v.object({ choice: v.oneOf(...WELCOME_CHOICES) }), ({ choice }) => {
    let deckId: number | null = null;
    if (choice === 'language' || choice === 'subject') {
      const sample = SAMPLES[choice];
      const opts = { deckName: sample.deckName, language: sample.language };
      deckId = importFile(sample.file, new TextEncoder().encode(sample.csv), opts).deck.id;
      chooseDeck(deckId);
    }
    finishWelcome(choice, getDb());
    // A new user starts on this version: there is nothing new to tell them.
    markVersionSeen(getDb(), pkg.version);
    return { deckId };
  }),
  /** "What's new" was closed: show it again only after the next update. */
  'whatsNew.seen': h(v.none, () => {
    markVersionSeen(getDb(), pkg.version);
    return null;
  }),

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
    const backup = basename(backupAppDb(undefined, 'before-delete'));
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
  'decks.export': h(v.object({ id: v.id, format: v.oneOf('csv', 'lernpack', 'apkg') }), ({ id, format }) =>
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
      ...withOcclusionBoxes([rowToItem(r)], getDb())[0],
      suspended: !!r.suspended,
      starred: !!r.starred,
      extra: JSON.parse((r.extra as string | null) ?? '{}') as Record<string, string>,
    };
  }),
  /** Cards in the deck with the same front (as plain text), so the editor can warn before adding a twin. */
  'cards.duplicates': h(
    v.object({ deckId: v.id, front: v.string(10_000), excludeId: v.optional(v.id) }),
    ({ deckId, front, excludeId }) => ({ matches: findDuplicates(deckId, front, excludeId) }),
  ),
  /** One change to many cards. Deleting takes a backup of the whole database first. */
  'cards.bulk': h(v.object({ ids: v.array(v.id, 100_000), action: bulkAction }), ({ ids, action }) => {
    if (action.kind === 'move' && !getDeck(action.deckId)) throw new AppError('deck_not_found', 'Deck not found');
    const backup = action.kind === 'delete' ? basename(backupAppDb(undefined, 'before-delete')) : undefined;
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
          imageAlt: opt(b.imageAlt),
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
          tolerance: opt(b.tolerance),
          code: opt(b.code),
          codeLang: opt(b.codeLang),
          occlusion: opt(b.occlusion),
          occlusionGroup: opt(b.occlusionGroup),
          occlusionMode: opt(b.occlusionMode),
          altAnswers: opt(b.alt),
          variants: opt(b.variants),
          corrections: opt(b.corrections),
          keyPoints: opt(b.keyPoints),
          twin: opt(b.twin),
          mnemonic: opt(b.mnemonic),
          // The editor writes key terms in the back as ==term==, so the back alone says which there are.
          keyTerms: '',
          workedSteps: opt(b.workedSteps),
          extra: JSON.parse((r.extra as string | null) ?? '{}'),
        },
      ]);
      // The hide-one / hide-all mode belongs to the whole picture.
      if (b.occlusionMode) setOcclusionMode(id, b.occlusionMode);
    }
    return { ok: true };
  }),

  /* ── AI requests (#148): changes an AI assistant proposed; nothing changes until the user accepts one ── */
  /** Waiting requests, with what they would change as it is now: the decks and their plans, the goals, the cards. */
  'aiRequests.list': h(v.none, () => {
    const requests = listAiRequests()
      .map(asRequest)
      .filter((r) => r !== null);
    return {
      requests,
      decks: listDecks().map(({ id, name, settings: { examDate, goal, newPerDay } }) => ({
        id,
        name,
        plan: { examDate, goal: goal && { label: goal.label, words: goal.words }, newPerDay },
      })),
      goals: currentGoals(),
      cards: cardSnapshots([...new Set(requests.flatMap((r) => requestCardIds(r).slice(0, SNAPSHOT_MAX)))]),
    };
  }),
  /** Accept one request, as the user may have edited it (`request`: the same shape, checked again). */
  'aiRequests.accept': h(v.object({ id: v.string(40), request: v.optional(v.record) }), ({ id, request }) => {
    const stored = asRequest(getAiRequest(id));
    if (!stored) throw new AppError('request_not_found', 'This request is no longer waiting.');
    const edited = request
      ? { ...checkBody(stored.kind, request), id: stored.id, createdAt: stored.createdAt }
      : stored;
    const result = applyAiRequest(edited);
    removeAiRequest(id);
    return result;
  }),
  'aiRequests.decline': h(v.object({ id: v.string(40) }), ({ id }) => ({ ok: removeAiRequest(id) })),

  /* ── Import / media ── */
  'import.preview': h(
    v.object({
      name: v.optional(v.string(500)),
      data: v.optional(v.bytes(500 * MB)),
      text: v.optional(v.string(50 * MB)),
      fieldSep: v.optional(v.string(10)),
      cardSep: v.optional(v.string(10)),
      mapping: v.optional(columnMapping),
    }),
    (b) => (b.data ? previewFile(b.name ?? '', b.data, b.mapping) : previewText(b.text ?? '', b.fieldSep, b.cardSep)),
  ),
  'import.file': h(
    v.object({
      name: v.string(500),
      data: v.bytes(IMPORT_LIMITS.fileBytes),
      deckId: v.optional(v.id),
      deckName: v.optional(v.string(200)),
      language: v.optional(v.nullable(v.string(20))),
      mapping: v.optional(columnMapping),
      ankiHistory: v.optional(v.boolean),
    }),
    ({ name, data, deckId, deckName, language, mapping, ankiHistory }) => {
      const res = importFile(name, mapFile(name, data, mapping), {
        deckId,
        deckName: deckName || undefined,
        language,
        ankiHistory,
      });
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
      const res = importPasted(b.text ?? '', {
        ...b,
        deckName: b.deckName || 'Pasted cards',
        language: b.language || null,
      });
      chooseDeck(res.deck.id);
      return res;
    },
  ),
  /** Is AnkiConnect answering on this computer, and which decks does Anki have (with card counts)? */
  'import.ankiInfo': h(v.none, async () => {
    const ankiState = await ankiProbe();
    const decks = ankiState === 'ready' ? await ankiDecks().catch(() => [] as AnkiDeck[]) : [];
    return { ...importStatus, anki: ankiState === 'ready', ankiState, ankiDecks: decks };
  }),
  'import.anki': h(
    v.optional(
      v.object({
        sources: v.optional(v.array(v.string(500), 500)),
        source: v.optional(v.string(500)),
        deckName: v.optional(v.string(200)),
      }),
    ),
    async (b) => {
      if (importStatus.running) return { started: false };
      if (!(await ankiAvailable()))
        throw new AppError(
          'anki_unreachable',
          'Anki is not reachable. Open Anki (with the AnkiConnect add-on) and try again.',
        );
      void runAnkiImport(b?.sources ?? (b?.source ? [b.source] : undefined), b?.deckName || undefined);
      return { started: true };
    },
  ),
  'import.status': h(v.none, async () => ({ ...importStatus, anki: await ankiAvailable() })),
  /** The deck gallery: goes online only when the user opens it (principle 4). */
  'gallery.list': h(v.none, () => loadGallery()),
  /** Install a deck from the last gallery list: checked against its SHA-256, then imported as an untrusted file. */
  'gallery.install': h(v.object({ id: v.string(80) }), async ({ id }) => {
    const { deck, data } = await downloadGalleryDeck(id);
    const res = importFile(`${deck.id}.lernpack`, data, { deckName: deck.title, language: deck.language });
    chooseDeck(res.deck.id);
    return res;
  }),
  'media.upload': h(v.object({ name: v.string(500), data: v.bytes(50 * MB) }), ({ name, data }) => {
    if (!mediaKind(name)) throw new AppError('unsupported_media', 'Unsupported media type');
    return { file: storeMedia(name, data), kind: mediaKind(name) };
  }),
  /** A recording made in the card editor (Opus in WebM or Ogg). The engine checks the bytes and the length. */
  'media.record': h(v.object({ data: v.bytes(2 * RECORDING_MAX_BYTES) }), ({ data }) => ({
    file: saveRecording(data),
  })),

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
  /* ── Teach-back (#208): explain a mastered tag, then compare with its key points. Nothing is saved. ── */
  'teachback.topics': h(v.none, () => teachBackTopics()),
  'teachback.points': h(v.object({ tag: v.string(100) }), ({ tag }) => teachBackPoints(tag)),
  /** Practise the cards behind the missed points: a practice session, so the schedule stays as it is. */
  'teachback.practice': h(v.object({ ids: v.array(v.id, TEACH_POINTS_MAX) }), ({ ids }) => {
    if (!ids.length) throw new AppError('invalid_input', 'No cards to practise');
    return planSession('mini', getDb(), new Date(), undefined, { practice: true, cards: ids });
  }),
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
      level: v.optional(v.oneOf(...LEVELS)),
      easy: v.optional(v.boolean),
    }),
    (a) => recordAttempt(a as Attempt),
  ),
  'attempt.override': h(v.object({ itemId: v.id }), ({ itemId }) => overrideToCorrect(itemId)),
  /** How sure the learner was of their last answer to a card (#205). Stored only; never changes the schedule. */
  'attempt.confidence': h(
    v.object({ sessionId: v.string(100), itemId: v.id, confidence: v.int(1, 5) }),
    ({ sessionId, itemId, confidence }) => rateConfidence(sessionId, itemId, confidence),
  ),
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
    // With how yesterday's "Will you know this tomorrow?" guesses held up, once their cards came back (#205).
    // And the two cards mixed up most, once they were mixed up often enough to offer a compare card (#200).
    (f) => ({ ...finishSession(f), tomorrowCheck: reportTomorrowCheck(), twinOffer: twinOffer() }),
  ),
  /** Add the compare card for a confusion pair, with the learner's own answer as its back (#200). */
  'confusions.twin': h(v.object({ a: v.id, b: v.id, answer: v.string(ANSWER_MAX) }), ({ a, b, answer }) =>
    makeTwin(a, b, answer),
  ),
  /** "Not now": the compare card for this pair is not offered again. */
  'confusions.dismiss': h(v.object({ a: v.id, b: v.id }), ({ a, b }) => dismissTwin(a, b)),
  /** "Will you know this tomorrow?" answers for today's new cards (#205). Stored only; no schedule change. */
  'tomorrow.save': h(
    v.object({
      answers: v.array(v.object({ itemId: v.id, answer: v.oneOf(...TOMORROW_ANSWERS) }), TOMORROW_MAX),
    }),
    ({ answers }) => saveTomorrowCheck(answers),
  ),
  /** Exam simulator: questions from one deck, with the deck's exam settings. */
  'exam.start': h(v.object({ deckId: v.id }), ({ deckId }) => {
    if (!getDeck(deckId)) throw new AppError('deck_not_found', 'Deck not found');
    const exam = buildExam(deckId, getDb());
    exams.set(exam.id, exam);
    for (const id of [...exams.keys()].slice(0, -5)) exams.delete(id);
    return exam;
  }),
  /** Hand an exam in: scored by topic. Tutor answers count toward reviews; timed ones are practice. */
  'exam.submit': h(
    v.object({
      examId: v.string(100),
      mode: v.oneOf(...EXAM_MODES),
      answers: v.array(v.object({ itemId: v.id, chosen: v.array(v.number, 20), ms: v.number }), 200),
    }),
    ({ examId, mode, answers }) => {
      const exam = exams.get(examId);
      if (!exam) throw new AppError('exam_not_found', 'Exam not found');
      exams.delete(examId);
      return recordExam(exam.id, exam.questions, answers, exam.settings.passMark, mode, getDb());
    },
  ),

  /* ── Progress ── */
  'stats.get': h(v.none, () => ({ ...stats(), achievements: [...ACHIEVEMENTS] })),
  'summary.today': h(v.none, () => dailySummary()),
  /** The Progress screen: per-deck learned vs remaining, pace and forecast, study days, retention, hardest cards. */
  'progress.get': h(v.none, () => journey()),
  /** For the desktop reminder (main process): is it on, when, and did you already study today? */
  'reminder.status': h(v.none, () => {
    const s = getSettings();
    return {
      enabled: s.reminder,
      time: s.reminderTime,
      launchAtLogin: s.launchAtLogin,
      language: s.uiLanguage,
      plan: studyPlanOf(s),
      studiedToday: studiedToday(),
    };
  }),
  /** The hour you usually start studying ("HH:00"), from local sessions only, or null without a clear pattern. */
  'plan.suggestTime': h(v.none, () => ({ time: usualStudyTime(recentSessionStarts(getDb())) })),
  /** A copy of the database in backups/: "Back up now", and before an app update is installed. */
  'backup.create': h(v.optional(v.object({ reason: v.optional(v.oneOf('update')) })), (input) => ({
    file: basename(backupAppDb(undefined, input?.reason === 'update' ? 'before-update' : undefined)),
  })),
  /** Every backup with its date and how many decks, cards and answers it holds. */
  'backup.list': h(v.none, () => listBackups()),
  /** Put a backup back. The current data is backed up first, so this can be undone. */
  'backup.restore': h(v.object({ file: v.string(200) }), ({ file }) => restoreBackup(file)),
  /** Everything (database, media, daily summaries) as one zip. */
  'data.export': h(v.none, () => exportAllData()),
  /** Replace all data with a zip from data.export. The current data is backed up first. */
  'data.import': h(v.object({ data: v.bytes(500 * MB) }), ({ data }) => importAllData(data)),
  /** Delete all data and start empty. The window asks the user to type a word first; a last backup is kept. */
  'data.deleteAll': h(v.object({ confirm: v.oneOf('delete-all-data') }), () => deleteAllData()),
  /** For Settings: the version, licence and where the data lives (read only). */
  'app.info': h(v.none, () => ({
    version: pkg.version,
    lastSeenVersion: lastSeenVersion(getDb()),
    licence: pkg.license,
    dataDir: dataDir(),
    backupsDir: join(dataDir(), 'backups'),
    assistant: assistantCommand(),
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
    next.reminder = next.reminder === true;
    next.reminderTime = cleanReminderTime(next.reminderTime);
    next.planAfter = cleanPlanText(next.planAfter);
    next.planMinutes = cleanPlanMinutes(next.planMinutes);
    next.planBackup = cleanPlanText(next.planBackup);
    next.habitNote = next.habitNote !== false;
    next.launchAtLogin = next.launchAtLogin === true;
    next.aiAssistant = next.aiAssistant === true;
    next.remoteMedia = next.remoteMedia === true;
    next.confidence = next.confidence !== false;
    next.calm = next.calm === true;
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
