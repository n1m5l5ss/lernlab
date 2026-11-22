// Two things side by side (#200): the two sides of a compare card, or two cards that were mixed up. They
// sit next to each other when there is room and stack when there is not. It holds no text of its own: the
// caller passes the group's label from t() and each side as rendered card text.
import type { ReactNode } from 'react';

export type SideBySideProps = { label: string; left: ReactNode; right: ReactNode; lang?: string };

export function SideBySide({ label, left, right, lang }: SideBySideProps) {
  return (
    <div className="side-by-side" role="group" aria-label={label}>
      <div className="side-by-side-item" lang={lang}>
        {left}
      </div>
      <div className="side-by-side-item" lang={lang}>
        {right}
      </div>
    </div>
  );
}
