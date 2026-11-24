// Translate cards (#210), `type: translate` in deck files: a card whose front and back are two representations
// of one idea (a graph and its formula, a formula and its diagram, an example and the concept's name). It is
// asked in both directions, in turn from review to review: several representations help only when learners
// practise translating between them [Ainsworth 2006]. Each direction is a real recall, graded once a day like
// any card. Stored as a basic card with a flag in its extra fields (no migration); older readers get a basic card.
import type { Item } from './types';

export const isTranslate = (item: Pick<Item, 'extra'>): boolean => item.extra?.translate === '1';

/** A translate card is asked the other way round on every second review; a new card starts the usual way. */
export const asksOtherWay = (item: Pick<Item, 'extra'>, reviews: number): boolean =>
  isTranslate(item) && reviews % 2 === 1;
