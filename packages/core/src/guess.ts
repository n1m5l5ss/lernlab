// Guess first: when a session's new cards start a topic nothing of which has been seen yet, an optional round
// asks 5–8 of that topic's questions before the cards are met. Prequestions help on the questions asked
// (g = 0.54, St. Hilaire et al. 2023), and failed attempts help when the answer follows (Kornell, Hays & Bjork
// 2009). The round is practice only: it never introduces, grades or ranks a card.
import type { DB } from './db';
import { mcqOf, qa, replaceClozes } from './cards';
import { codeTask } from './code';
import { askedOwnWay } from './explain';
import { isWorked, stepHtml, workedStepsOf } from './worked';
import type { Item, SessionLength } from './types';

/** Fewest questions worth a round; the most a session asks, by its length. */
export const GUESS_MIN = 5;
export const GUESS_MAX: Record<SessionLength, number> = { mini: 5, standard: 6, long: 8 };

/** A topic: one of a deck's tags, or a sub-deck path ('' is the deck itself). */
export type GuessTopic = { kind: 'tag' | 'sub'; deckId: number; value: string };

const GUESS_KINDS = new Set<Item['kind']>(['card', 'cloze', 'mcq', 'numeric', 'code']);

/**
 * Can a learner reason their way to a guess? Concepts, facts and maths, yes; arbitrary pairs such as the
 * words of a language deck, no. Line ordering (order cards, code with only lines) is not a guess either.
 */
export function guessable(item: Item): boolean {
  if (item.lang || !GUESS_KINDS.has(item.kind) || askedOwnWay(item)) return false;
  if (item.kind === 'mcq') return !!mcqOf(item);
  if (item.kind === 'code') return codeTask(item)?.mode === 'fill' || codeTask(item)?.mode === 'output';
  return true;
}

/** A card's topics: its tags, or else its sub-deck (or the whole deck). */
export function topicsOf(item: Item): GuessTopic[] {
  if (item.tags.length) return item.tags.map((value) => ({ kind: 'tag', deckId: item.deckId, value }));
  return [{ kind: 'sub', deckId: item.deckId, value: item.deck ?? '' }];
}

const same = (a: GuessTopic, b: GuessTopic) => a.kind === b.kind && a.deckId === b.deckId && a.value === b.value;

/**
 * The round to offer: the first topic of today's new cards (in order) that is new and has at least GUESS_MIN
 * guessable questions. Today's new cards of that topic come first (the guess helps on the asked items),
 * then the topic's next cards in deck order, up to `max`. Null when there is no such topic.
 */
export function pickGuessRound(
  fresh: Item[],
  pool: Item[],
  isNew: (t: GuessTopic) => boolean,
  max: number,
): { topic: GuessTopic; ids: number[] } | null {
  const tried: GuessTopic[] = [];
  for (const card of fresh) {
    if (!guessable(card)) continue;
    for (const topic of topicsOf(card)) {
      if (tried.some((t) => same(t, topic))) continue;
      tried.push(topic);
      if (!isNew(topic)) continue;
      const inTopic = (i: Item) => guessable(i) && topicsOf(i).some((t) => same(t, topic));
      const freshIds = fresh.filter(inTopic).map((i) => i.id);
      const ids = [...new Set([...freshIds, ...pool.filter(inTopic).map((i) => i.id)])].slice(0, max);
      if (ids.length >= GUESS_MIN) return { topic, ids };
    }
  }
  return null;
}

/**
 * Try first (#218): in a deck marked maths or science, a new unit opens with one of its problems, tried before
 * the cards are met and then compared with the worked solution. Problem solving before instruction helps
 * there, g = 0.36, but not for young children or general skills [Sinha & Kapur 2021], hence only marked decks.
 * The problem is the unit's first worked example nobody has worked on yet (`untried`), today's new cards
 * first. Like a guess round it is practice only. Null when no new unit of today's cards has one.
 */
