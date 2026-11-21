// Typed-answer checking for the session: numeric cards by number, tolerance and unit; everything else
// (including math, compared by its source) by the text rules in core.
import { hintSource } from '@lernlab/core/exercises';
import { checkNumeric, numericOf } from '@lernlab/core/numeric';
import { checkAnswer, type CheckResult } from '@lernlab/core/text';
import type { Format, Item } from '@lernlab/core/types';

export function checkTyped(
  item: Item,
  format: Format,
  input: string,
  accepted: string[],
  requireArticle: boolean,
): CheckResult {
  const numeric = format === 'cloze' ? null : numericOf(item);
  if (!numeric || accepted[0] !== numeric.text) return checkAnswer(input, accepted, { requireArticle });
  const r = checkNumeric(input, numeric);
  if (r.correct || accepted.length < 2) return r;
  // "Also accept" answers on a numeric card are text (e.g. a symbol).
  const alt = checkAnswer(input, accepted.slice(1));
  return alt.correct ? alt : r;
}

/** An answer as plain text to copy (a formula without its \( \) delimiters). */
export const plainAnswer = hintSource;
