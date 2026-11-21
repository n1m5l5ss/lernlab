// Feedback (design rule 2): colour + icon + word, never colour alone, and announced to screen readers.
// The colour and icon come from CSS (.feedback.right / .wrong / .near); the word leads `children`, e.g.
// t('ex.choice.right') or ctx.t.near(). No shaking, no buzzers.
import type { CSSProperties, ReactNode } from 'react';
import { cx } from './logic';

export type FeedbackTone = 'right' | 'wrong' | 'near';

export type FeedbackProps = {
  tone: FeedbackTone;
  children: ReactNode;
  /** role="alert" interrupts the screen reader; keep it for errors that stop the learner. */
  urgent?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Feedback({ tone, children, urgent = false, className, style }: FeedbackProps) {
  return (
    <div role={urgent ? 'alert' : 'status'} className={cx('feedback', tone, className)} style={style}>
      {children}
    </div>
  );
}
