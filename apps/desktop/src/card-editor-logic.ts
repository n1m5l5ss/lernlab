// Card editor logic: the form, the live preview (built like the saved card and the real exercise) and media drops.
import { mcqOf, qa, stepsOf } from '@lernlab/core/cards';
import { cloze, typed } from '@lernlab/core/exercises';
import { cardToItem, mediaKind, type NormalizedCard } from '@lernlab/core/library';
import { parseTolerance } from '@lernlab/core/numeric';
import { codeTask, type CodeTask } from '@lernlab/core/code';
import { formatBox } from '@lernlab/core/occlusion';
import { VARIANTS_MAX, formatVariants, parseVariants, takesVariants, type Variant } from '@lernlab/core/variants';
import { correctionsOf, formatCorrections, isMyth } from '@lernlab/core/misconceptions';
import { KEY_POINTS_MIN, formatKeyPoints, isExplain, keyPointHtml, keyPointsOf } from '@lernlab/core/explain';
import {
  WORKED_STEPS_MIN,
  formatWorkedSteps,
  isWorked,
  stepHtml,
  workedStepsOf,
  type WorkedStep,
} from '@lernlab/core/worked';
import { stripHtml } from '@lernlab/core/text';
import { cleanGraph } from '@lernlab/core/graph';
import { isTranslate } from '@lernlab/core/translate';
import { cardHints, type CardHint } from '@lernlab/core/cardquality';
import { answerSource, markAnswer } from '@lernlab/core/keyterms';
import type { Shape } from './occlusion-logic';
import type { Item } from '@lernlab/core/types';
import type { OutputOf } from '../backend/handlers';

type FullCard = OutputOf<'cards.get'>;
export type CardType =
  'basic' | 'cloze' | 'mcq' | 'order' | 'numeric' | 'code' | 'occlusion' | 'myth' | 'explain' | 'worked' | 'translate';
export const CARD_TYPES: CardType[] = [
  'basic',
  'cloze',
  'mcq',
  'order',
  'numeric',
  'code',
  'occlusion',
  'myth',
  'explain',
  'worked',
  'translate',
];
const STORED_TYPES = new Set<string>(CARD_TYPES);
export type MediaSlot = 'image' | 'audio' | 'video';

export const EMPTY = {
  front: '',
  back: '',
  example: '',
  exampleTranslation: '',
  explanation: '',
  notes: '',
  /** A memory aid: shown in a session only after a miss or a hint (core/mnemonic.ts). */
  mnemonic: '',
  category: '',
  tags: '',
  image: '',
  imageAlt: '',
  audio: '',
  video: '',
  alt: '',
  /** What to learn first: fronts of other cards or tags, separated by | (core/requires.ts). */
  requires: '',
  type: 'basic' as CardType,
  choices: '',
  correct: '',
  steps: '',
  tolerance: '',
  code: '',
  codeLang: '',
  occlusion: '',
  occlusionGroup: '',
  occlusionMode: 'one',
  /** Other ways to ask the question (rows being edited may still be empty). */
  variants: [] as Variant[],
  /** mcq: a correction per choice, in the order of the choices ('' for none). */
  corrections: [] as string[],
  /** explain: its key points (rows being edited may still be empty). */
  keyPoints: [] as string[],
  /** worked: its solution steps (rows being edited may still be empty). */
  workedSteps: [] as WorkedStep[],
  /** The case this question belongs to (cases.ts); cards of the deck with the same case form a chain. */
  case: '',
  /** A graph drawn with the front (graph.ts): a function of x or a list of points, as one line of text. */
  graph: '',
};
export type Form = typeof EMPTY & { id?: number; suspended?: boolean; starred?: boolean; item?: FullCard };

