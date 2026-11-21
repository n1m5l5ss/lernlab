// AI requests (#148): changes an AI assistant proposed, applied only when the user accepts them in the app.
// The shapes are checked before they get here (apps/desktop/backend/ai-requests.ts). Card text goes through
// upsertCards, so it is sanitised exactly like an imported deck, and new cards start new (no schedule).
import type { DB } from './db';
import { getDb } from './db';
import { createDeck, deckByName, getDeck, stableId, upsertCards, type NormalizedCard } from './library';
import { UserError } from './errors';

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
  type?: 'basic' | 'cloze' | 'mcq';
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
  | { kind: 'add_cards'; deckId: number; cards: ProposedCard[]; note?: string };

export type AiRequestKind = AiRequestBody['kind'];
export const AI_REQUEST_KINDS: AiRequestKind[] = ['create_deck', 'add_cards'];
/** At most this many cards in one request. */
export const AI_CARDS_MAX = 500;

/** A request as it waits for the user. */
export type AiRequest = AiRequestBody & { id: string; createdAt: string };

/** What accepting did, for the confirmation and for the assistant's next look. */
export type AiResult = { deckId: number; added: number; updated: number; skipped: number };

const toCard = (requestId: string, deckName: string, c: ProposedCard, i: number): NormalizedCard => ({
  ...c,
  type: c.type === 'basic' ? undefined : c.type,
  // One id per request and position: accepting the same request twice can't add the cards twice.
  sourceId: stableId(`${deckName}\u0000ai\u0000${requestId}\u0000${i}`),
});

/** Apply an accepted request (as the user may have edited it). */
export function applyAiRequest(req: AiRequest, d: DB = getDb()): AiResult {
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
  const deck = getDeck(req.deckId, d);
  if (!deck) throw new UserError('deck_not_found', 'Deck not found');
  const r = upsertCards(
    deck,
    req.cards.map((c, i) => toCard(req.id, deck.name, c, i)),
    d,
  );
  return { deckId: deck.id, added: r.added, updated: r.updated, skipped: r.skipped.length };
}
