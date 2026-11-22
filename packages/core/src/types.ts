import type { Line } from './teacher';
import type { Article } from './text';
import type { OcclusionBox } from './occlusion';
import type { Level } from './variants';

export type ItemKind =
  | 'noun'
  | 'verb'
  | 'word'
  | 'phrase'
  | 'grammar'
  | 'number'
  | 'card'
  | 'cloze'
  | 'mcq'
  | 'order'
  | 'numeric'
  | 'code'
  | 'occlusion';

/** A study item (one card/note). front = target/term/question, back = meaning/definition/answer. */
export type Item = {
  id: number;
  deckId: number;
  /** BCP-47 language of the deck's front side (e.g. "de") for language decks; null for other subjects. */
  lang: string | null;
  deck: string; // sub-deck path from the source, e.g. "Lang::German::Tier1"
  image: string | null;
  video: string | null;
  category: string | null;
  /** Free-form extra fields: alt (alternative answers, "|" separated), choices/correct (mcq), steps (order), reading… */
  extra: Record<string, string>;
  kind: ItemKind;
  target: string; // clean text, e.g. "der Sohn"
  article: Article | null;
  word: string; // target without article
  meaning: string;
  sentenceHtml: string; // original sentence with <b> around the target form
  sentence: string; // clean sentence
  sentenceMeaning: string;
  grammar: string;
  notes: string;
  audio: string | null; // media filename
  rank: number;
  tags: string[];
  group: string | null; // grammar group, e.g. "G01"
  /** Occlusion cards: the boxes of the card's group, itself included (added when cards are loaded for study). */
  occlusionBoxes?: OcclusionBox[];
  /** Worked examples: the rung of the ladder the learner is on (worked.ts; added when a session is planned). */
  rung?: number;
};

/** Exercise formats. Only RECALL formats may write a spaced-repetition grade. */
export type Format =
  | 'intro'
  | 'mc'
  | 'match'
  | 'gender'
  | 'listen'
  | 'typed'
  | 'cloze'
  | 'unscramble'
  | 'dictation'
  | 'speak'
  | 'rain'
  | 'boss'
  | 'flip'
  | 'truefalse'
  | 'blitz'
  | 'mcq'
  | 'order'
  /** A worked example solved whole (a real recall), and one of its faded rungs (practice): worked.ts. */
  | 'worked'
  | 'ladder';

export const RECALL_FORMATS: Format[] = [
  'typed',
  'cloze',
  'dictation',
  'speak',
  'boss',
  'flip',
  'mcq',
  'order',
  'worked',
];

/** Mastery ladder: L0 seen → L1 recognised → L2 discriminated → L3 recalled → L4 in context → L5 spoken. */
export const FORMAT_LEVEL: Partial<Record<Format, number>> = {
  intro: 0,
  mc: 1,
  listen: 1,
  match: 2,
  gender: 2,
  typed: 3,
  boss: 3,
  rain: 3,
  cloze: 4,
  unscramble: 4,
  dictation: 4,
  speak: 5,
  flip: 3,
  truefalse: 1,
  blitz: 1,
  mcq: 3,
  order: 4,
  worked: 4,
};

