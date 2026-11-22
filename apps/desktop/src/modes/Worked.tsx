// Worked examples that fade (#206): a solved problem whose first steps are shown and whose last steps you type,
// one at a time. The full example is only studied; a faded rung is practice; the whole problem is the real
// recall (one FSRS grade per card per day). No clock. "I was right" is per step and settled before the answer
// is recorded, so nothing needs undoing.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@lernlab/core/types';
import { useKeys, type Ctx } from '../ctx';
import { Media, Rich } from '../rich';
import { textPx } from '../display';
import { Feedback } from '../components';
import {
  countRight,
  currentStep,
  givenFor,
  isDone,
  modeOf,
  skipStep,
  stepView,
  submitStep,
  workedAnswer,
  workedKey,
  workedStart,
} from '../worked-logic';

type Props = {
  ex: Extract<Exercise, { type: 'worked' }>;
  ctx: Ctx;
  onNext: (r: { correct: boolean }) => void;
};

export function Worked({ ex, ctx, onNext }: Props) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const mode = modeOf(ex);
  const [s, setS] = useState(workedStart);
  const shown = useRef(performance.now());
  const box = useRef<HTMLInputElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const done = isDone(ex, s);
  const asked = currentStep(ex, s);
  // Focus follows the work: the step being asked, then Continue.
  useEffect(() => {
    if (done) go.current?.focus();
    else box.current?.focus();
  }, [done, asked]);

  const check = () => setS(submitStep(ex, s));
  const finish = () => {
    const a = workedAnswer(ex, s);
    ctx.answer({ itemId: item.id, ...a, shownAt: shown.current, silent: mode === 'study' });
    if (!a.correct) ctx.missed.add(item.id);
    onNext({ correct: a.correct });
  };

  useKeys((e) => {
    const onButton = e.target instanceof HTMLElement && !!e.target.closest('button');
    const a = workedKey(ex, s, { key: e.key, onButton });
    if (!a) return;
    e.preventDefault();
    if (a === 'check') check();
    else finish();
  });

  const result = done && mode !== 'study' ? workedAnswer(ex, s) : null;
  return (
    <div>
      <div className="blocktitle">{t(`ex.worked.title.${mode}`)}</div>
      <div className="card worked-card">
        <Media item={item} size="sm" />
        <div className="prompt" style={{ fontSize: ex.prompt.length > 80 ? textPx(22) : textPx(28) }}>
          <Rich html={ex.prompt} />
        </div>
        <p className="small muted">{t(`ex.worked.intro.${mode}`, { count: ex.blanks })}</p>
        <ol className="worked-steps">
          {ex.steps.map((step, i) => {
            const view = stepView(ex, s, i);
            const n = i + 1;
            // The whole problem is solved alone: what to do shows only once a step is answered.
            const label = step.label && (view === 'given' || view === 'right' || view === 'wrong' || mode === 'fade');
            return (
              <li key={i} className={`worked-step ${view}`}>
                {label ? (
                  <div className="worked-label">
                    <Rich html={step.label} />
                  </div>
                ) : (
                  view !== 'given' && <div className="worked-label muted">{t('ex.worked.step', { n })}</div>
                )}
                {view === 'ask' ? (
                  <>
                    <label className="sr-only" htmlFor={`worked-${ex.itemId}-${i}`}>
                      {t('ex.worked.resultOf', { n })}
                    </label>
                    <input
                      id={`worked-${ex.itemId}-${i}`}
                      ref={box}
                      className="input"
                      value={s.input}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder={t('ex.worked.placeholder')}
                      onChange={(e) => setS({ ...s, input: e.target.value })}
                    />
                  </>
                ) : view === 'later' ? (
                  <div className="worked-later muted">{t('ex.worked.later')}</div>
                ) : (
                  <div className="worked-result" role={view === 'given' ? undefined : 'status'}>
                    {view !== 'given' && (
                      <span className={`worked-mark ${view}`}>
                        {t(view === 'right' ? 'ex.worked.right' : 'ex.worked.wrong')}{' '}
                      </span>
                    )}
                    <Rich html={step.resultHtml} />
                    {view === 'wrong' && (
                      <span className="worked-yours small muted">
                        {givenFor(ex, s, i) && (
                          <>
                            {t('ex.typed.youTyped')}: {givenFor(ex, s, i)}{' '}
                          </>
                        )}
                        <button
                          className="btn ghost"
                          title={t('ex.typed.iWasRightTitle')}
                          aria-label={t('ex.worked.iWasRight', { n })}
                          onClick={() => setS(countRight(s, i - (ex.steps.length - ex.blanks)))}
                        >
                          {t('ex.typed.iWasRight')}
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {result && (
          <Feedback tone={result.correct ? 'right' : 'wrong'} style={{ textAlign: 'start' }}>
            {t(`ex.worked.result.${mode}.${result.correct ? 'right' : 'wrong'}`)}
            {mode === 'whole' && ex.answer && (
              <div className="ans">
                <Rich html={ex.answer} />
              </div>
            )}
          </Feedback>
        )}
      </div>
      {done ? (
        <div className="actions">
          <button ref={go} className="btn primary" onClick={finish}>
            {t(mode === 'study' ? 'ex.worked.studied' : 'common.continue')}{' '}
            <span className="kbd">{t('keys.enter')}</span>
          </button>
        </div>
      ) : (
        <div className="actions">
          <button className="btn primary" disabled={!s.input.trim()} onClick={check}>
            {t('common.check')} <span className="kbd">{t('keys.enter')}</span>
          </button>
          <button className="btn" onClick={() => setS(skipStep(ex, s))}>
            {t('ex.worked.dontKnow')}
          </button>
        </div>
      )}
    </div>
  );
}
