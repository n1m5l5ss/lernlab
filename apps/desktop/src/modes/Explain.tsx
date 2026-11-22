// "Explain it" (#199): write an explanation in your own words, then see the model answer and tick the key
// points you covered (all → Good, some → Hard, none → Again; "That was easy" only with every point). A real
// recall, logged like a flip answer: one FSRS grade per card per day. No clock. A basic card tagged why/how
// has no key points: you explain first, then rate yourself as on a flip card.
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UNDERSTANDING_SCALE, type ExplainOutcome } from '@lernlab/core/explain';
import type { Exercise } from '@lernlab/core/types';
import { markAnswer } from '@lernlab/core/keyterms';
import { useKeys, type Ctx } from '../ctx';
import { Media, Rich } from '../rich';
import { textPx } from '../display';
import { formatNumber } from '../i18n';
import { Feedback, KeyPointChecklist, LevelTag, SegmentedControl } from '../components';
import {
  canCheck,
  explainKey,
  explainResult,
  explainStart,
  gapKey,
  rateResult,
  resultKey,
  toggle,
} from '../explain-logic';

type Props = {
  ex: Extract<Exercise, { type: 'explain' }>;
  ctx: Ctx;
  onNext: (r: { correct: boolean }) => void;
  format?: 'flip' | 'boss';
};

const SCALE = Array.from({ length: UNDERSTANDING_SCALE }, (_, i) => String(i + 1));
const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/** "How well do you understand this?" 1–7: optional, never graded (one small row). */
function Understanding({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <div className="explain-understand">
      <span id={id} className="small muted">
        {label}
      </span>
      <SegmentedControl
        labelledBy={id}
        value={value === null ? null : String(value)}
        options={SCALE.map((v) => ({ value: v, label: formatNumber(Number(v)) }))}
        onChange={(v) => onChange(Number(v))}
      />
    </div>
  );
}

export function Explain({ ex, ctx, onNext, format = 'flip' }: Props) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const points = ex.points.length;
  const [s, setS] = useState(() => explainStart(points));
  const shown = useRef(performance.now());
  const box = useRef<HTMLTextAreaElement>(null);
  const after = useRef<HTMLDivElement>(null);
  // Focus follows the step: the text box, then the first key point (or rating), or Continue.
  useEffect(() => {
    if (s.step === 'write') box.current?.focus();
    else after.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [s.step]);

  const answer = (o: ExplainOutcome) => {
    ctx.answer({
      itemId: item.id,
      format,
      ...o,
      shownAt: shown.current,
      given: s.text.slice(0, 2000),
      ...(ex.level && { level: ex.level }),
    });
    if (!o.correct) ctx.missed.add(item.id);
  };
  const check = () => canCheck(s) && setS({ ...s, step: 'check' });
  const giveUp = () => {
    answer({ correct: false, nearMiss: false, easy: false });
    setS({ ...s, step: 'gaveUp' });
  };
  const finish = (o: ExplainOutcome) => {
    answer(o);
    onNext({ correct: o.correct });
  };
  const rate = (r: 0 | 1 | 2) => finish(rateResult(r));

  useKeys((e) => {
    const onButton = e.target instanceof HTMLElement && !!e.target.closest('button');
    const a = explainKey(s, { key: e.key, ctrl: e.ctrlKey || e.metaKey, onButton, points });
    if (!a) return;
    e.preventDefault();
    if (a === 'check') check();
    else if (a === 'done') finish(explainResult(s));
    else if (a === 'next') onNext({ correct: false });
    else rate(a === 'no' ? 0 : a === 'partly' ? 1 : 2);
  });

  const gap = gapKey(s.before, s.after);
  const all = points > 0 && s.ticked.every(Boolean);
  return (
    <div>
      <div className="blocktitle">
        {t('ex.explain.title')}
        {ex.level && (
          <>
            {' '}
            <LevelTag level={ex.level}>{t(`levels.${ex.level}`)}</LevelTag>
          </>
        )}
      </div>
      <div className="card explain-card">
        <Media item={item} size="sm" />
        <div className="prompt" style={{ fontSize: ex.prompt.length > 80 ? textPx(22) : textPx(28) }}>
          <Rich html={ex.prompt} />
        </div>
        {s.step === 'write' ? (
          <>
            {points > 0 && (
              <Understanding
                label={t('ex.explain.understand')}
                value={s.before}
                onChange={(n) => setS({ ...s, before: n })}
              />
            )}
            <label className="lbl" htmlFor={`explain-${ex.itemId}`}>
              {t('ex.explain.label')}
            </label>
            <textarea
              id={`explain-${ex.itemId}`}
              ref={box}
              className="input explain-input"
              value={s.text}
              placeholder={t('ex.explain.placeholder')}
              onChange={(e) => setS({ ...s, text: e.target.value })}
            />
          </>
        ) : (
          <>
            {s.text.trim() && (
              <div className="explain-yours">
                <span className="lbl">{t('ex.explain.label')}</span>
                <p>{s.text}</p>
              </div>
            )}
            {(ex.answer || s.step === 'gaveUp') && (
              <Feedback tone={s.step === 'gaveUp' ? 'wrong' : 'right'} style={{ textAlign: 'start' }}>
                {t(s.step === 'gaveUp' ? 'ex.explain.gaveUp' : 'ex.explain.model')}
                {ex.answer && (
                  <div className="ans">
                    <Rich html={markAnswer(item, ex.answer)} />
                  </div>
                )}
              </Feedback>
            )}
          </>
        )}
        {s.step === 'gaveUp' && points > 0 && (
          <ul className="explain-points">
            {ex.points.map((p, i) => (
              <li key={i}>
                <Rich html={p} />
              </li>
            ))}
          </ul>
        )}
        {s.step === 'check' && points > 0 && (
          <div ref={after}>
            <KeyPointChecklist
              legend={t('ex.explain.pointsLegend')}
              points={ex.points.map((p, i) => (
                <Rich key={i} html={p} />
              ))}
              checked={s.ticked}
              onToggle={(i) => setS(toggle(s, i))}
            />
            <p className="small muted" aria-live="polite">
              {t(resultKey(s.ticked))}
            </p>
            {s.before !== null && (
              <Understanding
                label={t('ex.explain.understandAfter')}
                value={s.after}
                onChange={(n) => setS({ ...s, after: n })}
              />
            )}
            {gap && (
              <p className="small" aria-live="polite">
                {t(gap, { before: formatNumber(s.before!), after: formatNumber(s.after!) })}
              </p>
            )}
          </div>
        )}
      </div>
      {s.step === 'write' ? (
        <div className="actions">
          <button className="btn primary" disabled={!canCheck(s)} onClick={check}>
            {t('ex.explain.check')}{' '}
            <span className="kbd">{t(MAC ? 'ex.explain.checkKeysMac' : 'ex.explain.checkKeys')}</span>
          </button>
          <button className="btn" onClick={giveUp}>
            {t('ex.explain.dontKnow')}
          </button>
        </div>
      ) : s.step === 'gaveUp' ? (
        <div className="actions" ref={after}>
          <button className="btn primary" onClick={() => onNext({ correct: false })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        </div>
      ) : points > 0 ? (
        <div className="actions">
          <button className="btn primary" onClick={() => finish(explainResult(s))}>
            {t('ex.explain.done')} <span className="kbd">{t('keys.enter')}</span>
          </button>
          {all && (
            <button className="btn" onClick={() => finish(explainResult(s, true))}>
              {t('ex.explain.easy')}
            </button>
          )}
        </div>
      ) : (
        <div className="grade3" ref={after}>
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
