// The AI requests screen (#148): the user's edits to a proposal, and what is sent back when they accept it.
import { requestCardIds, type AiRequest, type CardChanges, type ProposedCard } from '@lernlab/core/airequests';

/** Fields of a card fix the screen can show, in this order. */
export const CHANGE_FIELDS = [
  'front',
  'back',
  'example',
  'exampleTranslation',
  'explanation',
  'notes',
  'category',
  'tags',
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];

/**
 * What the user can change before accepting: the deck name (new decks), each proposed card and which to keep,
 * the proposed changes to an existing card (fixes and merges), and which existing cards a merge or tidy-up
 * touches (`ids`, with `keepIds` saying which are still chosen).
 */
export type Draft = {
  deckName: string;
  cards: ProposedCard[];
  keep: boolean[];
  /** Proposed field changes as typed (tags as words separated by spaces). */
  changes: Partial<Record<ChangeField, string>>;
  ids: number[];
  keepIds: boolean[];
};

export function draftOf(r: AiRequest): Draft {
  const cards = 'cards' in r ? r.cards : [];
  const changes = r.kind === 'edit_card' || r.kind === 'merge_cards' ? (r.changes ?? {}) : {};
  // For a merge the kept card is shown on its own; `ids` are the duplicates.
  const ids = r.kind === 'merge_cards' ? requestCardIds(r).slice(1) : r.kind === 'organise_cards' ? r.cardIds : [];
  return {
    deckName: r.kind === 'create_deck' ? r.deck.name : '',
    cards,
    keep: cards.map(() => true),
    changes: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, fieldText(v)])),
    ids,
    keepIds: ids.map(() => true),
  };
}

/** Cards the user keeps. */
export const keptCards = (d: Draft) => d.cards.filter((_, i) => d.keep[i]);
/** Existing cards still chosen for a merge or tidy-up. */
export const keptIds = (d: Draft) => d.ids.filter((_, i) => d.keepIds[i]);

/** The changed fields, in order. A front or back left empty makes the fix invalid (null). */
function cleanChanges(text: Draft['changes']): CardChanges | null {
  const out: CardChanges = {};
  for (const field of CHANGE_FIELDS) {
    const value = text[field];
    if (value === undefined) continue;
    if (field === 'tags') out.tags = value.split(/\s+/).filter(Boolean);
    else if ((field === 'front' || field === 'back') && !value.trim()) return null;
    else out[field] = value;
  }
  return out;
}

/** The request body to accept, with the user's edits. Null when there is nothing to accept. */
export function acceptedBody(r: AiRequest, d: Draft): Record<string, unknown> | null {
  if (r.kind === 'edit_card') {
    const changes = cleanChanges(d.changes);
    return changes && Object.keys(changes).length ? { cardId: r.cardId, changes, note: r.note } : null;
  }
  if (r.kind === 'merge_cards') {
    const changes = cleanChanges(d.changes);
    const mergeIds = keptIds(d);
    if (!changes || !mergeIds.length) return null;
    return { keepId: r.keepId, mergeIds, changes: Object.keys(changes).length ? changes : undefined, note: r.note };
  }
  if (r.kind === 'organise_cards') {
    const cardIds = keptIds(d);
    return cardIds.length ? { cardIds, action: r.action, note: r.note } : null;
  }
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
export const toggleId = (d: Draft, i: number): Draft => ({
  ...d,
  keepIds: d.keepIds.map((k, j) => (j === i ? !k : k)),
});

/** Change one proposed field as typed. */
export const editChange = (d: Draft, field: ChangeField, text: string): Draft => ({
  ...d,
  changes: { ...d.changes, [field]: text },
});

/** A field's value as text for an input. */
export const fieldText = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(' ') : (value ?? '');