export const formFor = (c: FullCard): Form => ({
  id: c.id,
  front: c.target,
  // Key terms are written in the back as ==term==.
  back: answerSource(c),
  example: c.sentenceHtml,
  exampleTranslation: c.sentenceMeaning,
  explanation: c.grammar,
  notes: c.notes,
  mnemonic: c.extra.mnemonic ?? '',
  category: c.category ?? '',
  tags: c.tags.join(' '),
  image: c.image ?? '',
  imageAlt: c.extra.imageAlt ?? '',
  audio: c.audio ?? '',
  video: c.video ?? '',
  alt: c.extra.alt ?? '',
  requires: c.extra.requires ?? '',
  type: isMyth(c)
    ? 'myth'
    : isExplain(c)
      ? 'explain'
      : isWorked(c)
        ? 'worked'
        : isTranslate(c)
          ? 'translate'
          : STORED_TYPES.has(c.kind)
            ? (c.kind as CardType)
            : 'basic',
  choices: c.extra.choices ?? '',
  correct: c.extra.correct ?? '',
  steps: c.extra.steps ?? '',
  tolerance: c.extra.tolerance ?? '',
  code: c.extra.code ?? '',
  codeLang: c.extra.codeLang ?? '',
  occlusion: c.extra.occlusion ?? '',
  occlusionGroup: c.extra.occlusionGroup ?? '',
  occlusionMode: c.extra.occlusionMode ?? 'one',
  variants: parseVariants(c.extra.variants),
  corrections: correctionsOf(c),
  keyPoints: keyPointsOf(c),
  workedSteps: workedStepsOf(c),
  case: c.extra.case ?? '',
  graph: c.extra.graph ?? '',
  suspended: c.suspended,
  starred: c.starred,
  item: c,
});

/** The image description field shows while the card has an image (it is the image's alt text). */
export const showImageAlt = (f: Pick<Form, 'image'>) => !!f.image;

/** Question variants are for cards asked as a written question (flip or typed). */
export const showVariants = (f: Pick<Form, 'type'>) =>
  f.type !== 'myth' &&
  f.type !== 'explain' &&
  f.type !== 'worked' &&
  takesVariants(f.type === 'basic' || f.type === 'translate' ? 'card' : f.type);
export const canAddVariant = (list: Variant[]) => list.length < VARIANTS_MAX;
/** A new question starts as apply: the card's own question already covers recall. */
export const addVariant = (list: Variant[]): Variant[] =>
  canAddVariant(list) ? [...list, { prompt: '', level: 'apply' }] : list;
export const editVariant = (list: Variant[], i: number, change: Partial<Variant>): Variant[] =>
  list.map((v, k) => (k === i ? { ...v, ...change } : v));
export const removeVariant = (list: Variant[], i: number): Variant[] => list.filter((_, k) => k !== i);

/** The key point rows to show: at least two, as an explain card needs. */
export const keyPointRows = (list: string[]): string[] =>
  list.length >= KEY_POINTS_MIN ? list : [...list, ...Array<string>(KEY_POINTS_MIN - list.length).fill('')];

/** A case is for cards asked as a written question (core drops it from the others). */
export const showCase = (f: Pick<Form, 'type'>) => !['cloze', 'order', 'code', 'occlusion'].includes(f.type);

/** A graph is for basic, translate, numeric and multiple-choice cards (core drops it from the others). */
export const showGraph = (f: Pick<Form, 'type'>) => ['basic', 'translate', 'numeric', 'mcq'].includes(f.type);
/** The graph line is written but does not read: the editor says so (the card saves without a graph). */
export const graphProblem = (f: Pick<Form, 'type' | 'graph'>) =>
  showGraph(f) && !!f.graph.trim() && !cleanGraph(f.graph);

/** The worked-step rows to show: at least two, as a worked example needs. */
export const workedRows = (list: WorkedStep[]): WorkedStep[] =>
  list.length >= WORKED_STEPS_MIN
    ? list
    : [...list, ...Array.from({ length: WORKED_STEPS_MIN - list.length }, () => ({ label: '', result: '' }))];

/** The choices as written in the form, each with whether it is marked correct (corrections are for the others). */
export function choiceRows(f: Pick<Form, 'choices' | 'correct'>): { choice: string; correct: boolean }[] {
  const m = mcqOf({ extra: { choices: f.choices, correct: f.correct }, meaning: '' });
  return f.choices
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c, i) => ({ choice: stripHtml(c), correct: !!m?.correct.includes(i) }));
}
export const editCorrection = (list: string[], i: number, text: string): string[] =>
  Array.from({ length: Math.max(list.length, i + 1) }, (_, k) => (k === i ? text : (list[k] ?? '')));

