// Client-side exercise builders (for blocks the client assembles on the fly: boss, rescue rounds).
import { acceptedAnswers } from '../shared/text';
import type { Exercise, Item } from '../shared/types';

export function typedFor(item: Item): Extract<Exercise, { type: 'typed' }> {
  const accepted = acceptedAnswers(item.target);
  const core = item.kind === 'noun' ? item.word : accepted[0];
  return {
    type: 'typed',
    itemId: item.id,
    prompt: item.meaning + (item.kind === 'noun' ? ' · Nomen mit Artikel' : ''),
    accepted,
    requireArticle: item.kind === 'noun',
    hint: `${core[0]}${'_'.repeat(Math.max(0, core.length - 1))} (${core.length})`,
  };
}

export function mcFor(item: Item, pool: Item[]): Extract<Exercise, { type: 'mc' }> {
  const others = pool.filter((p) => p.id !== item.id && p.meaning !== item.meaning && p.kind !== 'grammar');
  const picks: string[] = [];
  for (const o of others.sort(() => Math.random() - 0.5)) {
    if (!picks.includes(o.meaning)) picks.push(o.meaning);
    if (picks.length === 3) break;
  }
  const options = [item.meaning, ...picks].sort(() => Math.random() - 0.5);
  return { type: 'mc', itemId: item.id, direction: 'de2en', prompt: item.target, options, answerIndex: options.indexOf(item.meaning) };
}
