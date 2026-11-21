// Exam simulator (#43): draw an exam from one deck and hand it in. Questions are always the user's own
// cards: question cards keep their choices; other cards become multiple choice with answers from the deck.
// Timed exams are practice: their answers are logged (practice = 1) but never grade FSRS or introduce a
// card. Tutor-mode answers count like normal study (owner's decision, Nov 21 2026): see examAttempt.
import { getDb, type DB } from './db';
import { host } from './host';
import { qa } from './cards';
import { asHtml, backText, mc, mcq } from './exercises';
import { variantsOf } from './variants';
import { isMyth } from './misconceptions';
import { allItems, deckNewPerDay, introducedTodayCount, recordAttempt } from './learn';
import { getDeck, type Deck } from './library';
import { shuffle, stripHtml } from './text';
import {
  examAttempt,
  examSettings,
  isRight,
  scoreExam,
  type ExamMode,
  type ExamQuestion,
  type ExamScore,
  type ExamSettings,
} from './exam';
import type { Item } from './types';

export type Exam = {
  id: string;
  deckId: number;
  deckName: string;
  settings: ExamSettings;
  questions: ExamQuestion[];
};

export type ExamAnswer = { itemId: number; chosen: number[]; ms: number };

/** One card as a multiple-choice question, or null when the deck has nothing to choose from. */
function question(item: Item, pool: Item[]): ExamQuestion | null {
  const base = { itemId: item.id, explanation: item.grammar || item.notes, topics: item.tags };
  if (item.kind === 'mcq') {
    const ex = mcq(item);
    if (ex?.type !== 'mcq') return null;
    const { stem, choices, correct, corrections } = ex;
    return { ...base, stem, choices, correct, ...(corrections && { corrections }) };
  }
  // Ask from the side the card asks from (qa): the shorter side is the answer.
  const ex = mc(item, pool, stripHtml(qa(item).answer) === backText(item) ? 'de2en' : 'en2de');
  if (ex.type !== 'mc' || ex.options.length < 2) return null;
  // A card with question variants is asked in one of its wordings, picked at random (the card's own is one).
  const variants = variantsOf(item);
  const v = variants[Math.floor(Math.random() * (variants.length + 1)) - 1];
  const asked = v ? { stem: asHtml(v.prompt), level: v.level } : { stem: ex.prompt };
  return { ...base, ...asked, choices: ex.options, correct: [ex.answerIndex] };
}

export function buildExam(deckId: number, d: DB = getDb()): Exam {
  const deck: Deck | null = getDeck(deckId, d);
  const settings = examSettings(deck?.settings.exam);
  // Myth cards ask "true or myth?" in sessions; they are neither questions nor answers in an exam.
  const pool = allItems(d, deckId).filter((i) => !['grammar', 'order', 'occlusion'].includes(i.kind) && !isMyth(i));
  const questions: ExamQuestion[] = [];
  for (const item of shuffle(pool)) {
    if (questions.length >= settings.questions) break;
    const q = question(item, pool);
    if (q) questions.push(q);
  }
  return { id: `exam-${host().randomId()}`, deckId, deckName: deck?.name ?? '', settings, questions };
}

/**
 * Score an exam and log every question (unanswered ones as wrong practice). No XP. Timed answers are
 * practice; tutor answers go through recordAttempt like a session's (see examAttempt). `reviewed` is how
 * many answers changed a card's schedule.
 */
export function recordExam(
  examId: string,
  questions: ExamQuestion[],
  answers: ExamAnswer[],
  passMark: number,
  mode: ExamMode,
  d: DB = getDb(),
  now = new Date(),
): ExamScore & { reviewed: number } {
  const given = new Map(answers.map((a) => [a.itemId, a]));
  const cards = new Map<number, { kind: string; deck: number; introduced: boolean }>();
  if (questions.length)
    for (const r of d
      .prepare(
        `SELECT i.id, i.kind, i.deck_id, s.item_id AS srs FROM items i LEFT JOIN srs s ON s.item_id = i.id
         WHERE i.id IN (${questions.map((q) => Number(q.itemId)).join(',')})`,
      )
      .all())
      cards.set(Number(r.id), { kind: String(r.kind), deck: Number(r.deck_id), introduced: r.srs != null });
  const newLeft = new Map<number, number>();
  const left = (deck: number) =>
    newLeft.get(deck) ?? Math.max(0, deckNewPerDay(deck, d) - introducedTodayCount(d, now, deck));
  let reviewed = 0;
  for (const q of questions) {
    const a = given.get(q.itemId);
    const card = cards.get(q.itemId);
    const as = card
      ? examAttempt({
          mode,
          answered: !!a?.chosen.length,
          questionCard: card.kind === 'mcq',
          introduced: card.introduced,
          newLeft: left(card.deck),
        })
      : 'practice';
    if (card && as === 'mcq' && !card.introduced) newLeft.set(card.deck, left(card.deck) - 1);
    const { grade } = recordAttempt(
      {
        sessionId: examId,
        itemId: q.itemId,
        format: as === 'practice' ? 'mcq' : as,
        correct: isRight(q, a?.chosen),
        responseMs: Math.max(0, a?.ms ?? 0),
        given: a?.chosen.map((i) => q.choices[i] ?? '').join(' | '),
        xp: 0,
        practice: as === 'practice',
        level: q.level,
      },
      d,
      now,
    );
    if (grade) reviewed++;
  }
  const score = scoreExam(questions, Object.fromEntries(answers.map((a) => [a.itemId, a.chosen])), passMark);
  return { ...score, reviewed };
}
