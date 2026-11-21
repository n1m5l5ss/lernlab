// LernLab as an MCP server (#148): the tools an AI assistant the user connects may call. The assistant's
// process opens the database read-only (openAppDbReadonly), once per call, so nothing here can change the
// data. Every call is refused while Settings → "AI assistant" is off. Inputs are checked with the same
// validators as the window's requests (validate.ts); each tool also publishes them as JSON Schema.
// Tool descriptions are for the assistant, not the user, so they are English and not in locales/.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { DB } from '@lernlab/core/db';
import { getSettings } from '@lernlab/core/learn';
import { UserError } from '@lernlab/core/errors';
import { CARD_STATES, findCards } from '@lernlab/core/browse';
import {
  cardDetails,
  deckOverview,
  learnerOverview,
  LIST_MAX,
  PERIODS,
  periodRange,
  periodStats,
  quizCards,
  sessionHistory,
  weakCards,
} from '@lernlab/core/assistant';
import { getDeck } from '@lernlab/core/library';
import { InvalidInput } from './validate';
import { f, type Input, type Json, type Shape } from './fields';
import { addAiRequest, listAiRequests } from '@lernlab/storage-sqlite/airequests';
import type { AiRequestBody } from '@lernlab/core/airequests';
import { asRequest, checkBody, REQUEST_BODIES } from './ai-requests';
import pkg from '../package.json';

/* ── Tools ── */

export type ToolContext = { db: DB; now: Date };
type Tool<S extends Shape> = { description: string; input: S; run: (input: Input<S>, ctx: ToolContext) => unknown };
const tool = <S extends Shape>(description: string, input: S, run: Tool<S>['run']): Tool<S> => ({
  description,
  input,
  run,
});

const deckFilter = f.optional(f.id('Only this deck (an id from list_decks). Leave out for every deck.'));
const period = {
  period: f.oneOf(PERIODS, 'today, a single day, a week (Monday to Sunday), a month, a year, or all time.'),
  date: f.optional(f.date('A day in the period (YYYY-MM-DD). Required for "day"; otherwise defaults to today.')),
};
const needDeck = (d: DB, id: number | undefined) => {
  if (id !== undefined && !getDeck(id, d)) throw new UserError('deck_not_found', `There is no deck with id ${id}.`);
};
const range = (d: DB, p: { period: (typeof PERIODS)[number]; date?: string }, now: Date) => {
  try {
    return periodRange(p.period, p.date, d, now);
  } catch (e) {
    throw new InvalidInput((e as Error).message);
  }
};

/** Save a proposal for the user to review. It is checked again with the same validators before saving. */
function propose(body: AiRequestBody) {
  const checked = checkBody(body.kind, body);
  const { id } = addAiRequest(checked as unknown as Record<string, unknown>);
  return {
    requestId: id,
    status: 'waiting',
    message:
      'Nothing has changed yet. The user reviews this in LernLab → AI requests and can edit, accept or decline it.',
  };
}
function summary(r: AiRequestBody): string {
  switch (r.kind) {
    case 'create_deck':
      return `New deck "${r.deck.name}" with ${r.cards.length} cards`;
    case 'add_cards':
      return `${r.cards.length} cards for deck ${r.deckId}`;
    case 'edit_card':
      return `Fix card ${r.cardId}: ${Object.keys(r.changes).join(', ')}`;
    case 'merge_cards':
      return `Merge cards ${r.mergeIds.join(', ')} into card ${r.keepId}`;
    case 'organise_cards':
      return `${r.action.kind} ${r.cardIds.length} cards`;
    case 'set_goals':
      return `Goals: ${[
        r.dailyGoalSessions !== undefined && `${r.dailyGoalSessions} sessions a day`,
        r.newPerDay !== undefined && `${r.newPerDay} new cards a day`,
      ]
        .filter(Boolean)
        .join(', ')}`;
    case 'study_plan':
      return `Study plan for deck ${r.deckId}: ${Object.keys(r.plan).join(', ')}`;
    case 'export_deck':
      return `Export deck ${r.deckId} as ${r.format}`;
  }
}
const needCards = (d: DB, ids: number[]) => {
  for (const id of ids)
    if (!d.prepare('SELECT 1 FROM items WHERE id = ?').get(id))
      throw new UserError('card_not_found', `There is no card with id ${id}.`);
};

