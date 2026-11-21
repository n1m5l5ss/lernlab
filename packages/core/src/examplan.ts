// Exam simulator (#43): draw an exam from one deck and hand it in. Questions are always the user's own
// cards: question cards keep their choices; other cards become multiple choice with answers from the deck.
// An exam is practice: its answers are logged (practice = 1) but never grade FSRS or introduce a card.
import { getDb, type DB } from './db';
import { host } from './host';
import { qa } from './cards';
import { backText, mc, mcq } from './exercises';
import { allItems, recordAttempt } from './learn';
import { getDeck, type Deck } from './library';
import { shuffle, stripHtml } from './text';
import { examSettings, isRight, scoreExam, type ExamQuestion, type ExamScore, type ExamSettings } from './exam';
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
    return ex?.type === 'mcq' ? { ...base, stem: ex.stem, choices: ex.choices, correct: ex.correct } : null;
  }
  // Ask from the side the card asks from (qa): the shorter side is the answer.
  const ex = mc(item, pool, stripHtml(qa(item).answer) === backText(item) ? 'de2en' : 'en2de');
  if (ex.type !== 'mc' || ex.options.length < 2) return null;
  return { ...base, stem: ex.prompt, choices: ex.options, correct: [ex.answerIndex] };
}

export function buildExam(deckId: number, d: DB = getDb()): Exam {
  const deck: Deck | null = getDeck(deckId, d);
  const settings = examSettings(deck?.settings.exam);
  const pool = allItems(d, deckId).filter((i) => !['grammar', 'order'].includes(i.kind));
  const questions: ExamQuestion[] = [];
  for (const item of shuffle(pool)) {
    if (questions.length >= settings.questions) break;
    const q = question(item, pool);
    if (q) questions.push(q);
  }
  return { id: `exam-${host().randomId()}`, deckId, deckName: deck?.name ?? '', settings, questions };
}

/** Score an exam and log every question as a practice attempt (unanswered ones as wrong). No XP, no FSRS. */
export function recordExam(
  examId: string,
  questions: ExamQuestion[],
  answers: ExamAnswer[],
  passMark: number,
  d: DB = getDb(),
  now = new Date(),
): ExamScore {
  const given = new Map(answers.map((a) => [a.itemId, a]));
  for (const q of questions) {
    const a = given.get(q.itemId);
    recordAttempt(
      {
        sessionId: examId,
        itemId: q.itemId,
        format: 'mcq',
        correct: isRight(q, a?.chosen),
        responseMs: Math.max(0, a?.ms ?? 0),
        given: a?.chosen.map((i) => q.choices[i] ?? '').join(' | '),
        xp: 0,
        practice: true,
      },
      d,
      now,
    );
  }
  return scoreExam(questions, Object.fromEntries(answers.map((a) => [a.itemId, a.chosen])), passMark);
}
