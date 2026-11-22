// "Act it out" (#225). Doing an action while you learn its name makes it more memorable (the enactment
// effect, g = 0.79 between subjects, mostly with action phrases [Roberts, MacLeod & Fernandes 2022]). It
// suits verbs in language decks, procedures and sign language, so a session asks for it on action cards
// only: cards tagged `action`, and verbs in language decks. Like "say it aloud" (sayaloud.ts) it is kept to
// a minority of the cards and is a prompt only: nothing is checked and the card is graded as usual.
// Nothing is stored on a card for it, so importing cards costs nothing extra.
import { sayAloudCap } from './sayaloud';
import type { Block, Exercise, Item } from './types';

/** Tags that mark a card as an action to act out. */
export const ACTION_TAGS = ['action', 'actions', 'act-it-out'];

/** Is this card an action? Tagged as one, or a verb in a language deck. */
export const isAction = (item: Pick<Item, 'tags' | 'kind' | 'lang'>): boolean =>
  (item.kind === 'verb' && !!item.lang) || item.tags.some((t) => ACTION_TAGS.includes(t.trim().toLowerCase()));

type Actable = Extract<Exercise, { type: 'intro' | 'flip' | 'typed' }>;
/** The exercises that show a card's answer in full: a new card's intro, a flip card, a typed answer. */
const actable = (e: Exercise): e is Actable => e.type === 'intro' || e.type === 'flip' || e.type === 'typed';

/**
 * Mark a few exercises of a plan with "act it out": action cards only, each card once (on its first
 * showing), at most about 1 card in 5 of the cards asked this way, and never a card already said aloud.
 */
export function markActOut(blocks: Block[], action: (itemId: number) => boolean): void {
  const all = blocks.flatMap((b) => ('exercises' in b ? b.exercises.filter(actable) : []));
  const cards = new Set(all.map((e) => e.itemId));
  let left = sayAloudCap(cards.size);
  const spoken = new Set(all.filter((e) => e.type === 'flip' && e.sayAloud).map((e) => e.itemId));
  const done = new Set<number>();
  for (const e of all) {
    if (!left) break;
    if (done.has(e.itemId) || spoken.has(e.itemId) || !action(e.itemId)) continue;
    e.actOut = true;
    done.add(e.itemId);
    left--;
  }
}
