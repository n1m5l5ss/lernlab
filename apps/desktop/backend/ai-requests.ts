// The shapes of AI requests (#148), checked with the app's validators wherever one arrives: from the assistant
// (MCP tools), from a file in ai-requests/ (anything could have written it) and from the window (the user's edits).
import { AI_CARDS_MAX, type AiRequest, type AiRequestBody, type AiRequestKind } from '@lernlab/core/airequests';
import { isRequestId } from '@lernlab/storage-sqlite/airequests';
import { InvalidInput } from './validate';
import { f, type Shape } from './fields';

const opt = f.optional;

export const proposedCard = f.object({
  front: f.text(2000, 'The question side. Plain text; **bold** and {{c1::cloze}} work as in imported decks.'),
  back: f.text(5000, 'The answer side.'),
  example: opt(f.text(2000, 'An example sentence.')),
  exampleTranslation: opt(f.text(2000, 'Its translation.')),
  explanation: opt(f.text(5000, 'A short explanation shown after answering.')),
  notes: opt(f.text(5000, 'Notes.')),
  tags: opt(f.list(f.text(100, 'One tag, no spaces.'), 20, 'Tags.')),
  category: opt(f.text(100, 'A category for sorting rounds (e.g. der/die/das).')),
  type: opt(f.oneOf(['basic', 'cloze', 'mcq'] as const, 'Card type (default basic).')),
  choices: opt(f.text(2000, 'For mcq: the choices separated by |.')),
  correct: opt(f.text(200, 'For mcq: the correct choice numbers (1-based), separated by |.')),
});
const cards = f.list(proposedCard, AI_CARDS_MAX, `The cards (at most ${AI_CARDS_MAX}).`);
const note = opt(
  f.text(1000, 'Why you propose this, and where it comes from (e.g. the PDF or link). The user sees it.'),
);

/** The body of each kind of request: what the assistant sends, and what the window sends back after edits. */
export const REQUEST_BODIES = {
  create_deck: {
    deck: f.object({
      name: f.text(200, 'The new deck name (must not exist yet).'),
      language: opt(f.text(20, 'Language code of the studied side, e.g. es, de, ja.')),
      description: opt(f.text(2000, 'What the deck is about.')),
    }),
    cards,
    note,
  },
  add_cards: { deckId: f.id('The deck to add to (an id from list_decks).'), cards, note },
} satisfies Record<AiRequestKind, Shape>;

const kindOf = (value: unknown): AiRequestKind => {
  const kind = (value as { kind?: unknown } | null)?.kind;
  if (typeof kind !== 'string' || !Object.hasOwn(REQUEST_BODIES, kind)) throw new InvalidInput('kind is not known');
  return kind as AiRequestKind;
};

/** Check a request body of the given kind (unknown fields are dropped). */
export function checkBody(kind: AiRequestKind, value: unknown): AiRequestBody {
  const shape = REQUEST_BODIES[kind] as Shape;
  return { kind, ...(f.object(shape).check(value, '') as object) } as AiRequestBody;
}

/** Check a stored request: a known kind, a valid id and time, and a valid body. Null when it is not one. */
export function asRequest(value: unknown): AiRequest | null {
  try {
    const r = value as { id?: unknown; createdAt?: unknown };
    if (!isRequestId(r?.id) || typeof r.createdAt !== 'string') return null;
    return { ...checkBody(kindOf(value), value), id: r.id, createdAt: r.createdAt.slice(0, 40) };
  } catch {
    return null;
  }
}
