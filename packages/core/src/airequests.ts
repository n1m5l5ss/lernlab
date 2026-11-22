// AI requests (#148): changes an AI assistant proposed, applied only when the user accepts them in the app.
// The shapes are checked before they get here (apps/desktop/backend/ai-requests.ts). Card text goes through
// upsertCards, so it is sanitised exactly like an imported deck, and new cards start new (no schedule).
import type { DB } from './db';
import { getDb, setMeta } from './db';
import {
  cleanDeckSettings,
  createDeck,
  deckByName,
  getDeck,
  stableId,
  updateDeck,
  upsertCards,
  type DeckSettings,
  type NormalizedCard,
} from './library';
import { getSettings } from './learn';
import { bulkCards, type BulkAction } from './browse';
import { rowToCard } from './exporter';
import { UserError } from './errors';
import { stripHtml } from './text';

/** A card the assistant proposes. Text may use the same light formatting as imported decks. */
export type ProposedCard = {
  front: string;
  back: string;
  example?: string;
  exampleTranslation?: string;
  explanation?: string;
  notes?: string;
  tags?: string[];
  category?: string;
  type?: 'basic' | 'cloze' | 'mcq' | 'twin';
  /** twin (compare) cards: the second thing, shown beside the front (twin.ts). */
  twin?: string;
  choices?: string;
  correct?: string;
};

export type AiRequestBody =
  | {
      kind: 'create_deck';
      deck: { name: string; language?: string; description?: string };
      cards: ProposedCard[];
      note?: string;
    }
  | { kind: 'add_cards'; deckId: number; cards: ProposedCard[]; note?: string }
  | { kind: 'edit_card'; cardId: number; changes: CardChanges; note?: string }
  /** Keep one card (with changes); the others are suspended and tagged "merged", never deleted. */
  | { kind: 'merge_cards'; keepId: number; mergeIds: number[]; changes?: CardChanges; note?: string }
  | { kind: 'organise_cards'; cardIds: number[]; action: OrganiseAction; note?: string }
  /** The daily goal (sessions a day) and new cards a day, for every deck. */
  | { kind: 'set_goals'; dailyGoalSessions?: number; newPerDay?: number; note?: string }
  /** A deck's study plan: its exam date, goal and new cards a day. */
  | { kind: 'study_plan'; deckId: number; plan: StudyPlan; note?: string }
  /** Export a deck: the window saves the file where the user chooses; nothing in LernLab changes. */
  | { kind: 'export_deck'; deckId: number; format: 'csv' | 'lernpack'; note?: string };

/** The parts of a deck's settings a study plan sets. Left out stays as it is. */
export type StudyPlan = Partial<Pick<DeckSettings, 'examDate' | 'newPerDay'>> & {
  goal?: { label: string; words: number };
};
/** Limits the Settings screen also uses. */
export const GOAL_SESSIONS = { min: 1, max: 5 } as const;
export const NEW_PER_DAY_MAX = 100;

/** Fields an edit may change. Anything left out stays as it is. */
export type CardChanges = Partial<Omit<ProposedCard, 'type' | 'choices' | 'correct'>>;
/** Everything the card browser's bulk actions do, except deleting. */
export type OrganiseAction = Exclude<BulkAction, { kind: 'delete' }>;
export const ORGANISE_KINDS = ['tag', 'untag', 'star', 'unstar', 'suspend', 'unsuspend', 'move'] as const;
/** The tag merged duplicates get, so they are easy to find (and unsuspend) in the card browser. */
export const MERGED_TAG = 'merged';

export type AiRequestKind = AiRequestBody['kind'];
export const AI_REQUEST_KINDS: AiRequestKind[] = [
  'create_deck',
  'add_cards',
  'edit_card',
  'merge_cards',
  'organise_cards',
  'set_goals',
  'study_plan',
  'export_deck',
];
/** At most this many cards in one request. */
export const AI_CARDS_MAX = 500;

/** A request as it waits for the user. */
export type AiRequest = AiRequestBody & { id: string; createdAt: string };

/** What accepting did, for the confirmation: cards added, changed (edited, merged or organised) and skipped. */
export type AiResult = { deckId: number | null; added: number; updated: number; skipped: number };

/** Save changes to one card, keeping everything else on it and its progress. */
function editCard(id: number, changes: CardChanges, d: DB) {
  const row = d.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!row) throw new UserError('card_not_found', 'Card not found');
  const deck = getDeck(Number(row.deck_id), d)!;
  const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
  upsertCards(deck, [{ ...rowToCard(row, deck.name), ...defined, sourceId: id }], d);
  return deck.id;
}

const needCards = (ids: number[], d: DB) => {
  const found = ids.filter((id) => d.prepare('SELECT 1 FROM items WHERE id = ?').get(id));
  if (found.length !== ids.length) throw new UserError('card_not_found', 'Card not found');
};

const toCard = (requestId: string, deckName: string, c: ProposedCard, i: number): NormalizedCard => ({
  ...c,
  type: c.type === 'basic' ? undefined : c.type,
  // One id per request and position: accepting the same request twice can't add the cards twice.
  sourceId: stableId(`${deckName}\u0000ai\u0000${requestId}\u0000${i}`),
});

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

