// Exam simulator (#43): a mock exam from one deck. Tutor mode explains each answer; timed mode runs one
// clock for the whole exam (the user's choice, never per card) and saves feedback for the end. Flag
// questions, review before handing in, then a score by topic. Tutor answers count toward your reviews like
// normal study; timed exams are practice and never change the schedule.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRight, type ExamMode } from '@lernlab/core/exam';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { CasePanel, Feedback, LevelTag, SegmentedControl } from './components';
import { useKeys } from './ctx';
import { clock, reviewRows, secondsLeft, toggleChoice, type ReviewFilter } from './exam-logic';
import { formatNumber } from './i18n';
import { controlOwnsKey } from './keys-logic';
import { Rich } from './rich';
import { WrongChoice } from './modes/Exercises';
import { pickedCorrections } from '@lernlab/core/misconceptions';

type ExamData = OutputOf<'exam.start'>;
type Score = OutputOf<'exam.submit'>;
type Phase = 'intro' | 'run' | 'review' | 'result';

export function Exam({ deckId, onDone }: { deckId: number; onDone: () => void }) {
  const { t } = useTranslation();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<ExamMode>('tutor');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [flags, setFlags] = useState(new Set<number>());
  const [checked, setChecked] = useState(new Set<number>());
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [score, setScore] = useState<Score | null>(null);
  const [now, setNow] = useState(Date.now());
  const started = useRef(0);
  const used = useRef(0);
  const sending = useRef(false);
  const shown = useRef(0);
  const ms = useRef<Record<number, number>>({});
  const heading = useRef<HTMLHeadingElement>(null);

  const load = () => {
    setPhase('intro');
    setAnswers({});
    setFlags(new Set());
    setChecked(new Set());
    setScore(null);
    setIndex(0);
    ms.current = {};
    sending.current = false;
    api.examStart(deckId).then(setExam, (e: Error) => setError(e.message));
  };
  useEffect(load, [deckId]);
  useEffect(() => heading.current?.focus(), [phase, index]);

  const qs = exam?.questions ?? [];
  const q = qs[index];
  const timed = mode === 'timed';
  const left = exam && timed ? secondsLeft(started.current, exam.settings.minutes, now) : null;
  const locked = !!q && !timed && checked.has(q.itemId);

  const leaveQuestion = () => {
    if (q) ms.current[q.itemId] = (ms.current[q.itemId] ?? 0) + Date.now() - shown.current;
    shown.current = Date.now();
  };
  const goTo = (i: number) => {
    leaveQuestion();
    setIndex(Math.max(0, Math.min(qs.length - 1, i)));
    setPhase('run');
  };
  const begin = () => {
    started.current = shown.current = Date.now();
    setNow(Date.now());
    setPhase('run');
  };
  const submit = async () => {
    if (!exam || sending.current) return;
    sending.current = true;
    leaveQuestion();
    used.current = (Date.now() - started.current) / 1000;
    const list = qs.map((x) => ({ itemId: x.itemId, chosen: answers[x.itemId] ?? [], ms: ms.current[x.itemId] ?? 0 }));
    try {
      setScore(await api.examSubmit({ examId: exam.id, mode, answers: list }));
      setPhase('result');
    } catch (e) {
      sending.current = false;
      setError((e as Error).message);
    }
  };
  const choose = (i: number) => {
    if (!q || locked) return;
    setAnswers({ ...answers, [q.itemId]: toggleChoice(answers[q.itemId] ?? [], i, q.correct.length > 1) });
  };
  const toggleFlag = () => {
    if (!q) return;
    const next = new Set(flags);
    if (!next.delete(q.itemId)) next.add(q.itemId);
    setFlags(next);
  };
  const next = () => (index + 1 < qs.length ? goTo(index + 1) : (leaveQuestion(), setPhase('review')));
  const primary = () => {
    if (!q) return;
    if (!timed && !locked && answers[q.itemId]?.length) setChecked(new Set(checked).add(q.itemId));
    else next();
  };

  // One clock for the whole exam in timed mode; when it runs out, the exam is handed in as it stands.
  useEffect(() => {
    if (!timed || (phase !== 'run' && phase !== 'review')) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timed, phase]);
  useEffect(() => {
    if (left === 0 && (phase === 'run' || phase === 'review')) void submit();
  }, [left, phase]);

  useKeys((e) => {
    if (phase !== 'run' || controlOwnsKey(e.key, e.target as Element | null)) return;
    const n = Number(e.key);
    if (q && n >= 1 && n <= q.choices.length) choose(n - 1);
    else if (e.key === 'Enter') primary();
    else if (e.key === 'f' || e.key === 'F') toggleFlag();
    else if (e.key === 'Escape') onDone();
  });

  if (error)
    return (
      <main className="summary">
        <p role="alert" className="feedback wrong">
          {error}
        </p>
        <div className="summary-actions">
          <button className="btn primary" onClick={onDone}>
            {t('exam.back')}
          </button>
        </div>
      </main>
    );
  if (!exam) return <div className="wrap muted">{t('app.loading')}</div>;

  if (phase === 'intro')
    return (
      <main className="summary exam-intro">
        <p className="summary-kicker">{t('exam.kicker')}</p>
        <h1 ref={heading} tabIndex={-1}>
          {exam.deckName}
        </h1>
        {qs.length ? (
          <>
            <p className="summary-note">
              {t('exam.facts', { count: qs.length, minutes: exam.settings.minutes, mark: exam.settings.passMark })}
            </p>
            <section className="panel exam-modes">
              <h2 id="exam-mode">{t('exam.mode')}</h2>
              <SegmentedControl
                labelledBy="exam-mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'tutor', label: t('exam.tutor') },
                  { value: 'timed', label: t('exam.timed') },
                ]}
              />
              <p className="muted">
                {timed ? t('exam.timedHint', { minutes: exam.settings.minutes }) : t('exam.tutorHint')}
              </p>
              <p className="small muted">{t(timed ? 'exam.timedNote' : 'exam.tutorNote')}</p>
            </section>
          </>
        ) : (
          <p className="summary-note">{t('exam.empty')}</p>
        )}
        <div className="summary-actions">
          <button className="btn" onClick={onDone}>
            {t('exam.back')}
          </button>
          {qs.length > 0 && (
            <button className="btn primary" onClick={begin}>
              {t('exam.start')}
            </button>
          )}
        </div>
      </main>
    );

  if (phase === 'result' && score) {
    const missed = qs.filter((x) => !isRight(x, answers[x.itemId]));
    const topic = (name: string) => name || t('exam.noTag');
    return (
      <main className="summary exam-result">
        <p className="summary-kicker">{t('exam.resultKicker', { deck: exam.deckName })}</p>
        <h1 ref={heading} tabIndex={-1}>
          {t('exam.percent', { percent: formatNumber(score.percent) })}
        </h1>
        <p className="summary-note">
          {t(score.passed ? 'exam.passed' : 'exam.notYet', { mark: score.passMark })}{' '}
          {timed
            ? t('exam.timedNote')
            : score.reviewed
              ? t('exam.tutorCounted', { count: score.reviewed })
              : t('exam.tutorCountedNone')}
        </p>
        <div className="summary-tiles">
          <section className="panel summary-tile">
            <b>{t('exam.ofTotal', { count: score.correct, total: score.total })}</b>
            <span>{t('exam.correct')}</span>
          </section>
          <section className="panel summary-tile">
            <b>{formatNumber(score.unanswered)}</b>
            <span>{t('exam.unanswered', { count: score.unanswered })}</span>
          </section>
          <section className="panel summary-tile">
            <b>{clock(used.current)}</b>
            <span>{t('exam.timeUsed')}</span>
          </section>
        </div>
        <section className="panel exam-topics" aria-labelledby="exam-topics">
          <h2 id="exam-topics">{t('exam.byTopic')}</h2>
          <ul>
            {score.topics.map((x) => (
              <li key={x.topic} className={x.percent < score.passMark ? 'weak' : ''}>
                <b>{topic(x.topic)}</b>
                <div className="meter" aria-hidden="true">
                  <i style={{ width: `${x.percent}%` }} />
                </div>
                <span>{t('exam.topicScore', { count: x.correct, total: x.total, percent: x.percent })}</span>
              </li>
            ))}
          </ul>
          <h2>{t('exam.weak')}</h2>
          <p className="muted">
            {score.weak.length ? score.weak.map(topic).join(' · ') : t('exam.noWeak', { mark: score.passMark })}
          </p>
        </section>
        {score.levels.length > 0 && (
          <section className="panel exam-topics" aria-labelledby="exam-levels">
            <h2 id="exam-levels">{t('exam.byLevel')}</h2>
            <p className="muted small">{t('exam.byLevelHint')}</p>
            <ul>
              {score.levels.map((x) => (
                <li key={x.level}>
                  <b>
                    <LevelTag level={x.level}>{t(`levels.${x.level}`)}</LevelTag>
                  </b>
                  <div className="meter" aria-hidden="true">
                    <i style={{ width: `${x.percent}%` }} />
                  </div>
                  <span>{t('exam.topicScore', { count: x.correct, total: x.total, percent: x.percent })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {missed.length > 0 && (
          <section className="panel summary-missed" aria-labelledby="exam-missed">
            <h2 id="exam-missed">{t('exam.missed', { count: missed.length })}</h2>
            <ul>
              {missed.map((x) => (
                <li key={x.itemId} className="exam-missed">
                  <Rich html={x.stem} />
                  <b>{x.correct.map((i) => x.choices[i]).join(' + ')}</b>
                  {x.explanation && <Rich className="muted small" html={x.explanation} />}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="summary-actions">
          <button className="btn" onClick={load}>
            {t('exam.again')}
          </button>
          <button className="btn primary" onClick={onDone}>
            {t('exam.done')}
          </button>
        </div>
      </main>
    );
  }

  const header = (
    <header className="session-head">
      <button className="session-leave" onClick={onDone}>
        {t('exam.leave')} <kbd>{t('keys.esc')}</kbd>
      </button>
      <h1 ref={heading} tabIndex={-1} className="session-title">
        {phase === 'review' ? t('exam.reviewTitle') : t('exam.question', { n: index + 1, total: qs.length })}
      </h1>
      <div className="session-meta">
        {left !== null && (
          <span role="timer" aria-label={t('exam.timeLeft')} className={left < 60 ? 'exam-clock low' : 'exam-clock'}>
            {clock(left)}
          </span>
        )}
      </div>
    </header>
  );

  if (phase === 'review') {
    const rows = reviewRows(qs, answers, flags, filter);
    const open = qs.filter((x) => !answers[x.itemId]?.length).length;
    return (
      <div className="session exam">
        {header}
        <main className="exam-review">
          <p className="muted">{t('exam.reviewBody', { count: open, flagged: flags.size })}</p>
          <SegmentedControl
            label={t('exam.reviewFilter')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('exam.filterAll') },
              { value: 'flagged', label: t('exam.filterFlagged', { count: flags.size }) },
              { value: 'open', label: t('exam.filterOpen', { count: open }) },
            ]}
          />
          <ul className="exam-review-list">
            {rows.map((r) => (
              <li key={r.index}>
                <button className="btn ghost" onClick={() => goTo(r.index)}>
                  {t('exam.question', { n: r.index + 1, total: qs.length })}
                </button>
                <span className={r.answered ? 'muted' : 'exam-open'}>
                  {t(r.answered ? 'exam.answered' : 'exam.notAnswered')}
                </span>
                {r.flagged && <span className="exam-flag">{t('exam.flagged')}</span>}
              </li>
            ))}
          </ul>
          <div className="summary-actions">
            <button className="btn" onClick={() => goTo(index)}>
              {t('exam.backToQuestions')}
            </button>
            <button className="btn primary" onClick={submit}>
              {t('exam.handIn')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const chosen = answers[q.itemId] ?? [];
  const multi = q.correct.length > 1;
  return (
    <div className="session exam">
      {header}
      <main className="stage exam-stage">
        <div className="panel ex-card">
          <div className="blocktitle">
            {multi ? t('exam.chooseMany', { count: q.correct.length }) : t('exam.chooseOne')}
            {q.level && (
              <>
                {' '}
                <LevelTag level={q.level}>{t(`levels.${q.level}`)}</LevelTag>
              </>
            )}
          </div>
          {q.caseText && (
            <CasePanel label={t('ex.case.label')}>
              <Rich html={q.caseText} />
            </CasePanel>
          )}
          <div className="prompt exam-stem">
            <Rich html={q.stem} />
          </div>
          <div className="col">
            {q.choices.map((c, i) => (
              <button
                key={i}
                className={`opt ${locked ? (q.correct.includes(i) ? 'right' : chosen.includes(i) ? 'wrong' : '') : ''}`}
                aria-pressed={chosen.includes(i)}
                onClick={() => choose(i)}
              >
                <span className="k">{i + 1}</span>
                <Rich html={c} />
              </button>
            ))}
          </div>
          {locked && (
            <Feedback tone={isRight(q, chosen) ? 'right' : 'wrong'}>
              {isRight(q, chosen) ? (
                t('exam.right')
              ) : (
                <WrongChoice
                  corrections={pickedCorrections(q.corrections, chosen, q.correct)}
                  answer={t('common.correctIs', { answer: q.correct.map((i) => q.choices[i]).join(' + ') })}
                />
              )}
              {q.explanation && <Rich className="small exam-explanation" html={q.explanation} />}
            </Feedback>
          )}
          <div className="exam-actions">
            <button className="btn ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
              {t('exam.previous')}
            </button>
            <button className="btn ghost" aria-pressed={flags.has(q.itemId)} onClick={toggleFlag}>
              {t(flags.has(q.itemId) ? 'exam.unflag' : 'exam.flag')}
            </button>
            <span className="grow" />
            <button className="btn primary" onClick={primary}>
              {!timed && !locked && chosen.length
                ? t('common.check')
                : index + 1 < qs.length
                  ? t('exam.next')
                  : t('exam.review')}
            </button>
          </div>
        </div>
        <nav className="exam-nav" aria-label={t('exam.questions')}>
          {qs.map((x, i) => (
            <button
              key={x.itemId}
              className={[
                answers[x.itemId]?.length ? 'done' : '',
                flags.has(x.itemId) ? 'flagged' : '',
                i === index ? 'on' : '',
              ].join(' ')}
              aria-current={i === index ? 'step' : undefined}
              aria-label={[
                t('exam.question', { n: i + 1, total: qs.length }),
                flags.has(x.itemId) ? t('exam.flagged') : '',
              ]
                .filter(Boolean)
                .join(', ')}
              onClick={() => goTo(i)}
            >
              {i + 1}
            </button>
          ))}
          <button className="btn" onClick={() => (leaveQuestion(), setPhase('review'))}>
            {t('exam.review')}
          </button>
        </nav>
      </main>
    </div>
  );
}
