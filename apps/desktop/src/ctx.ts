import type { Line } from '@lernlab/core/teacher';
import type { Format, Item, SessionPlan } from '@lernlab/core/types';
import type { Level } from '@lernlab/core/variants';
import type { Confidence } from '@lernlab/core/confidence';
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
  /** A card brought back for relearning: logged as practice, never a second grade. */
  practice?: boolean;
  /** Asked with one of the card's question variants: its level. */
  level?: Level;
};

export type Ctx = {
  plan: SessionPlan;
  lang: string | null;
  /** Teacher lines as ready-to-show text in the interface (or deck) language. */
  t: TextTeacher;
  /** Seconds per multiple-choice/true-false question (0 = untimed). */
  timer: number;
  /** True while the leave dialog is open: round clocks stop. */
  paused: boolean;
  item: (id: number) => Item;
  pool: Item[];
  answer: (a: AnswerInput) => number;
  /** "I was right": undo today's failing grade for this card. */
  override: (itemId: number, practice?: boolean) => void;
  combo: number;
  missed: Set<number>;
  /**
   * "How sure were you?" (#205): save the learner's 1–5 rating of their last answer to this card. Only set
   * where the session asks it (a real recall answer, the setting on); never changes the schedule.
   */
  confidence?: (itemId: number, value: Confidence) => void;
  /** Show a line in the speech bubble (a core Line, or text already translated). */
  teacher: (line: Line | string) => void;
  settings: { sound: boolean; teacherVoice: boolean; questionTimer?: number; blitzSeconds?: number };
};

/** A shrinking bar for timed questions; calls onTimeout once. It stops while `running` is false. */
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
  const spent = useRef(0); // carried over a pause, so the clock resumes where it stopped
  useE(() => {
    if (!running || !seconds) return;
    const start = performance.now() - spent.current;
    let raf = 0;
    const tick = () => {
      spent.current = performance.now() - start;
      const l = seconds * 1000 - spent.current;
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
