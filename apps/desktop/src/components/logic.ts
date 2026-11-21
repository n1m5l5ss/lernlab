// Pure helpers shared by the base components (tested in logic.test.ts).

/** Joins class names, skipping empty ones: cx('btn', primary && 'primary') → "btn primary". */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** How full a progress bar is, from 0 to 1. An empty or broken range shows an empty bar. */
export function progressFraction(value: number, max: number, min = 0): number {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - min) / span));
}

/** The ids of a field's hint and error, for aria-describedby (undefined when there are none). */
export function fieldIds(id: string, hint: unknown, error: unknown) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return { hintId, errorId, describedBy: cx(hintId, errorId) || undefined };
}
