import type { Format, Item, SessionPlan } from '../shared/types';

export type AnswerInput = {
  itemId: number;
  format: Format;
  correct: boolean;
  nearMiss?: boolean;
  articleError?: boolean;
  usedHint?: boolean;
  firstTry?: boolean;
  given?: string;
  genderOnly?: boolean;
  shownAt: number;
  silent?: boolean; // no sound/XP float (e.g. intro)
};

export type Ctx = {
  plan: SessionPlan;
  item: (id: number) => Item;
  pool: Item[];
  answer: (a: AnswerInput) => number;
  combo: number;
  missed: Set<number>;
  teacher: (de: string, en?: string) => void;
  settings: { sound: boolean; teacherVoice: boolean };
};

export type BlockResult = { correct: number; total: number; bossWon?: boolean | null; bestCombo?: number; missedIds?: number[] };

/** Keyboard helper: run handler for keydown while mounted. */
import { useEffect, useRef } from 'react';
export function useKeys(handler: (e: KeyboardEvent) => void, deps: unknown[] = []) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, deps);
}
