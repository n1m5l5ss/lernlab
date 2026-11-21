// SegmentedControl: pick one of a few options (session length, timers). A radio group with one tab stop:
// arrow keys move and choose, Home/End jump, and right to left the arrows follow the text (WCAG 2.1.1).
import type { KeyboardEvent, ReactNode } from 'react';
import { rovingIndex } from '../keys-logic';
import { cx } from './logic';
import styles from './SegmentedControl.module.css';

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

export type SegmentedControlProps<T extends string> = {
  value: T | null;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** The id of the visible text that names the group; or give `label`. */
  labelledBy?: string;
  label?: string;
  className?: string;
};

/** The option that holds the group's one tab stop: the chosen one, else the first. */
export function tabStop<T extends string>(options: readonly SegmentedOption<T>[], value: T | null): T | undefined {
  return options.some((o) => o.value === value) ? (value as T) : options[0]?.value;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  labelledBy,
  label,
  className,
}: SegmentedControlProps<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const i = rovingIndex(
      options.findIndex((o) => o.value === value),
      options.length,
      e.key,
      rtl,
    );
    if (i === null) return;
    e.preventDefault();
    onChange(options[i].value);
    (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
  };
  const stop = tabStop(options, value);
  return (
    <div
      className={cx(styles.segmented, className)}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === stop ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
