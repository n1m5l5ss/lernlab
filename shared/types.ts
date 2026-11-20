import type { Article } from './text';

export type ItemKind = 'noun' | 'verb' | 'word' | 'phrase' | 'grammar' | 'number';

/** A study item, built from one Anki note. */
export type Item = {
  id: number;
  deck: string;
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
  | 'boss';

export const RECALL_FORMATS: Format[] = ['typed', 'cloze', 'dictation', 'speak', 'boss'];

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
};

export type Exercise =
  | { type: 'intro'; itemId: number }
  | { type: 'mc'; itemId: number; direction: 'de2en' | 'en2de'; prompt: string; options: string[]; answerIndex: number }
  | { type: 'typed'; itemId: number; prompt: string; accepted: string[]; requireArticle: boolean; hint: string }
  | { type: 'cloze'; itemId: number; before: string; after: string; accepted: string[]; translation: string; hint: string }
  | { type: 'unscramble'; itemId: number; tiles: string[]; answer: string[]; translation: string }
  | { type: 'listen'; itemId: number; options: string[]; answerIndex: number }
  | { type: 'dictation'; itemId: number; sentence: string; translation: string }
  | { type: 'speak'; itemId: number; prompt: string; expected: string }
  | { type: 'lesson'; group: string; title: string; text: string; examples: { de: string; en: string }[] };

export type Block =
  | { id: string; kind: 'ignition'; title: string; teacher: string; exercises: Exercise[] }
  | { id: string; kind: 'learn'; title: string; teacher: string; exercises: Exercise[] }
  | { id: string; kind: 'drill'; format: Format; title: string; teacher: string; exercises: Exercise[] }
  | { id: string; kind: 'gender'; title: string; teacher: string; itemIds: number[]; seconds: number }
  | { id: string; kind: 'match'; title: string; teacher: string; itemIds: number[] }
  | { id: string; kind: 'rain'; title: string; teacher: string; itemIds: number[]; seconds: number }
  | { id: string; kind: 'boss'; title: string; teacher: string; itemIds: number[]; lives: number };

export type SessionLength = 'mini' | 'standard' | 'long';

export type SessionPlan = {
  id: string;
  length: SessionLength;
  agenda: string; // teacher's one-line agenda (German)
  agendaEn: string;
  blocks: Block[];
  items: Record<number, Item>; // every item referenced in the plan
  extras: Record<number, Item>; // distractor pool for client-generated exercises
  counts: { due: number; fresh: number; grammar: string | null };
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