export const TOOLS = {
  get_overview: tool(
    "The learner at a glance: streak (and freezes left), today's sessions against the daily goal, total XP, the languages they study, the interface language, their settings, and their last 10 mock exams (score, pass mark, score by topic).",
    {},
    (_, { db, now }) => ({ ...learnerOverview(db, now), decks: deckOverview(db, now).length }),
  ),
  list_decks: tool(
    'Every deck with its id, language, description, number of cards, new cards, learned cards, cards due today, new cards left today, goal and exam date.',
    {},
    (_, { db, now }) => deckOverview(db, now),
  ),
  get_due: tool(
    'How many cards are due today and how many new cards are left today, in total and per deck.',
    { deckId: deckFilter },
    ({ deckId }, { db, now }) => {
      needDeck(db, deckId);
      const decks = deckOverview(db, now).filter((dk) => !deckId || dk.id === deckId);
      return {
        dueToday: decks.reduce((n, dk) => n + dk.dueToday, 0),
        newToday: decks.reduce((n, dk) => n + dk.newToday, 0),
        decks: decks.map(({ id, name, dueToday, newToday }) => ({ id, name, dueToday, newToday })),
      };
    },
  ),
  search_cards: tool(
    'Find cards by text (front, back, example, tags), tag and state. Returns short rows; use get_card for everything about one card.',
    {
      deckId: deckFilter,
      query: f.optional(f.text(500, 'Text to look for.')),
      tag: f.optional(f.text(200, 'Only cards with this tag.')),
      state: f.optional(f.oneOf(CARD_STATES, 'Only new, learning, known, suspended or starred cards.')),
      limit: f.optional(f.int(1, LIST_MAX, `How many rows (default 50, at most ${LIST_MAX}).`)),
      offset: f.optional(f.int(0, 100_000, 'Skip this many rows (for the next page).')),
    },
    ({ deckId, query, tag, state, limit = 50, offset = 0 }, { db }) => {
      const found = findCards({ deckId, q: query, tag, state }, db);
      return { total: found.total, offset, cards: found.rows.slice(offset, offset + limit) };
    },
  ),
  get_card: tool(
    'Everything about one card: fields, tags, star, suspended, media files, its memory forecast (next due date and the chance of recalling it now, from FSRS), and the exact wrong answers the learner gave.',
    { id: f.id('The card id (from search_cards).') },
    ({ id }, { db, now }) => {
      const card = cardDetails(db, id, now);
      if (!card) throw new UserError('card_not_found', `There is no card with id ${id}.`);
      return card;
    },
  ),
  get_stats: tool(
    'Study numbers for a period: real reviews, retention (share of reviews recalled), all answers and accuracy (games included), practice answers, minutes studied, sessions, study days, XP, cards introduced and cards learned, by exercise format, day by day (month by month past a year).',
    { ...period, deckId: deckFilter },
    ({ deckId, ...p }, { db, now }) => {
      needDeck(db, deckId);
      return periodStats(db, range(db, p, now), deckId);
    },
  ),
  get_session_history: tool(
    'Study sessions in a period, newest first: when, how long, XP, and which exercise formats (modes and games) were used with how many correct answers.',
    { ...period, limit: f.optional(f.int(1, LIST_MAX, 'How many sessions (default 50).')) },
    ({ limit, ...p }, { db, now }) => sessionHistory(db, range(db, p, now), limit),
  ),
  get_weak_cards: tool(
    'The hardest cards: most lapses (forgotten after learning), then most wrong answers, with accuracy, the chance of recalling each now, and whether it is a leech.',
    { deckId: deckFilter, limit: f.optional(f.int(1, LIST_MAX, 'How many cards (default 30).')) },
    ({ deckId, limit }, { db, now }) => {
      needDeck(db, deckId);
      return weakCards(db, { deckId, limit }, now);
    },
  ),
  quiz_cards: tool(
    'Cards to quiz the learner on in this chat. Nothing is recorded: quizzing in the chat never changes the learning schedule.',
    {
      deckId: deckFilter,
      from: f.oneOf(['due', 'weak', 'random'] as const, 'Due cards, the hardest cards, or any cards.'),
      count: f.int(1, 50, 'How many cards.'),
    },
    (input, { db, now }) => {
      needDeck(db, input.deckId);
      return { recorded: false, cards: quizCards(db, input, now) };
    },
  ),
  propose_new_deck: tool(
    'Propose a new deck with cards, e.g. made from a PDF, a web page or notes the user gave you. Nothing is saved: the user reviews, edits and accepts it in LernLab → AI requests. Accepted cards start as new cards.',
    REQUEST_BODIES.create_deck,
    (input) => propose({ kind: 'create_deck', ...input }),
  ),
  propose_cards: tool(
    'Propose cards to add to an existing deck. Nothing is saved until the user accepts them in LernLab → AI requests. Accepted cards start as new cards.',
    REQUEST_BODIES.add_cards,
    (input, { db }) => {
      needDeck(db, input.deckId);
      return propose({ kind: 'add_cards', ...input });
    },
  ),
  propose_card_fix: tool(
    'Propose a fix to one card (a typo, a clearer answer, a better example, tags). Only the fields you give change; its learning progress stays. Nothing changes until the user accepts it in LernLab → AI requests.',
    REQUEST_BODIES.edit_card,
    (input, { db }) => {
      needCards(db, [input.cardId]);
      if (!Object.keys(input.changes).length) throw new InvalidInput('changes must change at least one field');
      return propose({ kind: 'edit_card', ...input });
    },
  ),
  propose_merge: tool(
    'Propose merging duplicate cards: keep one (optionally with changes); the others are suspended and tagged "merged" (never deleted). Nothing changes until the user accepts it in LernLab → AI requests.',
    REQUEST_BODIES.merge_cards,
    (input, { db }) => {
      needCards(db, [input.keepId, ...input.mergeIds]);
      if (!input.mergeIds.some((id) => id !== input.keepId)) throw new InvalidInput('mergeIds must name other cards');
      return propose({ kind: 'merge_cards', ...input });
    },
  ),
  propose_organise: tool(
    'Propose tagging, untagging, starring, unstarring, suspending, unsuspending or moving cards to another deck. Nothing changes until the user accepts it in LernLab → AI requests.',
    REQUEST_BODIES.organise_cards,
    (input, { db }) => {
      needCards(db, input.cardIds);
      if (input.action.kind === 'move') needDeck(db, input.action.deckId);
      return propose({ kind: 'organise_cards', ...input });
    },
  ),
  propose_goals: tool(
    'Propose a new daily goal (sessions a day) and/or new cards a day for all decks. Nothing changes until the user accepts it in LernLab → AI requests.',
    REQUEST_BODIES.set_goals,
    (input) => {
      if (input.dailyGoalSessions === undefined && input.newPerDay === undefined)
        throw new InvalidInput('give dailyGoalSessions or newPerDay');
      return propose({ kind: 'set_goals', ...input });
    },
  ),
  propose_study_plan: tool(
    'Propose a study plan for one deck toward an exam or deadline: the exam date, a goal (how many cards to know by then) and new cards a day. Use get_due, get_stats and list_decks to make it realistic. Nothing changes until the user accepts it in LernLab → AI requests.',
    REQUEST_BODIES.study_plan,
    (input, { db }) => {
      needDeck(db, input.deckId);
      if (!Object.keys(input.plan).length) throw new InvalidInput('plan must set at least one field');
      return propose({ kind: 'study_plan', ...input });
    },
  ),
  propose_export: tool(
    'Propose exporting a deck to a file. When the user accepts in LernLab → AI requests, LernLab asks them where to save it. You never receive the file.',
    REQUEST_BODIES.export_deck,
    (input, { db }) => {
      needDeck(db, input.deckId);
      return propose({ kind: 'export_deck', ...input });
    },
  ),
  list_requests: tool(
    'Your proposals that are still waiting for the user in LernLab → AI requests (accepted or declined ones are gone).',
    {},
    () =>
      listAiRequests()
        .map(asRequest)
        .filter((r) => r !== null)
        .map((r) => ({ id: r.id, kind: r.kind, createdAt: r.createdAt, note: r.note ?? null, summary: summary(r) })),
  ),
};

