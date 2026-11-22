// The AI requests screen (#148): the user's edits to a proposal, and what is sent back when they accept it.
import {
  AID_LISTS,
  GOAL_SESSIONS,
  NEW_PER_DAY_MAX,
  requestCardIds,
  type AiRequest,
  type CardChanges,
  type ProposedCard,
  type StudyPlan,
} from '@lernlab/core/airequests';

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
  'variants',
  'corrections',
  'keyPoints',
  'requires',
  'mnemonic',
  'keyTerms',
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];
/** Fields that are lists: typed one entry per line. */
export type ListField = keyof typeof AID_LISTS;
export const isListField = (field: ChangeField): field is ListField => Object.hasOwn(AID_LISTS, field);
/** The entries typed in a list field. Corrections keep their blanks: the line says which choice it is for. */
export const listOf = (field: ListField, text: string): string[] => {
  const lines = text.split('\n').map((l) => l.trim());
  return field === 'corrections' ? lines : lines.filter(Boolean);
};

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
  /** Goals, a study plan or an export format as typed: only the values the assistant proposed. */
  values: Partial<Record<ValueField, string>>;
};

/** Values of goals, study plan and export requests the screen can show, in this order. */
export const VALUE_FIELDS = ['dailyGoalSessions', 'newPerDay', 'examDate', 'goalLabel', 'goalWords', 'format'] as const;
export type ValueField = (typeof VALUE_FIELDS)[number];

const str = (n: number | string | undefined) => (n === undefined ? undefined : String(n));
function valuesOf(r: AiRequest): Draft['values'] {
  const all: Draft['values'] =
    r.kind === 'set_goals'
      ? { dailyGoalSessions: str(r.dailyGoalSessions), newPerDay: str(r.newPerDay) }
      : r.kind === 'study_plan'
        ? {
            examDate: r.plan.examDate,
            goalLabel: r.plan.goal?.label,
            goalWords: str(r.plan.goal?.words),
            newPerDay: str(r.plan.newPerDay),
          }
        : r.kind === 'export_deck'
          ? { format: r.format }
          : {};
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}

export function draftOf(r: AiRequest): Draft {
  const cards = 'cards' in r ? r.cards : [];
  const changes = r.kind === 'edit_card' || r.kind === 'merge_cards' ? (r.changes ?? {}) : {};
  // For a merge the kept card is shown on its own; `ids` are the duplicates.
  const ids = r.kind === 'merge_cards' ? requestCardIds(r).slice(1) : r.kind === 'organise_cards' ? r.cardIds : [];
  return {
    deckName: r.kind === 'create_deck' ? r.deck.name : '',
    cards,
    keep: cards.map(() => true),
    changes: Object.fromEntries(
      Object.entries(changes).map(([k, v]) => [
        k,
        Array.isArray(v) && isListField(k as ChangeField) ? v.join('\n') : fieldText(v),
      ]),
    ),
    ids,
    keepIds: ids.map(() => true),
    values: valuesOf(r),
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
    else if (isListField(field)) {
      const list = listOf(field, value).slice(0, AID_LISTS[field]);
      // An explain card needs at least two key points.
      if (field === 'keyPoints' && list.length < 2) return null;
      out[field] = list;
    } else if ((field === 'front' || field === 'back') && !value.trim()) return null;
    else out[field] = value;
  }
  return out;
}

/** A whole number typed in a field, or null when it is not one in range. Undefined when the field is not there. */
function wholeNumber(text: string | undefined, min: number, max: number): number | undefined | null {
  if (text === undefined) return undefined;
  if (!/^\s*\d+\s*$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/** Limits of the fields, as the app checks them. */
export const VALUE_LIMITS = {
  dailyGoalSessions: [GOAL_SESSIONS.min, GOAL_SESSIONS.max],
  newPerDay: [0, NEW_PER_DAY_MAX],
  deckNewPerDay: [0, 999],
  goalWords: [0, 1_000_000],
} as const;

function goalsBody(v: Draft['values']) {
  const sessions = wholeNumber(v.dailyGoalSessions, ...VALUE_LIMITS.dailyGoalSessions);
  const newPerDay = wholeNumber(v.newPerDay, ...VALUE_LIMITS.newPerDay);
  if (sessions === null || newPerDay === null || (sessions === undefined && newPerDay === undefined)) return null;
  return { dailyGoalSessions: sessions, newPerDay };
}

function planBody(v: Draft['values']): StudyPlan | null {
  const plan: StudyPlan = {};
  if (v.examDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.examDate)) return null;
    plan.examDate = v.examDate;
  }
  if (v.goalLabel !== undefined) {
    const words = wholeNumber(v.goalWords ?? '0', ...VALUE_LIMITS.goalWords);
    if (!v.goalLabel.trim() || words == null) return null;
    plan.goal = { label: v.goalLabel.trim(), words };
  }
  const newPerDay = wholeNumber(v.newPerDay, ...VALUE_LIMITS.deckNewPerDay);
  if (newPerDay === null) return null;
  if (newPerDay !== undefined) plan.newPerDay = newPerDay;
  return Object.keys(plan).length ? plan : null;
}

/** The request body to accept, with the user's edits. Null when there is nothing to accept. */
export function acceptedBody(r: AiRequest, d: Draft): Record<string, unknown> | null {
  if (r.kind === 'set_goals') {
    const goals = goalsBody(d.values);
    return goals && { ...goals, note: r.note };
  }
  if (r.kind === 'study_plan') {
    const plan = planBody(d.values);
    return plan && { deckId: r.deckId, plan, note: r.note };
  }
  if (r.kind === 'export_deck')
    return { deckId: r.deckId, format: d.values.format === 'csv' ? 'csv' : 'lernpack', note: r.note };
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

/** Change the correction of one choice (corrections are typed one per choice). */
export const editCorrection = (d: Draft, choice: number, text: string): Draft => {
  const lines = (d.changes.corrections ?? '').split('\n');
  while (lines.length <= choice) lines.push('');
  lines[choice] = text.replace(/\n/g, ' ');
  return editChange(d, 'corrections', lines.join('\n'));
};

/** Change one proposed field as typed. */
export const editChange = (d: Draft, field: ChangeField, text: string): Draft => ({
  ...d,
  changes: { ...d.changes, [field]: text },
});

/** A field's value as text for an input. */
export const fieldText = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(' ') : (value ?? '');

/** Change one goals, plan or export value as typed. */
export const editValue = (d: Draft, field: ValueField, text: string): Draft => ({
  ...d,
  values: { ...d.values, [field]: text },
});
