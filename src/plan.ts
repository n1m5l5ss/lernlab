// Client-side exercise builders (boss, rescue and action rounds are assembled on the fly).
import { qa } from '../shared/cards';
import { stripHtml } from '../shared/text';
import type { Exercise, Item } from '../shared/types';

export function typedFor(item: Item): Extract<Exercise, { type: 'typed' }> {
  const q = qa(item);
  const core = q.requireArticle ? item.word : q.accepted[0];
  return {
    type: 'typed', itemId: item.id, prompt: stripHtml(q.prompt) + (q.requireArticle ? ' · noun + article' : ''),
    accepted: q.accepted, requireArticle: q.requireArticle, hint: `${core[0]}${core.slice(1).replace(/[^\s]/g, '_')} (${core.length})`,
  };
}

export function recallFor(item: Item): Exercise {
  const q = qa(item);
  return q.typeable ? typedFor(item) : { type: 'flip', itemId: item.id, prompt: q.prompt, answer: q.answer, reverse: q.prompt === item.meaning };
}

export function mcFor(item: Item, pool: Item[]): Extract<Exercise, { type: 'mc' }> {
  const back = (i: Item) => stripHtml(i.meaning);
  const picks: string[] = [];
  for (const o of pool.filter((p) => p.id !== item.id && back(p) !== back(item) && p.kind !== 'grammar').sort(() => Math.random() - 0.5)) {
    if (!picks.includes(back(o))) picks.push(back(o));
    if (picks.length === 3) break;
  }
  const options = [back(item), ...picks].sort(() => Math.random() - 0.5);
  return { type: 'mc', itemId: item.id, direction: 'de2en', prompt: stripHtml(item.target), options, answerIndex: options.indexOf(back(item)) };
}
