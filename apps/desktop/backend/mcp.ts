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
import { InvalidInput, v, type Check } from './validate';
import pkg from '../package.json';

/* ── Inputs: one definition gives both the check and the JSON Schema the assistant sees ── */

type Json = Record<string, unknown>;
type Field<T> = { check: Check<T>; schema: Json; optional?: true };
type Shape = Record<string, Field<unknown>>;
type Input<S extends Shape> = { [K in keyof S]: S[K] extends Field<infer T> ? T : never };

const int =
  (min: number, max: number): Check<number> =>
  (value, path = '') => {
    const n = v.number(value, path);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new InvalidInput(`${path || 'input'} must be a whole number from ${min} to ${max}`);
    return n;
  };
const date: Check<string> = (value, path = '') => {
  const s = v.string(10)(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new InvalidInput(`${path || 'input'} must be a date (YYYY-MM-DD)`);
  return s;
};

export const f = {
  id: (description: string): Field<number> => ({ check: v.id, schema: { type: 'integer', minimum: 1, description } }),
  int: (min: number, max: number, description: string): Field<number> => ({
    check: int(min, max),
    schema: { type: 'integer', minimum: min, maximum: max, description },
  }),
  text: (max: number, description: string): Field<string> => ({
    check: v.string(max),
    schema: { type: 'string', maxLength: max, description },
  }),
  date: (description: string): Field<string> => ({
    check: date,
    schema: { type: 'string', format: 'date', description },
  }),
  oneOf: <T extends string>(options: readonly T[], description: string): Field<T> => ({
    check: v.oneOf(...options),
    schema: { type: 'string', enum: options, description },
  }),
  list: <T>(item: Field<T>, max: number, description: string): Field<T[]> => ({
    check: v.array(item.check, max),
    schema: { type: 'array', items: item.schema, maxItems: max, description },
  }),
  object: <S extends Shape>(shape: S, description?: string): Field<Input<S>> => ({
    check: v.object(Object.fromEntries(Object.entries(shape).map(([k, x]) => [k, x.check]))) as Check<Input<S>>,
    schema: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(shape).map(([k, x]) => [k, x.schema])),
      required: Object.keys(shape).filter((k) => !shape[k].optional),
      additionalProperties: false,
      ...(description && { description }),
    },
  }),
  optional: <T>(x: Field<T>): Field<T | undefined> => ({
    check: v.optional(x.check),
    schema: x.schema,
    optional: true,
  }),
};

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
        "LernLab is the user's flashcard app. These tools read their decks, cards and study history. Quizzing in the chat is never recorded and never changes their schedule.",
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
