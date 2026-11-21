// "Explain it" (core/explain.ts, #199): write an explanation, see the model answer, tick the key points you
// covered. The steps, keys and grade of modes/Explain.tsx, as pure functions. There is no clock.
import { explainOutcome, understandingGap, type ExplainOutcome } from '@lernlab/core/explain';

export type ExplainState = {
  /** write → check (answer shown, ticking), or write → gaveUp ("I don't know yet": answer shown, counts as Again). */
  step: 'write' | 'check' | 'gaveUp';
  text: string;
  ticked: boolean[];
  /** "How well do you understand this?" (1–7) before and after; optional, shown only, never graded. */
  before: number | null;
  after: number | null;
};

export const explainStart = (points: number): ExplainState => ({
  step: 'write',
  text: '',
  ticked: Array<boolean>(points).fill(false),
  before: null,
  after: null,
});

export const canCheck = (s: ExplainState) => s.text.trim().length > 0;

export const toggle = (s: ExplainState, i: number): ExplainState => ({
  ...s,
  ticked: s.ticked.map((v, j) => (j === i ? !v : v)),
});

export type ExplainKeyAction = 'check' | 'done' | 'next' | 'no' | 'partly' | 'yes';

/**
 * A key press: Ctrl/Cmd+Enter checks what you wrote; after the reveal, Enter finishes ticking (also from a
 * checkbox, but not on a button, which handles Enter itself), or 1–3 rate a card without key points.
 * `onButton`: the key went to a button or a rating option.
 */
export function explainKey(
  s: ExplainState,
  e: { key: string; ctrl: boolean; onButton: boolean; points: number },
): ExplainKeyAction | null {
  if (s.step === 'write') return e.key === 'Enter' && e.ctrl && canCheck(s) ? 'check' : null;
  if (e.key === 'Enter' && e.onButton) return null;
  if (s.step === 'gaveUp') return e.key === 'Enter' ? 'next' : null;
  if (e.points) return e.key === 'Enter' ? 'done' : null;
  return ({ '1': 'no', '2': 'partly', '3': 'yes' } as Record<string, ExplainKeyAction>)[e.key] ?? null;
}

const count = (ticked: boolean[]) => ticked.filter(Boolean).length;

/** The answer for the ticked points: all Good, some Hard, none Again; Easy only when all are ticked. */
export const explainResult = (s: ExplainState, easy = false): ExplainOutcome =>
  explainOutcome(count(s.ticked), s.ticked.length, easy);

/** A card without key points (tagged why/how) is rated as a flip card: didn't know, partly, knew it. */
export const rateResult = (r: 0 | 1 | 2): ExplainOutcome => ({ correct: r > 0, nearMiss: r === 1, easy: false });

/** The line under the checklist that says what the ticks count as. */
export const resultKey = (ticked: boolean[]) =>
  count(ticked) === ticked.length
    ? 'ex.explain.resultAll'
    : count(ticked)
      ? 'ex.explain.resultSome'
      : 'ex.explain.resultNone';

/** What the two understanding ratings say, when both were given. */
export function gapKey(before: number | null, after: number | null) {
  const gap = understandingGap(before, after);
  return gap === null ? null : gap < 0 ? 'ex.explain.gapDown' : gap > 0 ? 'ex.explain.gapUp' : 'ex.explain.gapSame';
}
