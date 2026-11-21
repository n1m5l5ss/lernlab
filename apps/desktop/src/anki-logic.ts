// Picking decks to bring over from a running Anki. A parent deck includes its subdecks.

/** A deck inside a selected parent comes along anyway. */
export const coveredByParent = (name: string, selected: ReadonlySet<string>) =>
  [...selected].some((p) => p !== name && name.startsWith(`${p}::`));

/** Tick or untick a deck. Ticking a parent drops its subdecks from the selection (they come along). */
export function toggleDeck(selected: ReadonlySet<string>, name: string): Set<string> {
  const next = new Set(selected);
  if (next.has(name)) next.delete(name);
  else {
    next.add(name);
    for (const s of next) if (s.startsWith(`${name}::`)) next.delete(s);
  }
  return next;
}

/** The decks to import: the ticked ones, without subdecks of ticked parents. */
export const decksToImport = (selected: ReadonlySet<string>) =>
  [...selected].filter((s) => !coveredByParent(s, selected));

/** How deep a deck is nested (Lang::German → 1), for indenting the list. */
export const depth = (name: string) => name.split('::').length - 1;

/** The last part of a deck name, as shown in the list. */
export const leafName = (name: string) => name.split('::').pop() ?? name;

/** Total cards of the decks to import, or null if Anki did not give a count for one of them. */
export function selectedCards(decks: { name: string; cards: number | null }[], selected: ReadonlySet<string>) {
  let total = 0;
  for (const name of decksToImport(selected)) {
    const n = decks.find((d) => d.name === name)?.cards;
    if (n === null || n === undefined) return null;
    total += n;
  }
  return total;
}