export function pickTryFirst(
  fresh: Item[],
  pool: Item[],
  isNew: (t: GuessTopic) => boolean,
  marked: (deckId: number) => boolean,
  untried: (itemId: number) => boolean,
): { topic: GuessTopic; ids: number[] } | null {
  const tried: GuessTopic[] = [];
  for (const card of fresh) {
    if (card.lang || !marked(card.deckId)) continue;
    for (const topic of topicsOf(card)) {
      if (tried.some((t) => same(t, topic))) continue;
      tried.push(topic);
      if (!isNew(topic)) continue;
      const problem = [...fresh, ...pool].find(
        (i) => isWorked(i) && topicsOf(i).some((t) => same(t, topic)) && untried(i.id),
      );
      if (problem) return { topic, ids: [problem.id] };
    }
  }
  return null;
}

/** True when the card has no answer of any kind in the log (one indexed lookup). */
export const neverAnswered = (itemId: number, d: DB): boolean =>
  !d.prepare('SELECT 1 FROM attempts WHERE item_id = ? LIMIT 1').get(itemId);

/** True when no card of the topic has ever been met (one indexed lookup that stops at the first hit). */
export function topicIsNew(t: GuessTopic, d: DB): boolean {
  const where =
    t.kind === 'tag' ? 'AND EXISTS (SELECT 1 FROM json_each(i.tags) WHERE value = ?)' : t.value ? 'AND i.deck = ?' : '';
  const args = t.kind === 'tag' || t.value ? [t.deckId, t.value] : [t.deckId];
  return !d
    .prepare(`SELECT 1 FROM srs s JOIN items i ON i.id = s.item_id WHERE i.deck_id = ? ${where} LIMIT 1`)
    .get(...args);
}

/** The topic's name as the learner knows it: the tag, the last part of the sub-deck path, or the deck's name. */
export function topicName(t: GuessTopic, deckName: string): string {
  if (t.kind === 'tag') return t.value;
  return t.value.split('::').pop()?.trim() || deckName;
}

export type GuessCard = {
  /** Question, as safe card HTML. */
  prompt: string;
  /** Multiple-choice questions: the choices, in the card's order, and the right ones (indexes). */
  choices: string[];
  correct: number[];
  /** Code cards: the snippet (a fill gap is marked with GAP) and its language. */
  code?: { code: string; lang: string };
  /** The answer shown after the guess, as safe card HTML. */
  answer: string;
  explanation: string;
  /** Worked examples (try first): the solution's steps, as safe HTML (label '' for none). */
  steps?: { label: string; result: string }[];
};

/** What a guess round shows for a card: the question, then the answer. Nothing here is checked or graded. */
export function guessCard(item: Item): GuessCard {
  const explanation = item.notes || item.grammar;
  if (isWorked(item)) {
    const steps = workedStepsOf(item).map((s) => ({ label: stepHtml(s.label), result: stepHtml(s.result) }));
    return { prompt: item.target, choices: [], correct: [], answer: item.meaning, explanation, steps };
  }
  if (item.kind === 'mcq') {
    const m = mcqOf(item);
    const choices = m?.choices ?? [];
    const correct = m?.correct ?? [];
    return { prompt: item.target, choices, correct, answer: correct.map((i) => choices[i]).join(' · '), explanation };
  }
  if (item.kind === 'cloze') {
    return {
      prompt: replaceClozes(item.target, (c) => (c.hint ? `[${c.hint}]` : '[…]')),
      choices: [],
      correct: [],
      answer: replaceClozes(item.target, (c) => `<b>${c.answer}</b>`),
      explanation: item.meaning || explanation,
    };
  }
  const task = codeTask(item);
  if (task && task.mode !== 'order')
    return {
      prompt: item.target,
      choices: [],
      correct: [],
      code: { code: task.code, lang: task.lang },
      answer: task.answer,
      explanation,
    };
  const q = qa(item);
  return { prompt: q.prompt, choices: [], correct: [], answer: q.answer, explanation };
}
