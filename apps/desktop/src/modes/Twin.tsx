// A compare card (#200): two things that are easy to mix up, side by side. Say (or think) what they share and
// the one key difference, then check against the card's answer and rate yourself. A real recall, logged like a
// flip answer: one FSRS grade per card per day. No clock.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@lernlab/core/types';
import { useKeys, type Ctx } from '../ctx';
import { Rich } from '../rich';
import { Feedback, SideBySide } from '../components';

type Props = {
  ex: Extract<Exercise, { type: 'twin' }>;
  ctx: Ctx;
  onNext: (r: { correct: boolean }) => void;
  format?: 'flip' | 'boss';
};

export function Twin({ ex, ctx, onNext, format = 'flip' }: Props) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const [shown, setShown] = useState(false);
  const shownAt = useRef(performance.now());
  const rate = (r: 0 | 1 | 2) => {
    if (!shown) return;
    const correct = r > 0;
    ctx.answer({
      itemId: item.id,
      format,
      correct,
      nearMiss: r === 1,
      shownAt: shownAt.current,
      given: ['no', 'partly', 'yes'][r],
    });
    if (!correct) ctx.missed.add(item.id);
    onNext({ correct });
  };
  useKeys((e) => {
    if (!shown && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setShown(true);
    } else if (shown && ['1', '2', '3'].includes(e.key)) rate((Number(e.key) - 1) as 0 | 1 | 2);
  });
  return (
    <div>
      <div className="blocktitle">{t('ex.twin.title')}</div>
      <div className="card flipcard">
        <SideBySide
          label={t('ex.twin.sides')}
          lang={item.lang ?? undefined}
          left={<Rich html={ex.left} />}
          right={<Rich html={ex.right} />}
        />
        <p className="twin-question">{t('ex.twin.question')}</p>
        {shown && (
          <Feedback tone="right" style={{ textAlign: 'start' }}>
            {ex.answer ? (
              <div className="ans">
                <Rich html={ex.answer} />
              </div>
            ) : (
              t('ex.twin.noAnswer')
            )}
          </Feedback>
        )}
      </div>
      {!shown ? (
        <div className="actions">
          <button className="btn primary" onClick={() => setShown(true)}>
            {t(ex.answer ? 'ex.flip.show' : 'ex.twin.check')} <span className="kbd">{t('keys.space')}</span>
          </button>
          <span className="small muted">{t('ex.twin.hint')}</span>
        </div>
      ) : (
        <div className="grade3">
          <button className="btn rate-no" onClick={() => rate(0)}>
            {t('ex.flip.no')} <span className="kbd">1</span>
          </button>
          <button className="btn rate-partly" onClick={() => rate(1)}>
            {t('ex.flip.partly')} <span className="kbd">2</span>
          </button>
          <button className="btn rate-yes" onClick={() => rate(2)}>
            {t('ex.flip.yes')} <span className="kbd">3</span>
          </button>
        </div>
      )}
    </div>
  );
}
