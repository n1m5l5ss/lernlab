// Exam simulator (#43): the deck's exam settings, checking an answer and the score by topic.
// Pure: the window uses it too (tutor mode checks each answer as it is given).
import { LEVELS, type Level } from './variants';

/** Tutor mode counts toward your reviews like normal study; timed mode is practice only. */
export type ExamMode = 'tutor' | 'timed';
export const EXAM_MODES: ExamMode[] = ['tutor', 'timed'];

export type ExamSettings = {
  /** How many questions an exam draws from the deck (fewer if the deck is smaller). */
  questions: number;
  /** The whole-exam clock in timed mode. Tutor mode has no clock. */
  minutes: number;
  /** Percent needed to pass, and the line under which a topic counts as weak. */
  passMark: number;
};

export const EXAM_DEFAULTS: ExamSettings = { questions: 20, minutes: 30, passMark: 70 };
const RANGES: Record<keyof ExamSettings, [number, number]> = {
  questions: [1, 200],
  minutes: [1, 300],
  passMark: [1, 100],
};

/** Exam settings from the screen, checked: known fields only, whole numbers in range. */
export function cleanExamSettings(input: unknown): Partial<ExamSettings> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Partial<ExamSettings> = {};
  for (const [k, [lo, hi]] of Object.entries(RANGES) as [keyof ExamSettings, [number, number]][]) {
    const raw = (input as Record<string, unknown>)[k];
    const n = raw === null || raw === '' ? NaN : Math.round(Number(raw));
    if (Number.isFinite(n)) out[k] = Math.max(lo, Math.min(hi, n));
  }
  return out;
}

/** A deck's exam settings with defaults filled in. */
export const examSettings = (saved: Partial<ExamSettings> | undefined): ExamSettings => ({
  ...EXAM_DEFAULTS,
  ...cleanExamSettings(saved),
});

/** One question: always multiple choice (one or several right answers). `stem` and choices may hold card HTML. */
export type ExamQuestion = {
  itemId: number;
  stem: string;
  choices: string[];
  correct: number[];
  explanation: string;
  /** The card's tags; the score is split by these. */
  topics: string[];
  /** Asked with one of the card's question variants: its level (the card's own question is recall). */
  level?: Level;
  /** Per choice: the correction (safe HTML) tutor mode shows when that wrong choice is picked; '' for none. */
  corrections?: string[];
  /** A question of a case chain (cases.ts): the case, as safe HTML, shown above the question. */
  caseText?: string;
};

/** Right only when every correct choice, and nothing else, is picked. */
export const isRight = (q: ExamQuestion, chosen: number[] | undefined) =>
  !!chosen &&
  chosen.length === q.correct.length &&
  q.correct.every((c) => chosen.includes(c)) &&
  new Set(chosen).size === chosen.length;

/**
 * How one handed-in answer is logged (owner's decision, Nov 21 2026). Timed answers and skipped questions
 * are practice. In tutor mode an answer is logged as a normal session would ask the card: a question card
 * as 'mcq' (recall: it grades FSRS, once per card per day, and a first try introduces a new card), any
 * other card as 'mc' (recognition: never grades). A new card counts only while the deck's new cards for
 * today last, and never from recognition.
 */
export function examAttempt(a: {
  mode: ExamMode;
  answered: boolean;
  /** The card is a question card (its own choices), not a flashcard turned into choices. */
  questionCard: boolean;
  /** The card is already in the schedule. */
  introduced: boolean;
  /** New cards the deck may still introduce today. */
  newLeft: number;
}): 'mcq' | 'mc' | 'practice' {
  if (a.mode !== 'tutor' || !a.answered) return 'practice';
  if (a.questionCard) return a.introduced || a.newLeft > 0 ? 'mcq' : 'practice';
  return a.introduced ? 'mc' : 'practice';
}

export type TopicScore = { topic: string; correct: number; total: number; percent: number };
export type LevelScore = { level: Level; correct: number; total: number; percent: number };
export type ExamScore = {
  correct: number;
  total: number;
  unanswered: number;
  percent: number;
  passMark: number;
  passed: boolean;
  /** Weakest first. The topic '' holds questions from cards without tags. */
  topics: TopicScore[];
  /** Topics under the pass mark, weakest first. */
  weak: string[];
  /** Recall, apply and analyse (those asked), when any question was a variant; otherwise empty. */
  levels: LevelScore[];
};

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** The score for answers given by item id. An unanswered question counts as wrong. */
export function scoreExam(questions: ExamQuestion[], answers: Record<number, number[]>, passMark: number): ExamScore {
  const byTopic = new Map<string, { correct: number; total: number }>();
  const byLevel = new Map<Level, { correct: number; total: number }>();
  let correct = 0;
  for (const q of questions) {
    const ok = isRight(q, answers[q.itemId]);
    if (ok) correct++;
    const l = byLevel.get(q.level ?? 'recall') ?? { correct: 0, total: 0 };
    byLevel.set(q.level ?? 'recall', { correct: l.correct + (ok ? 1 : 0), total: l.total + 1 });
    for (const topic of q.topics.length ? new Set(q.topics) : ['']) {
      const t = byTopic.get(topic) ?? { correct: 0, total: 0 };
      t.total++;
      if (ok) t.correct++;
      byTopic.set(topic, t);
    }
  }
  const topics = [...byTopic]
    .map(([topic, t]) => ({ topic, ...t, percent: pct(t.correct, t.total) }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total || a.topic.localeCompare(b.topic));
  const percent = pct(correct, questions.length);
  return {
    correct,
    total: questions.length,
    unanswered: questions.filter((q) => !answers[q.itemId]?.length).length,
    percent,
    passMark,
    passed: questions.length > 0 && percent >= passMark,
    topics,
    weak: topics.filter((t) => t.percent < passMark).map((t) => t.topic),
    levels: questions.some((q) => q.level)
      ? LEVELS.flatMap((level) => {
          const l = byLevel.get(level);
          return l ? [{ level, ...l, percent: pct(l.correct, l.total) }] : [];
        })
      : [],
  };
}