/** Apply an accepted request (as the user may have edited it). */
export function applyAiRequest(req: AiRequest, d: DB = getDb()): AiResult {
  if (req.kind === 'set_goals') {
    const next = { ...getSettings(d) };
    if (req.dailyGoalSessions !== undefined)
      next.dailyGoalSessions = clamp(req.dailyGoalSessions, GOAL_SESSIONS.min, GOAL_SESSIONS.max);
    if (req.newPerDay !== undefined) next.newPerDay = clamp(req.newPerDay, 0, NEW_PER_DAY_MAX);
    setMeta(d, 'settings', next);
    return { deckId: null, added: 0, updated: 0, skipped: 0 };
  }
  if (req.kind === 'study_plan' || req.kind === 'export_deck') {
    if (!getDeck(req.deckId, d)) throw new UserError('deck_not_found', 'Deck not found');
    if (req.kind === 'study_plan') updateDeck(req.deckId, { settings: cleanDeckSettings(req.plan) as DeckSettings }, d);
    return { deckId: req.deckId, added: 0, updated: 0, skipped: 0 };
  }
  if (req.kind === 'create_deck') {
    const name = req.deck.name.trim();
    if (!name) throw new UserError('name_required', 'Name required');
    if (deckByName(name, d)) throw new UserError('deck_exists', `A deck called ${name} already exists.`);
    const deck = createDeck(name, req.deck.language || null, {}, req.deck.description ?? '', d);
    const r = upsertCards(
      deck,
      req.cards.map((c, i) => toCard(req.id, deck.name, c, i)),
      d,
    );
    return { deckId: deck.id, added: r.added, updated: r.updated, skipped: r.skipped.length };
  }
  if (req.kind === 'edit_card')
    return { deckId: editCard(req.cardId, req.changes, d), added: 0, updated: 1, skipped: 0 };
  if (req.kind === 'merge_cards') {
    const others = req.mergeIds.filter((id) => id !== req.keepId);
    needCards([req.keepId, ...others], d);
    // Three steps, each in its own transaction (upsertCards and bulkCards open one).
    const deckId = editCard(req.keepId, req.changes ?? {}, d);
    bulkCards(others, { kind: 'tag', tag: MERGED_TAG }, d);
    bulkCards(others, { kind: 'suspend' }, d);
    return { deckId, added: 0, updated: others.length + 1, skipped: 0 };
  }
  if (req.kind === 'organise_cards') {
    const action = req.action as BulkAction;
    if (action.kind === 'delete') throw new UserError('failed', 'Deleting is not allowed.');
    const n = bulkCards(req.cardIds, action, d);
    return {
      deckId: action.kind === 'move' ? action.deckId : null,
      added: 0,
      updated: n,
      skipped: req.cardIds.length - n,
    };
  }
  const deck = getDeck(req.deckId, d);
  if (!deck) throw new UserError('deck_not_found', 'Deck not found');
  const r = upsertCards(
    deck,
    req.cards.map((c, i) => toCard(req.id, deck.name, c, i)),
    d,
  );
  return { deckId: deck.id, added: r.added, updated: r.updated, skipped: r.skipped.length };
}

/** The existing cards a request is about, in its order (the kept card first for a merge). */
export function requestCardIds(req: AiRequestBody): number[] {
  if (req.kind === 'edit_card') return [req.cardId];
  if (req.kind === 'merge_cards') return [req.keepId, ...req.mergeIds.filter((id) => id !== req.keepId)];
  if (req.kind === 'organise_cards') return req.cardIds;
  return [];
}

/** The settings a goals or study plan request would change, as they are now. */
export function currentGoals(d: DB = getDb()) {
  const s = getSettings(d);
  return { dailyGoalSessions: s.dailyGoalSessions, newPerDay: s.newPerDay };
}

/** A card as it is now, as plain text, so the user can compare it with what the assistant proposes. */
export type CardSnapshot = {
  id: number;
  deckId: number;
  front: string;
  back: string;
  example: string;
  exampleTranslation: string;
  explanation: string;
  notes: string;
  category: string;
  tags: string[];
  suspended: boolean;
  starred: boolean;
};
/** Snapshots for at most this many cards per request: enough to review, light enough to load every few seconds. */
export const SNAPSHOT_MAX = 200;

/** The cards as they are now (missing ones are left out). */
export function cardSnapshots(ids: number[], d: DB = getDb()): CardSnapshot[] {
  const get = d.prepare(
    `SELECT id, deck_id, target, meaning, sentence, sentence_meaning, grammar, notes, category, tags, suspended, starred
     FROM items WHERE id = ?`,
  );
  const text = (v: unknown) => stripHtml(String(v ?? ''));
  const out: CardSnapshot[] = [];
  for (const id of ids.slice(0, SNAPSHOT_MAX)) {
    const r = get.get(id);
    if (!r) continue;
    out.push({
      id,
      deckId: Number(r.deck_id),
      front: text(r.target),
      back: text(r.meaning),
      example: text(r.sentence),
      exampleTranslation: text(r.sentence_meaning),
      explanation: text(r.grammar),
      notes: text(r.notes),
      category: String(r.category ?? ''),
      tags: JSON.parse(String(r.tags ?? '[]')) as string[],
      suspended: !!r.suspended,
      starred: !!r.starred,
    });
  }
  return out;
}
