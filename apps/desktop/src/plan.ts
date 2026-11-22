// Client-side exercise builders (boss, rescue and action rounds are assembled on the fly).
import { qa } from '@lernlab/core/cards';
import { codeExercise, explain, hintSource, myth, twin, worked } from '@lernlab/core/exercises';
import { isWorked } from '@lernlab/core/worked';
import { asksWhy, isExplain } from '@lernlab/core/explain';
import { isMyth } from '@lernlab/core/misconceptions';
import { isTwin } from '@lernlab/core/twin';
import { stripHtml } from '@lernlab/core/text';
import type { Exercise, Item } from '@lernlab/core/types';

export function typedFor(item: Item): Extract<Exercise, { type: 'typed' }> {
  const q = qa(item);
  const core = hintSource(q.requireArticle ? item.word : q.accepted[0]);
  return {
    type: 'typed',
    itemId: item.id,
    prompt: stripHtml(q.prompt) + (q.requireArticle ? ' · noun + article' : ''),
    accepted: q.accepted,
    requireArticle: q.requireArticle,
    hint: `${core[0]}${core.slice(1).replace(/[^\s]/g, '_')} (${core.length})`,
  };
}

export function recallFor(item: Item): Exercise {
  if (isMyth(item)) return myth(item);
  if (isExplain(item)) return explain(item);
  if (isTwin(item)) return twin(item);
  if (isWorked(item)) return worked(item); // on the rung the session planned (core/worked.ts)
  const code = item.kind === 'code' ? codeExercise(item) : null;
  if (code) return code;
  const q = qa(item);
  // A card tagged why/how is explained first (core/explain.ts), unless its short answer is typed as asked.
  if (asksWhy(item) && !(q.typeable && q.prompt === item.target)) return explain(item);
  return q.typeable
    ? typedFor(item)
    : { type: 'flip', itemId: item.id, prompt: q.prompt, answer: q.answer, reverse: q.prompt === item.meaning };
}

export function mcFor(item: Item, pool: Item[]): Extract<Exercise, { type: 'mc' }> {
  const back = (i: Item) => stripHtml(i.meaning);
  const picks: string[] = [];
  for (const o of pool
    .filter((p) => p.id !== item.id && back(p) !== back(item) && p.kind !== 'grammar')
    .sort(() => Math.random() - 0.5)) {
    if (!picks.includes(back(o))) picks.push(back(o));
    if (picks.length === 3) break;
  }
  const options = [back(item), ...picks].sort(() => Math.random() - 0.5);
  return {
    type: 'mc',
    itemId: item.id,
    direction: 'de2en',
    prompt: stripHtml(item.target),
    options,
    answerIndex: options.indexOf(back(item)),
  };
}
