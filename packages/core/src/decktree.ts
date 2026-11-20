// Sub-decks are written as a path in the deck name, Anki style: "Medicine::Cardio::ECG".
// This turns a flat deck list into a tree, adding up each branch's counts.

export const DECK_SEPARATOR = '::';

export type DeckCounts = { cards: number; due: number; fresh: number; learned: number };
export type DeckNode<D> = {
  /** The last part of the path, e.g. "Cardio". */
  label: string;
  /** The full path, e.g. "Medicine::Cardio". */
  path: string;
  /** The deck at this path, if there is one (a parent can exist only as a path). */
  deck: D | null;
  children: DeckNode<D>[];
  /** This deck and everything below it. */
  totals: DeckCounts;
  /** Ids of every deck in this branch, for studying the whole branch. */
  deckIds: number[];
};

const splitPath = (name: string) =>
  name
    .split(DECK_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);

export function deckTree<D extends DeckCounts & { id: number; name: string }>(decks: D[]): DeckNode<D>[] {
  const root: DeckNode<D>[] = [];
  const byPath = new Map<string, DeckNode<D>>();
  const zero = (): DeckCounts => ({ cards: 0, due: 0, fresh: 0, learned: 0 });
  for (const deck of decks) {
    const parts = splitPath(deck.name);
    if (!parts.length) parts.push(deck.name);
    let level = root;
    const chain: DeckNode<D>[] = [];
    parts.forEach((label, i) => {
      const path = parts.slice(0, i + 1).join(DECK_SEPARATOR);
      let node = byPath.get(path.toLowerCase());
      if (!node) {
        node = { label, path, deck: null, children: [], totals: zero(), deckIds: [] };
        byPath.set(path.toLowerCase(), node);
        level.push(node);
      }
      chain.push(node);
      level = node.children;
    });
    const own = chain[chain.length - 1];
    if (!own.deck) own.deck = deck;
    for (const node of chain) {
      node.deckIds.push(deck.id);
      for (const k of ['cards', 'due', 'fresh', 'learned'] as const) node.totals[k] += deck[k];
    }
  }
  const order = (nodes: DeckNode<D>[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label));
    nodes.forEach((n) => order(n.children));
    return nodes;
  };
  return order(root);
}
