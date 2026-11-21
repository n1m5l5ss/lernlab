// Card editor logic: the form, the live preview (built like the saved card and the real exercise) and media drops.
import { mcqOf, qa, stepsOf } from '@lernlab/core/cards';
import { cloze, typed } from '@lernlab/core/exercises';
import { cardToItem, mediaKind, type NormalizedCard } from '@lernlab/core/library';
import { parseTolerance } from '@lernlab/core/numeric';
import { codeTask, type CodeTask } from '@lernlab/core/code';
import { formatBox } from '@lernlab/core/occlusion';
import type { Shape } from './occlusion-logic';
import type { Item } from '@lernlab/core/types';
import type { OutputOf } from '../backend/handlers';

type FullCard = OutputOf<'cards.get'>;
export type CardType = 'basic' | 'cloze' | 'mcq' | 'order' | 'numeric' | 'code' | 'occlusion';
export const CARD_TYPES: CardType[] = ['basic', 'cloze', 'mcq', 'order', 'numeric', 'code', 'occlusion'];
const STORED_TYPES = new Set<string>(CARD_TYPES);
export type MediaSlot = 'image' | 'audio' | 'video';

export const EMPTY = {
  front: '',
  back: '',
  example: '',
  exampleTranslation: '',
  explanation: '',
  notes: '',
  category: '',
  tags: '',
  image: '',
  imageAlt: '',
  audio: '',
  video: '',
  alt: '',
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
};
export type Form = typeof EMPTY & { id?: number; suspended?: boolean; starred?: boolean; item?: FullCard };

export const formFor = (c: FullCard): Form => ({
  id: c.id,
  front: c.target,
  back: c.meaning,
  example: c.sentenceHtml,
  exampleTranslation: c.sentenceMeaning,
  explanation: c.grammar,
  notes: c.notes,
  category: c.category ?? '',
  tags: c.tags.join(' '),
  image: c.image ?? '',
  imageAlt: c.extra.imageAlt ?? '',
  audio: c.audio ?? '',
  video: c.video ?? '',
  alt: c.extra.alt ?? '',
  type: STORED_TYPES.has(c.kind) ? (c.kind as CardType) : 'basic',
  choices: c.extra.choices ?? '',
  correct: c.extra.correct ?? '',
  steps: c.extra.steps ?? '',
  tolerance: c.extra.tolerance ?? '',
  code: c.extra.code ?? '',
  codeLang: c.extra.codeLang ?? '',
  occlusion: c.extra.occlusion ?? '',
  occlusionGroup: c.extra.occlusionGroup ?? '',
  occlusionMode: c.extra.occlusionMode ?? 'one',
  suspended: c.suspended,
  starred: c.starred,
  item: c,
});

/** The image description field shows while the card has an image (it is the image's alt text). */
export const showImageAlt = (f: Pick<Form, 'image'>) => !!f.image;

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
  | { type: 'cloze'; before: string; after: string; answer: string; hint: string; extra: string }
  | { type: 'mcq'; stem: string; choices: string[]; correct: number[] }
  | { type: 'order'; prompt: string; steps: string[] }
  | { type: 'code'; prompt: string; task: CodeTask }
  /** The asked box hidden on the picture (the item carries its group's boxes). */
  | { type: 'occlusion'; prompt: string; answer: string }
  /** The card would not study as the chosen type: say what is missing. */
  | { type: 'problem'; problem: 'noGap' | 'choices' | 'steps' | 'number' | 'tolerance' | 'code' | 'occlusion' };
export type Preview = { item: Item; view: PreviewView; explanation: string };

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
  const out = (view: PreviewView): Preview => ({ item, view, explanation });
  if (f.type === 'cloze') {
    const ex = item.kind === 'cloze' ? cloze(item) : null;
    if (ex?.type !== 'cloze') return out({ type: 'problem', problem: 'noGap' });
    const answer = ex.accepted[0] ?? '';
    return out({ type: 'cloze', before: ex.before, after: ex.after, answer, hint: ex.hint, extra: ex.translation });
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
  return out({ type: 'flip', prompt: q.prompt, answer: q.answer, mediaFirst: q.prompt !== item.meaning });
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
