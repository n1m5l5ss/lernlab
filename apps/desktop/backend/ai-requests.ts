// The shapes of AI requests (#148), checked with the app's validators wherever one arrives: from the assistant
// (MCP tools), from a file in ai-requests/ (anything could have written it) and from the window (the user's edits).
import {
  AID_LISTS,
  AI_CARDS_MAX,
  cleanAids,
  GOAL_SESSIONS,
  NEW_PER_DAY_MAX,
  ORGANISE_KINDS,
  type AiRequest,
  type AiRequestBody,
  type AiRequestKind,
  type OrganiseAction,
} from '@lernlab/core/airequests';
import { isRequestId } from '@lernlab/storage-sqlite/airequests';
import { InvalidInput } from './validate';
import { f, type Field, type Shape } from './fields';

const opt = f.optional;

/** Study aids (plain text; formatting and HTML are removed). The same limits as an imported deck's. */
const requires = opt(
  f.list(
    f.text(200, 'The front of another card of the same deck, or a tag as "#tag".'),
    AID_LISTS.requires,
    'What to learn first: cards or tags this card builds on. Only orders new cards; never blocks studying.',
  ),
);
const mnemonic = opt(f.text(300, 'A memory aid, shown after a miss or as a hint. "" removes it.'));
const keyTerms = opt(
  f.list(
    f.text(100, 'One word or short phrase exactly as it stands in the back.'),
    AID_LISTS.keyTerms,
    'The words a typed answer must contain. Not for cloze, multiple-choice, order or code cards.',
  ),
);

const proposedCardShape = f.object({
  front: f.text(2000, 'The question side. Plain text; **bold** and {{c1::cloze}} work as in imported decks.'),
  back: f.text(5000, 'The answer side.'),
  example: opt(f.text(2000, 'An example sentence.')),
  exampleTranslation: opt(f.text(2000, 'Its translation.')),
  explanation: opt(f.text(5000, 'A short explanation shown after answering.')),
  notes: opt(f.text(5000, 'Notes.')),
  tags: opt(f.list(f.text(100, 'One tag, no spaces.'), 20, 'Tags.')),
  category: opt(f.text(100, 'A category for sorting rounds (e.g. der/die/das).')),
  type: opt(
    f.oneOf(
      ['basic', 'cloze', 'mcq', 'twin'] as const,
      'Card type (default basic). twin: a compare card for two things that are easy to mix up.',
    ),
  ),
  twin: opt(
    f.text(
      500,
      'For twin: the second thing, shown beside the front ("effect: a result"). The back says what they share and the one key difference.',
    ),
  ),
  choices: opt(f.text(2000, 'For mcq: the choices separated by |.')),
  correct: opt(f.text(200, 'For mcq: the correct choice numbers (1-based), separated by |.')),
  requires,
  mnemonic,
  keyTerms,
});
/** A field whose value is cleaned (cleanAids) after its shape is checked. */
const cleaned = <T extends object>(field: Field<T>): Field<T> => ({
  ...field,
  check: (value, path) => cleanAids(field.check(value, path)),
});
export const proposedCard = cleaned(proposedCardShape);
/** Changes to an existing card: only the fields given change. */
export const cardChanges = cleaned(
  f.object({
    front: opt(f.text(2000, 'New question side.')),
    back: opt(f.text(5000, 'New answer side.')),
    example: opt(f.text(2000, 'New example sentence.')),
    exampleTranslation: opt(f.text(2000, 'Its translation.')),
    explanation: opt(f.text(5000, 'New explanation.')),
    notes: opt(f.text(5000, 'New notes.')),
    tags: opt(f.list(f.text(100, 'One tag, no spaces.'), 20, 'The full new list of tags.')),
    category: opt(f.text(100, 'New category.')),
    variants: opt(
      f.list(
        f.text(520, 'One question, starting with its level: "recall: …", "apply: …" or "analyse: …".'),
        AID_LISTS.variants,
        "Other ways to ask this card's question (the full new list; the answer stays the back). Only for cards answered in writing: not cloze, multiple-choice, order, code, myth, explain, compare or worked cards.",
      ),
    ),
    corrections: opt(
      f.list(
        f.text(500, 'Why this choice is wrong, or "" for none.'),
        AID_LISTS.corrections,
        'Multiple-choice cards only: one entry per choice, in the order get_card lists the choices; "" for the right choices.',
      ),
    ),
    keyPoints: opt(
      f.list(
        f.text(300, 'One point.'),
        AID_LISTS.keyPoints,
        'Explain cards only: the 2 to 5 points a good explanation covers (the full new list). Put the model explanation in back.',
      ),
    ),
    requires,
    mnemonic,
    keyTerms,
  }),
);
const ORGANISE_SHAPE = f.object({
  kind: f.oneOf(ORGANISE_KINDS, 'What to do with the cards. There is no delete.'),
  tag: opt(f.text(200, 'For tag and untag: the tag (one word).')),
  deckId: opt(f.id('For move: the deck to move the cards to.')),
});
/** One organising action: tag and untag need a single-word tag, move needs a deck. */
const organiseAction: Field<OrganiseAction> = {
  schema: ORGANISE_SHAPE.schema,
  check: (value, path = 'action') => {
    const a = ORGANISE_SHAPE.check(value, path);
    if (a.kind === 'tag' || a.kind === 'untag') {
      const tag = a.tag?.trim();
      if (!tag || /\s/.test(tag)) throw new InvalidInput(`${path}.tag must be one tag`);
      return { kind: a.kind, tag };
    }
    if (a.kind === 'move') {
      if (!a.deckId) throw new InvalidInput(`${path}.deckId must be an id`);
      return { kind: a.kind, deckId: a.deckId };
    }
    return { kind: a.kind };
  },
};
const cardIds = (max: number, description: string) => f.list(f.id('A card id.'), max, description);

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
  edit_card: { cardId: f.id('The card to fix (an id from search_cards).'), changes: cardChanges, note },
  merge_cards: {
    keepId: f.id('The card to keep.'),
    mergeIds: cardIds(20, 'The duplicates of it. They are suspended and tagged "merged", never deleted.'),
    changes: opt(cardChanges),
    note,
  },
  organise_cards: {
    cardIds: cardIds(1000, 'The cards (at most 1000).'),
    action: organiseAction,
    note,
  },
  set_goals: {
    dailyGoalSessions: opt(
      f.int(GOAL_SESSIONS.min, GOAL_SESSIONS.max, 'Daily goal: how many sessions a day count as done.'),
    ),
    newPerDay: opt(f.int(0, NEW_PER_DAY_MAX, 'New cards a day, for decks without their own number.')),
    note,
  },
  study_plan: {
    deckId: f.id('The deck the plan is for.'),
    plan: f.object({
      examDate: opt(f.date('The day of the exam or deadline (YYYY-MM-DD).')),
      goal: opt(
        f.object({
          label: f.text(100, 'What the goal is, e.g. "B1 exam" or "Chapter 3 test".'),
          words: f.int(0, 1_000_000, 'How many cards to know by then.'),
        }),
      ),
      newPerDay: opt(f.int(0, 999, 'New cards a day for this deck.')),
    }),
    note,
  },
  export_deck: {
    deckId: f.id('The deck to export.'),
    format: f.oneOf(['csv', 'lernpack'] as const, 'csv (cards only) or lernpack (cards, media and settings).'),
    note,
  },
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
