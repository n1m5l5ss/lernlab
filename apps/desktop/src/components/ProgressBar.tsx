// ProgressBar: a bar with role="progressbar", so screen readers hear the value, not just see a colour.
import type { CSSProperties } from 'react';
import { cx, progressFraction } from './logic';
import styles from './ProgressBar.module.css';

export type ProgressBarProps = {
  value: number;
  max: number;
  min?: number;
  /** The accessible name, e.g. t('session.blockProgress'). Give this or labelledBy. */
  label?: string;
  /** The id of visible text that names the bar, e.g. a tile's heading. */
  labelledBy?: string;
  /** Read out instead of the bare number, e.g. "5 of 12". */
  valueText?: string;
  /** meter: 8 px and rounded (Home tiles); session: the 4 px bar along the top of the study screen. */
  variant?: 'meter' | 'session';
  className?: string;
};

const VARIANT_CLASS = { meter: 'meter', session: 'session-bar' } as const;

export function ProgressBar({
  value,
  max,
  min = 0,
  label,
  labelledBy,
  valueText,
  variant = 'meter',
  className,
}: ProgressBarProps) {
  const fill: CSSProperties = { width: `${progressFraction(value, max, min) * 100}%` };
  return (
    <div
      className={cx(styles[VARIANT_CLASS[variant]], className)}
      role="progressbar"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(min, value))}
      aria-valuetext={valueText}
    >
      <i style={fill} />
    </div>
  );
}
