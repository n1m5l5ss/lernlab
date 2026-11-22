// Worked examples that fade (core/worked.ts, #206): the first steps of a solved problem are shown, the last
// ones are typed one at a time. The steps, keys and result of modes/Worked.tsx, as pure functions. No clock.
import { checkStep, workedOutcome } from '@lernlab/core/worked';
import type { Exercise, Format } from '@lernlab/core/types';

export type WorkedEx = Extract<Exercise, { type: 'worked' }>;
type StepResult = { given: string; correct: boolean; nearMiss: boolean };
export type WorkedState = { input: string; results: StepResult[] };

export const workedStart = (): WorkedState => ({ input: '', results: [] });

/** study: the full example; fade: the last steps are blank (practice); whole: every step is (the real recall). */
export const modeOf = (ex: WorkedEx): 'study' | 'fade' | 'whole' =>
  ex.blanks <= 0 ? 'study' : ex.blanks >= ex.steps.length ? 'whole' : 'fade';

const firstBlank = (ex: WorkedEx) => ex.steps.length - ex.blanks;
export const isDone = (ex: WorkedEx, s: WorkedState) => s.results.length >= ex.blanks;
/** The step being asked now (its index), or -1 when none is left. */
export const currentStep = (ex: WorkedEx, s: WorkedState) => (isDone(ex, s) ? -1 : firstBlank(ex) + s.results.length);

/** How step `i` shows: given by the example, answered right or wrong, asked now, or still to come. */
export function stepView(ex: WorkedEx, s: WorkedState, i: number): 'given' | 'right' | 'wrong' | 'ask' | 'later' {
  const r = s.results[i - firstBlank(ex)];
  if (i < firstBlank(ex)) return 'given';
  if (r) return r.correct ? 'right' : 'wrong';
  return i === currentStep(ex, s) ? 'ask' : 'later';
}

/** What the learner typed for step `i` ('' when it was not asked or skipped). */
export const givenFor = (ex: WorkedEx, s: WorkedState, i: number) => s.results[i - firstBlank(ex)]?.given ?? '';

/** Check what is typed against the current step and move to the next one. */
export function submitStep(ex: WorkedEx, s: WorkedState): WorkedState {
  const i = currentStep(ex, s);
  if (i < 0 || !s.input.trim()) return s;
  const r = checkStep(s.input, ex.steps[i].result);
  return { input: '', results: [...s.results, { given: s.input, correct: r.correct, nearMiss: r.nearMiss }] };
}

/** "I don't know": the current step counts as wrong and shows its result. */
export const skipStep = (ex: WorkedEx, s: WorkedState): WorkedState =>
  isDone(ex, s) ? s : { input: '', results: [...s.results, { given: '', correct: false, nearMiss: false }] };

/** "I was right": the checker was too strict about answered step `n` (counted from the first blank). */
export const countRight = (s: WorkedState, n: number): WorkedState => ({
  ...s,
  results: s.results.map((r, k) => (k === n ? { ...r, correct: true, nearMiss: false } : r)),
});

/**
 * The answer to record once every blank is filled. Only the whole problem is a real recall (format 'worked');
 * studying the example and the faded rungs are practice ('ladder'), which never grades a card.
 */
export function workedAnswer(ex: WorkedEx, s: WorkedState) {
  const whole = modeOf(ex) === 'whole';
  const format: Format = whole ? 'worked' : 'ladder';
  return { format, practice: !whole, ...workedOutcome(s.results), given: s.results.map((r) => r.given).join(' | ') };
}

/** Enter checks the typed step, or continues when no step is left; a button handles its own Enter. */
export function workedKey(
  ex: WorkedEx,
  s: WorkedState,
  e: { key: string; onButton: boolean },
): 'check' | 'finish' | null {
  if (e.key !== 'Enter' || e.onButton) return null;
  return isDone(ex, s) ? 'finish' : 'check';
}
