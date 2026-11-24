// ConfidenceRow (#205): "How sure were you?" after a recall answer, 1 to 5. One quiet row, optional, never
// timed. A radio group with one tab stop: arrow keys move and choose (WCAG 2.1.1); a click or, with `keys`,
// the keys 1 to 5 choose too, and the caller may take that as "continue". It holds no text of its own.
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Confidence } from '@lernlab/core/confidence';
import { rovingIndex } from '../keys-logic';
import { confidenceKey } from '../session-logic';
import styles from './ConfidenceRow.module.css';

const LEVELS: readonly Confidence[] = [1, 2, 3, 4, 5];

/** How the rating was chosen: a click or a number key ("rate and go on"), or an arrow key (just choose). */
export type ConfidencePick = 'tap' | 'arrow';

export type ConfidenceRowProps = {
  /** The id of the visible question, which names the group. */
  id: string;
  /** "How sure were you?" */
  label: string;
  /** The words under 1 and 5 ("Guessing", "Certain"). */
  low: string;
  high: string;
  /** Each level's name for screen readers, 1 to 5. */
  names: readonly string[];
  value: Confidence | null;
  onPick: (value: Confidence, how: ConfidencePick) => void;
  /** Also listen for the keys 1 to 5 anywhere on the page (when no other control uses them). */
  keys?: boolean;
};

export function ConfidenceRow({ id, label, low, high, names, value, onPick, keys = false }: ConfidenceRowProps) {
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const n = e.altKey || e.ctrlKey || e.metaKey || e.repeat ? null : confidenceKey(e.key);
      if (n === null) return;
      e.preventDefault(); // the answer field may still have focus: the digit is a rating, not text
      pick.current(n, 'tap');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const i = rovingIndex(value ? value - 1 : -1, LEVELS.length, e.key, rtl);
    if (i === null) return;
    e.preventDefault();
    onPick(LEVELS[i], 'arrow');
    (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
  };
  const stop = value ?? 1;
  return (
    <div className={styles.confidence}>
      <span id={id} className={styles.confidenceLabel}>
        {label}
      </span>
      <div className={styles.levels}>
        <div role="radiogroup" aria-labelledby={id} className={styles.buttons} onKeyDown={onKeyDown}>
          {LEVELS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === value}
              aria-label={names[n - 1]}
              tabIndex={n === stop ? 0 : -1}
              onClick={() => onPick(n, 'tap')}
            >
              {n}
            </button>
          ))}
        </div>
        <span className={styles.ends} aria-hidden="true">
          <span>{low}</span>
          <span>{high}</span>
        </span>
      </div>
    </div>
  );
}
