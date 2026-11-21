// A wrong choice's correction (#202): shown in place of a plain "wrong" when a learner picks a choice the
// card's author wrote a correction for. A short lead, the correction(s), then the right answer, so the
// answer stays as clear as before. It holds no text of its own: the caller passes the lead and the answer
// from t(), and the corrections as rendered card text.
import type { ReactNode } from 'react';

export type MisconceptionProps = { lead: string; answer: ReactNode; children: ReactNode };

export function Misconception({ lead, answer, children }: MisconceptionProps) {
  return (
    <>
      <span className="misconception-lead">{lead}</span>
      <div className="misconception">{children}</div>
      <div className="misconception-answer">{answer}</div>
    </>
  );
}
