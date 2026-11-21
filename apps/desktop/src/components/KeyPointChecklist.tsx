// The key points of an explain card (#199): after explaining, the learner ticks the points they covered.
// A fieldset of native checkboxes, so keyboard (Tab, Space) and screen readers work as everywhere else.
// It holds no text of its own: the caller passes the legend from t() and the points as rendered card text.
import { useId, type ReactNode } from 'react';
import { cx } from './logic';

export type KeyPointChecklistProps = {
  legend: string;
  points: ReactNode[];
  checked: boolean[];
  onToggle: (index: number) => void;
  className?: string;
};

export function KeyPointChecklist({ legend, points, checked, onToggle, className }: KeyPointChecklistProps) {
  const id = useId();
  return (
    <fieldset className={cx('keypoints', className)}>
      <legend>{legend}</legend>
      <ul>
        {points.map((p, i) => (
          <li key={i} className={checked[i] ? 'on' : undefined}>
            <input type="checkbox" id={`${id}-${i}`} checked={!!checked[i]} onChange={() => onToggle(i)} />
            <label htmlFor={`${id}-${i}`}>{p}</label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
