// Pure helpers for the card browser: list windowing and selection.

/** Rows to draw for a scroll position: the ones in view plus `overscan` on each side. */
export function visibleRange(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan = 8) {
  const first = Math.floor(scrollTop / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + Math.ceil(viewport / rowHeight) + overscan);
  return { start, end };
}

/**
 * Selection after clicking the checkbox of row `index`. With shift and an earlier click (`anchor`),
 * every row between the two takes the clicked row's new state.
 */
export function selectClick(
  sel: ReadonlySet<number>,
  ids: readonly number[],
  index: number,
  anchor: number | null,
  shift: boolean,
): Set<number> {
  const next = new Set(sel);
  const on = !sel.has(ids[index]);
  const [from, to] = shift && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index];
  for (let i = from; i <= to; i++) {
    if (on) next.add(ids[i]);
    else next.delete(ids[i]);
  }
  return next;
}