export type Exercise =
  | { type: 'intro'; itemId: number }
  | { type: 'mc'; itemId: number; direction: 'de2en' | 'en2de'; prompt: string; options: string[]; answerIndex: number }
  | {
      type: 'typed';
      itemId: number;
      prompt: string;
      accepted: string[];
      requireArticle: boolean;
      hint: string;
      /** Code cards: the snippet to read (predict its output) and its language. */
      code?: string;
      codeLang?: string;
      /** Asked with one of the card's question variants (variants.ts): its level. */
      level?: Level;
    }
  | {
      type: 'cloze';
      itemId: number;
      before: string;
      after: string;
      accepted: string[];
      translation: string;
      hint: string;
      /** Code cards: before/after are the code around the gap, in this language. */
      codeLang?: string;
    }
  | { type: 'unscramble'; itemId: number; tiles: string[]; answer: string[]; translation: string }
  | { type: 'listen'; itemId: number; options: string[]; answerIndex: number }
  | { type: 'dictation'; itemId: number; sentence: string; translation: string }
  | { type: 'speak'; itemId: number; prompt: string; expected: string }
  | { type: 'lesson'; group: string; title: string; text: string; examples: { de: string; en: string }[] }
  | { type: 'flip'; itemId: number; prompt: string; answer: string; reverse: boolean; level?: Level }
  | { type: 'truefalse'; itemId: number; front: string; shown: string; isTrue: boolean }
  /** A myth card (misconceptions.ts): "True or myth?" about the statement, then why (its back). A real recall. */
  | { type: 'myth'; itemId: number; statement: string; why: string }
  /**
   * Explain first (explain.ts): type an explanation, then see the answer and tick the key points covered
   * (safe HTML; none for a basic card tagged why/how, which is self-graded as usual). A real recall.
   */
  | { type: 'explain'; itemId: number; prompt: string; answer: string; points: string[]; level?: Level }
  /**
   * A compare card (twin.ts): two things side by side (safe HTML); say what they share and the one key
   * difference, then check against the answer ('' for none) and rate yourself. A real recall.
   */
  | { type: 'twin'; itemId: number; left: string; right: string; answer: string }
  /**
   * A worked example (worked.ts): its first steps are shown, the last `blanks` are typed (0: study the full
   * example; all of them: the whole problem, the only real recall). label and resultHtml are safe HTML; result
   * is the plain text a typed step is checked against. answer is the card's back.
   */
  | {
      type: 'worked';
      itemId: number;
      prompt: string;
      steps: { label: string; result: string; resultHtml: string }[];
      blanks: number;
      answer: string;
    }
  | { type: 'imagemc'; itemId: number; options: string[]; answerIndex: number }
  /** corrections: per choice, safe HTML shown when that wrong choice is picked ('' for none; misconceptions.ts). */
  | {
      type: 'mcq';
      itemId: number;
      stem: string;
      choices: string[];
      correct: number[];
      explanation: string;
      corrections?: string[];
    }
  /** codeLang: the steps are lines of code in this language (order the lines). */
  | { type: 'order'; itemId: number; prompt: string; steps: string[]; shuffled: number[]; codeLang?: string };

/** A session block. `title` is an internal name for logs and tests, never shown; `teacher` is shown. */
export type Block =
  | { id: string; kind: 'ignition'; title: string; teacher: Line; exercises: Exercise[] }
  | { id: string; kind: 'learn'; title: string; teacher: Line; exercises: Exercise[] }
  /** Guess first: a new topic's questions before its cards are met. Practice only, never graded (guess.ts). */
  | { id: string; kind: 'guess'; title: string; teacher: Line; topic: string; itemIds: number[] }
  | { id: string; kind: 'drill'; format: Format; title: string; teacher: Line; exercises: Exercise[] }
  | { id: string; kind: 'gender'; title: string; teacher: Line; itemIds: number[]; seconds: number }
  | { id: string; kind: 'match'; title: string; teacher: Line; itemIds: number[] }
  | { id: string; kind: 'rain'; title: string; teacher: Line; itemIds: number[]; seconds: number }
  | { id: string; kind: 'boss'; title: string; teacher: Line; itemIds: number[]; lives: number }
  | { id: string; kind: 'blitz'; title: string; teacher: Line; exercises: Exercise[]; secondsPerQuestion: number };

export type SessionLength = 'mini' | 'standard' | 'long';

export type SessionPlan = {
  id: string;
  deckId: number | null;
  lang: string | null;
  length: SessionLength;
  /** The agenda line in the deck's language (German decks); the UI builds the translated one from `counts`. */
  agendaTarget: string | null;
  deckName: string | null;
  blocks: Block[];
  items: Record<number, Item>; // every item referenced in the plan
  extras: Record<number, Item>; // distractor pool for client-generated exercises
  counts: { due: number; fresh: number; grammar: string | null };
  /** Practice mode: any cards in the source, no new-card lessons, and nothing changes the schedule. */
  practice: boolean;
  /** Each deck's reading-aloud choices (system voice and speed), by deck id. */
  speech: Record<number, { voice?: string; rate?: number }>;
};

export type Attempt = {
  sessionId: string;
  itemId: number;
  format: Format;
  correct: boolean;
  nearMiss?: boolean;
  articleError?: boolean;
  usedHint?: boolean;
  firstTry?: boolean;
  responseMs: number;
  given?: string;
  xp: number;
  /** Gender sprint: was the article right? (tracked separately from the word itself) */
  genderOnly?: boolean;
  /** Practice mode: recorded for history and XP, but never touches the schedule. */
  practice?: boolean;
  /** The level of the question variant that was asked (variants.ts); none for the card's own question. */
  level?: Level;
  /** The learner said it was easy (explain cards, every key point ticked): Easy for a card reviewed before. */
  easy?: boolean;
};

export type DaySummary = {
  date: string;
  xp: number;
  sessions: number;
  minutes: number;
  attempts: number;
  correct: number;
  goalMet: boolean;
};