/** What the editor saves: only the fields of the chosen type, so a leftover choice list can't turn a card into a quiz. */
export function fieldsToSave(f: Form) {
  const { id: _id, item: _item, suspended: _s, starred: _st, ...fields } = f;
  return {
    ...fields,
    choices: f.type === 'mcq' ? f.choices : '',
    correct: f.type === 'mcq' ? f.correct : '',
    steps: f.type === 'order' ? f.steps : '',
    tolerance: f.type === 'numeric' ? f.tolerance : '',
    code: f.type === 'code' ? f.code : '',
    codeLang: f.type === 'code' ? f.codeLang : '',
    occlusion: f.type === 'occlusion' ? f.occlusion : '',
    occlusionGroup: f.type === 'occlusion' ? f.occlusionGroup : '',
    occlusionMode: f.type === 'occlusion' ? f.occlusionMode : '',
    variants: showVariants(f) ? formatVariants(f.variants) : '',
    keyPoints: f.type === 'explain' ? formatKeyPoints(f.keyPoints) : '',
    workedSteps: f.type === 'worked' ? formatWorkedSteps(f.workedSteps.filter((s) => s.result.trim())) : '',
    case: showCase(f) ? f.case : '',
    graph: showGraph(f) ? f.graph : '',
    corrections:
      f.type === 'mcq'
        ? formatCorrections(f.corrections, mcqOf({ extra: { choices: f.choices, correct: f.correct }, meaning: '' }))
        : '',
  };
}

/** The form as the importer shape, the same way the `cards.add` handler reads it. */
function toCard(f: Form): NormalizedCard {
  const s = fieldsToSave(f);
  return {
    ...s,
    altAnswers: s.alt || undefined,
    image: s.image || undefined,
    audio: s.audio || undefined,
    video: s.video || undefined,
    tags: s.tags.split(/[\s,]+/),
  };
}

export type PreviewView =
  | { type: 'typed'; prompt: string; answer: string; also: string[]; mediaFirst: boolean }
  | { type: 'flip'; prompt: string; answer: string; mediaFirst: boolean }
  /** A myth card: "True or myth?" about the front, then why (the back). */
  | { type: 'myth'; prompt: string; answer: string }
  /** An explain card: the question, then the model answer ('' for none) and the key points (safe HTML). */
  | { type: 'explain'; prompt: string; answer: string; points: string[] }
  /** A worked example: the problem, then every step (safe HTML; label '' for none) and the answer. */
  | { type: 'worked'; prompt: string; answer: string; steps: WorkedStep[] }
  | { type: 'cloze'; before: string; after: string; answer: string; hint: string; extra: string }
  | { type: 'mcq'; stem: string; choices: string[]; correct: number[] }
  | { type: 'order'; prompt: string; steps: string[] }
  | { type: 'code'; prompt: string; task: CodeTask }
  /** The asked box hidden on the picture (the item carries its group's boxes). */
  | { type: 'occlusion'; prompt: string; answer: string }
  /** The card would not study as the chosen type: say what is missing. */
  | {
      type: 'problem';
      problem:
        'noGap' | 'choices' | 'steps' | 'number' | 'tolerance' | 'code' | 'occlusion' | 'keyPoints' | 'workedSteps';
    };
/** `hints`: suggestions for a better card (never a reason not to save it). */
export type Preview = { item: Item; view: PreviewView; explanation: string; hints: CardHint[] };

/**
 * The live preview: the card cleaned exactly as it will be saved, then asked the way a recall round asks it
 * (choices in the order written; a session shuffles them). Null while the front is empty.
 */
