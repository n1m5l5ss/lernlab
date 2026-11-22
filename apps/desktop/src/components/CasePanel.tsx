// The case of a case chain (#209): a patient, a fact pattern, an architecture. It shows above every question
// that belongs to it, in sessions, mock exams and the card preview. A labelled region, so screen-reader users
// can find it again from any question. It holds no text of its own: the caller passes the label from t() and
// the case as rendered card text.
import type { ReactNode } from 'react';
import { cx } from './logic';

export type CasePanelProps = { label: string; children: ReactNode; className?: string };

export function CasePanel({ label, children, className }: CasePanelProps) {
  return (
    <section className={cx('case-panel', className)} aria-label={label}>
      <div className="case-panel-label" aria-hidden="true">
        {label}
      </div>
      <div className="case-panel-text">{children}</div>
    </section>
  );
}
