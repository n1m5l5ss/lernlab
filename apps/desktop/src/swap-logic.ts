// Swap a round (#216): once per session the learner can change the round in front of them to another format.
// A swap keeps the cards and what the round is: real recall stays real recall (typed ↔ flip), and practice
// stays practice (a game ↔ an untimed quiz), so a swap never changes which answers can grade a card.
// New cards, lessons, guesses and the optional boss are never swapped. Pure, so it can be tested.
import { qa } from '@lernlab/core/cards';
import { flip, typed } from '@lernlab/core/exercises';
import type { Block, Exercise, Item } from '@lernlab/core/types';
import { takesVariants, variantsOf } from '@lernlab/core/variants';
import { mcFor } from './plan';

/** Most questions in the quiz a game turns into. */
export const SWAP_QUIZ_MAX = 8;
/** Most pairs in the matching round a quiz turns into, as in a planned one. */
const MATCH_MAX = 5;

/** The same recall asked the other way (typed ↔ flip), or null when the card has only one way. */
function otherRecall(e: Exercise, item: Item | undefined): Exercise | null {
  if ((e.type !== 'typed' && e.type !== 'flip') || !item || !takesVariants(item.kind)) return null;
  // A question asked another way (variants.ts) keeps its wording: find which one it was.
  let k = 0;
  if (e.level) {
    const build = e.type === 'typed' ? typed : flip;
    k = variantsOf(item).findIndex((v, i) => v.level === e.level && promptOf(build(item, i + 1)) === e.prompt) + 1;
    if (!k) return null;
  }
  if (e.type === 'typed') return e.code ? null : flip(item, k);
  return qa(item).typeable ? typed(item, k) : null;
}
const promptOf = (e: Exercise) => ('prompt' in e ? e.prompt : null);

/** The round in another format, or null when it has none. */
export function swapBlock(b: Block, item: (id: number) => Item | undefined, pool: Item[]): Block | null {
  const id = `${b.id}-swap`;
  const quiz = (ids: number[]): Block | null => {
    const cards = [...new Set(ids)]
      .map(item)
      .filter((c): c is Item => !!c)
      .slice(0, SWAP_QUIZ_MAX);
    if (!cards.length || pool.length < 4) return null;
    return {
      id,
      kind: 'drill',
      format: 'mc',
      title: 'Review',
      teacher: b.teacher,
      exercises: cards.map((c) => mcFor(c, pool)),
    };
  };
  switch (b.kind) {
    case 'match':
    case 'rain':
    case 'gender':
      return quiz(b.itemIds);
    case 'blitz':
      return { id, kind: 'drill', format: 'mc', title: 'Review', teacher: b.teacher, exercises: b.exercises };
    case 'drill': {
      const ids = [...new Set(b.exercises.map((e) => ('itemId' in e ? e.itemId : 0)))];
      if (b.exercises.every((e) => e.type === 'mc') && ids.length >= 4)
        return { id, kind: 'match', title: 'Match pairs', teacher: b.teacher, itemIds: ids.slice(0, MATCH_MAX) };
      let changed = false;
      const exercises = b.exercises.map((e) => {
        const other = otherRecall(e, 'itemId' in e ? item(e.itemId) : undefined);
        if (other) changed = true;
        return other ?? e;
      });
      return changed ? { ...b, id, exercises } : null;
    }
    default:
      return null;
  }
}

/** Whether "Swap this round" is offered: once per session, before the round's first answer, when it has another format. */
export const canSwap = (s: {
  used: boolean;
  started: boolean;
  block: Block;
  item: (id: number) => Item | undefined;
  pool: Item[];
}) => !s.used && !s.started && swapBlock(s.block, s.item, s.pool) !== null;