export function previewOf(
  f: Form,
  deck: { id: number; language: string | null },
  shapes: Shape[] = [],
  selected = 0,
): Preview | null {
  // An occlusion preview asks the selected box (ids stand in for the boxes not saved yet).
  const idOf = (i: number) => shapes[i]?.id ?? -1 - i;
  const ask = shapes[selected];
  const form = f.type === 'occlusion' && ask ? { ...f, back: ask.label, occlusion: formatBox(ask.box) } : f;
  const item = cardToItem({ ...deck, name: '' }, toCard(form), f.type === 'occlusion' ? idOf(selected) : (f.id ?? 0));
  if (!item) return null;
  const explanation = item.grammar || item.notes;
  const out = (view: PreviewView): Preview => ({
    item,
    view,
    explanation,
    hints: view.type === 'problem' ? [] : cardHints(item),
  });
  if (f.type === 'cloze') {
    const ex = item.kind === 'cloze' ? cloze(item) : null;
    if (ex?.type !== 'cloze') return out({ type: 'problem', problem: 'noGap' });
    const answer = ex.accepted[0] ?? '';
    return out({ type: 'cloze', before: ex.before, after: ex.after, answer, hint: ex.hint, extra: ex.translation });
  }
  if (f.type === 'myth') return out({ type: 'myth', prompt: item.target, answer: markAnswer(item, item.meaning) });
  if (f.type === 'explain') {
    const points = keyPointsOf(item);
    return out(
      points.length
        ? {
            type: 'explain',
            prompt: item.target,
            answer: markAnswer(item, item.meaning),
            points: points.map(keyPointHtml),
          }
        : { type: 'problem', problem: 'keyPoints' },
    );
  }
  if (f.type === 'worked') {
    const steps = workedStepsOf(item).map((s) => ({ label: stepHtml(s.label), result: stepHtml(s.result) }));
    return out(
      steps.length
        ? { type: 'worked', prompt: item.target, answer: item.meaning, steps }
        : { type: 'problem', problem: 'workedSteps' },
    );
  }
  if (f.type === 'mcq') {
    const m = mcqOf(item);
    return out(m ? { type: 'mcq', stem: item.target, ...m } : { type: 'problem', problem: 'choices' });
  }
  if (f.type === 'order') {
    const steps = stepsOf(item);
    return out(
      steps.length >= 2 ? { type: 'order', prompt: item.target, steps } : { type: 'problem', problem: 'steps' },
    );
  }
  if (f.type === 'code') {
    const task = codeTask(item);
    return out(task ? { type: 'code', prompt: item.target, task } : { type: 'problem', problem: 'code' });
  }
  if (f.type === 'occlusion') {
    if (item.kind !== 'occlusion' || !item.meaning) return out({ type: 'problem', problem: 'occlusion' });
    item.occlusionBoxes = shapes.map((s, i) => ({ id: idOf(i), box: s.box, label: s.label }));
    return out({ type: 'occlusion', prompt: item.target, answer: item.meaning });
  }
  if (f.type === 'numeric' && item.kind !== 'numeric') return out({ type: 'problem', problem: 'number' });
  if (f.type === 'numeric' && f.tolerance.trim() && !parseTolerance(f.tolerance))
    return out({ type: 'problem', problem: 'tolerance' });
  const q = qa(item);
  if (q.typeable) {
    const ex = typed(item);
    if (ex.type === 'typed') {
      const [answer = '', ...also] = ex.accepted;
      return out({ type: 'typed', prompt: ex.prompt, answer, also, mediaFirst: ex.prompt === item.target });
    }
  }
  return out({
    type: 'flip',
    prompt: q.prompt,
    answer: markAnswer(item, q.answer),
    mediaFirst: q.prompt !== item.meaning,
  });
}

/** Sort dropped files into the card's media slots (the last file of a kind wins); name the ones that can't go on a card. */
export function sortDrop(files: { name: string }[]): {
  slots: Partial<Record<MediaSlot, number>>;
  rejected: string[];
} {
  const slots: Partial<Record<MediaSlot, number>> = {};
  const rejected: string[] = [];
  files.forEach((f, i) => {
    const kind = mediaKind(f.name);
    if (kind) slots[kind] = i;
    else rejected.push(f.name);
  });
  return { slots, rejected };
}
