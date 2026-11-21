// The guess-first round (modes/Guess.tsx): guess, see the answer, go on. Nothing in it is checked or saved.

export type GuessState = {
  /** Index of the question shown. */
  i: number;
  revealed: boolean;
  /** What the learner typed, if anything (a guess is optional). */
  guess: string;
  /** Multiple-choice questions: the choice picked as the guess. */
  picked: number | null;
};

export type GuessAction =
  { type: 'type'; text: string } | { type: 'pick'; choice: number } | { type: 'reveal' } | { type: 'next' };

export const GUESS_START: GuessState = { i: 0, revealed: false, guess: '', picked: null };

/** One step of the round; 'done' after the answer to the last question. */
export function guessStep(s: GuessState, a: GuessAction, total: number): GuessState | 'done' {
  switch (a.type) {
    case 'type':
      return s.revealed ? s : { ...s, guess: a.text };
    case 'pick':
      return s.revealed ? s : { ...s, picked: a.choice, revealed: true };
    case 'reveal':
      return { ...s, revealed: true };
    case 'next':
      if (!s.revealed) return s;
      return s.i + 1 >= total ? 'done' : { ...GUESS_START, i: s.i + 1 };
  }
}

/** Keyboard: Enter shows the answer, then goes on; 1–n picks a choice of a multiple-choice question. */
export function guessKey(key: string, s: GuessState, choices: number): GuessAction | null {
  if (key === 'Enter') return s.revealed ? { type: 'next' } : { type: 'reveal' };
  const n = Number(key);
  if (!s.revealed && choices && Number.isInteger(n) && n >= 1 && n <= choices) return { type: 'pick', choice: n - 1 };
  return null;
}