export type ToolName = keyof typeof TOOLS;
const isTool = (name: unknown): name is ToolName => typeof name === 'string' && Object.hasOwn(TOOLS, name);

/** Tools as MCP lists them. */
export const toolList = () =>
  Object.entries(TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
    inputSchema: f.object(t.input as Shape).schema as { type: 'object' } & Json,
  }));

export type McpDeps = {
  /** A read-only connection to the app database, closed after each call. */
  openDb: () => DB;
  now?: () => Date;
};

export type ToolResult = { ok: true; value: unknown } | { ok: false; code: string; message: string };

export const OFF_MESSAGE =
  'The AI assistant connection is turned off in LernLab. The user can turn it on in LernLab → Settings → AI assistant.';

/** Check and run one tool. Never throws: every failure is a result the assistant can read. */
export async function callTool(name: unknown, args: unknown, deps: McpDeps): Promise<ToolResult> {
  if (!isTool(name)) return { ok: false, code: 'unknown_tool', message: `There is no tool called ${String(name)}.` };
  let db: DB | null = null;
  try {
    db = deps.openDb();
    if (!getSettings(db).aiAssistant) return { ok: false, code: 'assistant_off', message: OFF_MESSAGE };
    const t = TOOLS[name] as unknown as Tool<Shape>;
    const input = f.object(t.input).check(args ?? {}, '');
    return { ok: true, value: await t.run(input, { db, now: deps.now?.() ?? new Date() }) };
  } catch (e) {
    const code = e instanceof UserError || e instanceof InvalidInput ? e.code : 'failed';
    return { ok: false, code, message: (e as Error)?.message ?? String(e) };
  } finally {
    db?.close();
  }
}

/** The MCP server: lists the tools and runs them. Connect it to a transport (stdio, or the desktop relay). */
export function createMcpServer(deps: McpDeps): Server {
  const server = new Server(
    { name: 'lernlab', title: 'LernLab', version: pkg.version },
    {
      capabilities: { tools: {} },
      instructions:
        "LernLab is the user's flashcard app. These tools read their decks, cards and study history. Changes are only proposals: the user accepts or declines each one in LernLab. Quizzing in the chat is never recorded and never changes their schedule.",
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: toolList() }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const r = await callTool(req.params.name, req.params.arguments, deps);
    return r.ok
      ? { content: [{ type: 'text', text: JSON.stringify(r.value, null, 1) }] }
      : { isError: true, content: [{ type: 'text', text: `${r.code}: ${r.message}` }] };
  });
  return server;
}
