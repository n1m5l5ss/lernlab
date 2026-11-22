// Worked examples that fade (#206, the "example ladder"): a card for maths, science, code and accounting. Its
// author writes one solved problem in 2–8 steps. The learner first studies the full example, then fills in the
// last step, then the last two, and so on until they solve the whole problem. Worked examples help, g = 0.48
// [Barbieri et al. 2023]; fading the steps eases the move to solving alone [Renkl & Atkinson 2003]; and because
// the benefit fades with skill, performance drives the fading [Kalyuga et al. 2003]: a rung done right moves
// one up, a miss one down. Only the whole problem is a real recall (FSRS); every other rung is practice.
// Stored in the card's extra fields as one line of plain text, steps separated by '|' like choices, each
// "what you do :: result" (no migration). CSV and .lernpack carry the same line.
import { correctionHtml } from './misconceptions';
import { hasMath } from './math';
import { checkNumeric, parseQuantity } from './numeric';
import { checkAnswer, stripHtml, type CheckResult } from './text';
import type { Item } from './types';

/** A worked example has 2–8 steps; labels and results are at most this long (deck files are untrusted). */
export const WORKED_STEPS_MIN = 2;
export const WORKED_STEPS_MAX = 8;
export const WORKED_LABEL_MAX_LENGTH = 300;
export const WORKED_RESULT_MAX_LENGTH = 200;

/** One step: what you do ('' for none) and its result, which the learner types on a faded rung. */
export type WorkedStep = { label: string; result: string };

/** Plain text that stays the same when read again (stripHtml decodes one level of entities per pass). */
function plain(text: string, max: number): string {
  let s = stripHtml(text);
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, max));
}

/** Read the steps line: "label :: result" per step (the first '::' splits), steps without a result dropped. */
export function parseWorkedSteps(line: string | undefined): WorkedStep[] {
  const out: WorkedStep[] = [];
  for (const part of (line ?? '').split('|')) {
    const at = part.indexOf('::');
    const result = plain(at < 0 ? part : part.slice(at + 2), WORKED_RESULT_MAX_LENGTH);
    if (!result) continue;
    // A label can't hold '::': it would split the step somewhere else when the line is read again.
    const label = at < 0 ? '' : plain(part.slice(0, at), WORKED_LABEL_MAX_LENGTH).replace(/::+/g, ':').trim();
    out.push({ label, result });
    if (out.length === WORKED_STEPS_MAX) break;
  }
  return out;
}

const stepText = (s: WorkedStep) =>
  s.label ? `${s.label} :: ${s.result}` : s.result.includes('::') ? `:: ${s.result}` : s.result;

/** The steps line in its one canonical form; '' when there are fewer than two (not a worked example). */
export function cleanWorkedSteps(line: string | undefined): string {
  const list = parseWorkedSteps(line);
  return list.length >= WORKED_STEPS_MIN ? list.map(stepText).join('|') : '';
}

/** Write a list of steps as the line. A '|' inside a step becomes '/', so it can't split it. */
export const formatWorkedSteps = (list: WorkedStep[]): string =>
  cleanWorkedSteps(
    list
      .map((s) => ({ label: s.label.replace(/\|/g, '/').replace(/::+/g, ':'), result: s.result.replace(/\|/g, '/') }))
      .map((s) => (s.label.trim() ? `${s.label} :: ${s.result}` : `:: ${s.result}`))
      .join('|'),
  );

export const workedStepsOf = (item: Pick<Item, 'extra'>): WorkedStep[] => parseWorkedSteps(item.extra?.workedSteps);

/** A worked example: a basic card whose extra fields hold its steps (cardToItem keeps them only then). */
export const isWorked = (item: Pick<Item, 'extra'>): boolean => !!item.extra?.workedSteps;

/** Step text as safe HTML to show: escaped, with **bold**, *italic* and `code` (formulas are drawn by the app). */
export const stepHtml = correctionHtml;

/** The steps as plain lines ("1. Divide by 2: x = 4") for readers that don't know worked examples (Anki). */
export const workedStepsAsText = (steps: WorkedStep[]): string =>
  steps.map((s, i) => `${i + 1}. ${s.label ? `${s.label}: ` : ''}${s.result}`).join('\n');

/**
 * The rung a card is on, 0 to `steps`: how many of its last steps the learner fills in. 0 is "study the full
 * example", `steps` is the whole problem. From the card's ladder answers, oldest first: right moves one up,
 * wrong one down.
 */
export function rungOf(answers: boolean[], steps: number): number {
  let rung = 0;
  for (const right of answers) rung = Math.min(steps, Math.max(0, rung + (right ? 1 : -1)));
  return Math.min(rung, steps);
}

/**
 * Check one typed step with the checks of typed cards: a result that is a number (with an optional unit) by
 * its value, a formula by its LaTeX source, anything else as text (a small typo is a near miss; spaces never matter).
 */
export function checkStep(input: string, result: string): CheckResult {
  // "9.81 m/s^2" is a number; "2x = 8" and "3x + 2" are text (algebra is compared as written).
  const algebra = hasMath(result) || /[=<>]|.[+]|^\s*[+-]?[\d.,]+[a-df-zA-DF-Z]/.test(result);
  const q = algebra ? null : parseQuantity(result);
  if (q) return checkNumeric(input, { ...q, tolerance: q.tolerance ?? null, text: result });
  const r = checkAnswer(input, [result]);
  // Spaces never matter in a step: "x=4" is "x = 4".
  const tight = (t: string) => t.replace(/\s+/g, '');
  return !r.correct && tight(input) && tight(input) === tight(result) ? { ...r, correct: true } : r;
}

/** The answer for the steps a learner filled in: all right → Good, with a slip → Hard, any wrong → Again. */
export const workedOutcome = (steps: Pick<CheckResult, 'correct' | 'nearMiss'>[]) => ({
  correct: steps.every((s) => s.correct),
  nearMiss: steps.every((s) => s.correct) && steps.some((s) => s.nearMiss),
});
