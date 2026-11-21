// The AI requests screen (#148): the user's edits to a proposal, and what is sent back when they accept it.
import type { AiRequest, ProposedCard } from '@lernlab/core/airequests';

/** What the user can change before accepting: the deck name (new decks), each card, and which cards to keep. */
export type Draft = { deckName: string; cards: ProposedCard[]; keep: boolean[] };

export function draftOf(r: AiRequest): Draft {
  const cards = 'cards' in r ? r.cards : [];
  return { deckName: r.kind === 'create_deck' ? r.deck.name : '', cards, keep: cards.map(() => true) };
}

/** Cards the user keeps. */
export const keptCards = (d: Draft) => d.cards.filter((_, i) => d.keep[i]);

/** The request body to accept, with the user's edits. Null when there is nothing to accept. */
export function acceptedBody(r: AiRequest, d: Draft): Record<string, unknown> | null {
  const cards = keptCards(d).filter((c) => c.front.trim());
  if (r.kind === 'create_deck') {
    if (!d.deckName.trim() || !cards.length) return null;
    return { deck: { ...r.deck, name: d.deckName.trim() }, cards, note: r.note };
  }
  return cards.length ? { deckId: r.deckId, cards, note: r.note } : null;
}

export const editCard = (d: Draft, i: number, patch: Partial<ProposedCard>): Draft => ({
  ...d,
  cards: d.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)),
});

export const toggleCard = (d: Draft, i: number): Draft => ({ ...d, keep: d.keep.map((k, j) => (j === i ? !k : k)) });
