import type { Line } from '@lernlab/core/teacher';
import type { Format, Item, SessionPlan } from '@lernlab/core/types';
import type { TextTeacher } from './lines';

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
  lang: string | null;
  /** Teacher lines as ready-to-show text in the interface (or deck) language. */
  t: TextTeacher;
  /** Seconds per multiple-choice/true-false question (0 = untimed). */
  timer: number;
  item: (id: number) => Item;
  pool: Item[];
  answer: (a: AnswerInput) => number;
  /** "I was right": undo today's failing grade for this card. */
  override: (itemId: number) => void;
  combo: number;
  missed: Set<number>;
  /** Show a line in the speech bubble (a core Line, or text already translated). */
  teacher: (line: Line | string) => void;
  settings: { sound: boolean; teacherVoice: boolean; questionTimer?: number; blitzSeconds?: number };
};

/** A shrinking bar for timed questions; calls onTimeout once. */
import { createElement, useState as useS, useEffect as useE } from 'react';
export function QuestionTimer({
  seconds,
  running,
  onTimeout,
}: {
  seconds: number;
  running: boolean;
  onTimeout: () => void;
}) {
  const [left, setLeft] = useS(seconds * 1000);
  const cb = useRef(onTimeout);
  cb.current = onTimeout;
  useE(() => {
    if (!running || !seconds) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const l = seconds * 1000 - (performance.now() - start);
      setLeft(Math.max(0, l));
      if (l <= 0) cb.current();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, seconds]);
  if (!seconds) return null;
  const pct = (left / (seconds * 1000)) * 100;
  return createElement(
    'div',
    { className: 'qtimer' },
    createElement('i', { style: { width: `${pct}%`, background: pct < 30 ? 'var(--bad)' : undefined } }),
  );
}

export type BlockResult = {
  correct: number;
  total: number;
  bossWon?: boolean | null;
  bestCombo?: number;
  missedIds?: number[];
};

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
