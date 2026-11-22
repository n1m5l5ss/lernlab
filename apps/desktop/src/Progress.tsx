// Progress: the journey. Per deck learned vs remaining, pace and forecast; study days; retention; hardest cards.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import { TEACH_SECONDS } from '@lernlab/core/teachback';
import { api } from './api';
import { directionOf } from './direction';
import { formatDate, formatNumber, formatPercent } from './i18n';
import { heatColumn, heatmapWeeks, levelMix, monthStarts, recallRate } from './progress-logic';
import { Button, LevelTag, ProgressBar, ProgressCard } from './components';
import { cardFacts, cardFileName, cardSvg, goalShare, type CardText } from './progress-card';
import { applyTheme } from './theme';

type Journey = OutputOf<'progress.get'>;
type DeckJourney = Journey['decks'][number];

/** Day keys (YYYY-MM-DD) are read at noon so no time zone shifts them to another day. */
const date = (day: string, opts?: Intl.DateTimeFormatOptions) => formatDate(`${day}T12:00:00`, opts);
const b = { b: <b /> };

export function Progress({
  onStudyHardest,
  onTeach,
}: {
  onStudyHardest: () => void;
  /** Teach-back (#208): explain a mastered tag. */
  onTeach: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const [p, setP] = useState<Journey | null>(null);
  useEffect(() => {
    api.progress().then(setP);
  }, []);
  if (!p) return <div className="muted">{t('app.loading')}</div>;
  const rate = recallRate(p.retention);
  return (
    <div className="journey">
      <div className="summary-tiles">
        <div className="panel summary-tile">
          <b>{formatNumber(p.totals.learned)}</b>
          <span>{t('progress.tiles.learned', { count: p.totals.remaining })}</span>
        </div>
        <div className="panel summary-tile">
          <b>{formatNumber(p.totals.perWeek)}</b>
          <span>{t('progress.tiles.perWeek')}</span>
        </div>
        <div className="panel summary-tile">
          <b>{rate === null ? t('common.noDate') : formatPercent(rate)}</b>
          <span>{t('progress.tiles.recalled')}</span>
        </div>
      </div>

      <WeekGoal p={p} />

      <section aria-labelledby="journey-decks">
        <h2 id="journey-decks" className="journey-title">
          {t('progress.decksTitle')}
        </h2>
        {p.decks.length ? (
          <div className="deckgrid">
            {p.decks.map((d) => (
              <DeckProgress key={d.id} d={d} />
            ))}
          </div>
        ) : (
          <p className="muted">{t('progress.noDecks')}</p>
        )}
      </section>

      <StudyDays p={p} />
      <Retention p={p} />
      <Calibration p={p} />
      <Hardest p={p} onStudy={onStudyHardest} />
      <TeachTopics onTeach={onTeach} />
    </div>
  );
}

/** Draws the card's SVG on a canvas (twice as sharp) and returns it as a PNG. Everything happens in this window. */
async function svgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: width * 2, height: height * 2 });
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  if (!blob) throw new Error('no picture');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * This week's goal (#214): new cards and sessions, worked out from each deck's goal, exam date and your recent
 * pace. It only informs: no XP, no celebration, and a slow week is never called out. The progress card shows
 * the same numbers to print or save.
 */
function WeekGoal({ p }: { p: Journey }) {
  const { t, i18n } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [msg, setMsg] = useState('');
  const text = useMemo<CardText>(() => {
    const f = cardFacts(p);
    const goal = (label: string, g: { done: number; target: number }) => ({
      label,
      value: t(g.done >= g.target ? 'progress.week.reached' : 'progress.week.of', g),
      share: goalShare(g.done, g.target),
    });
    return {
      title: t('progress.card.heading'),
      subtitle: t('progress.card.weekOf', { date: date(f.week, { dateStyle: 'long' }) }),
      stats: [
        { value: formatNumber(f.learned), label: t('progress.card.learned', { count: f.learned }) },
        { value: t('progress.card.daysValue', { count: f.days }), label: t('progress.card.days') },
        { value: formatNumber(f.minutes), label: t('progress.card.minutes', { count: f.minutes }) },
        {
          value: f.recalled === null ? t('common.noDate') : formatPercent(f.recalled),
          label: t('progress.card.recalled'),
        },
      ],
      goalsTitle: t('progress.week.title'),
      goals: [
        ...(f.cards.target > 0 ? [goal(t('progress.week.cards'), f.cards)] : []),
        goal(t('progress.week.sessions'), f.sessions),
      ],
      note: f.exam ? t('progress.week.exam', { deck: f.exam.deck, date: date(f.exam.date), count: f.exam.days }) : '',
      decksTitle: t('progress.card.decks'),
      decks: f.decks.map((d) => ({
        name: d.name,
        detail: t('progress.card.deckLearned', { learned: d.learned, count: d.cards }),
        share: goalShare(d.learned, d.cards),
      })),
      footer: t('progress.card.footer', { date: date(p.today, { dateStyle: 'long' }) }),
    };
  }, [p, t, i18n.language]);

  const savePicture = async () => {
    try {
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(name).trim();
      const { svg, width, height } = cardSvg(
        text,
        {
          bg: token('--color-bg'),
          surface: token('--color-surface'),
          text: token('--color-text'),
          muted: token('--color-text-muted'),
          accent: token('--color-accent'),
          border: token('--color-border'),
        },
        { rtl: directionOf(i18n.language) === 'rtl' },
      );
      api.savePicture(cardFileName(p.today), await svgToPng(svg, width, height));
      setMsg(t('progress.card.saved'));
    } catch {
      setMsg(t('progress.card.failed'));
    }
  };
  // Print only the card, on a light page whatever the theme; everything is put back when printing ends.
  const print = () => {
    const root = document.documentElement;
    const theme = root.dataset.theme;
    const restore = () => {
      delete document.body.dataset.print;
      applyTheme(theme);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    document.body.dataset.print = 'card';
    applyTheme('light');
    window.print();
  };

  return (
    <section className="panel journey-panel week-goal" aria-labelledby="week-goal">
      <div className="week-goal-head">
        <h2 id="week-goal">{text.goalsTitle}</h2>
        <Button
          onClick={() => {
            setMsg('');
            dialog.current?.showModal();
          }}
        >
          {t('progress.card.open')}
        </Button>
      </div>
      <ul className="week-goal-list">
        {text.goals.map((g) => (
          <li key={g.label}>
            <span className="progress-card-row">
              <b>{g.label}</b>
              <span>{g.value}</span>
            </span>
            <ProgressBar label={g.label} value={Math.round(g.share * 100)} max={100} valueText={g.value} />
          </li>
        ))}
      </ul>
      {text.note && <p className="muted">{text.note}</p>}
      <p className="muted small">{t('progress.week.how')}</p>
      <dialog
        ref={dialog}
        className="panel card-dialog"
        aria-labelledby="card-dialog-title"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 id="card-dialog-title">{t('progress.card.title')}</h2>
        <p className="muted">{t('progress.card.lead')}</p>
        <ProgressCard text={text} />
        <p className="small muted" role="status">
          {msg}
        </p>
        <div className="session-dialog-actions">
          <Button onClick={() => dialog.current?.close()}>{t('progress.card.close')}</Button>
          <Button onClick={print}>{t('progress.card.print')}</Button>
          <Button variant="primary" onClick={() => void savePicture()}>
            {t('progress.card.save')}
          </Button>
        </div>
      </dialog>
    </section>
  );
}

function DeckProgress({ d }: { d: DeckJourney }) {
  const { t } = useTranslation();
  const sub = [
    d.goal
      ? t('progress.deck.goal', { goal: d.goal.label, count: d.goal.target })
      : t('progress.deck.whole', { count: d.cards }),
    d.examDate && t('decks.examOn', { date: date(d.examDate) }),
  ].filter(Boolean);
  const forecast = d.reached
    ? t(d.goal ? 'progress.deck.goalReached' : 'progress.deck.allLearned')
    : d.forecast
      ? t(d.goal ? 'progress.deck.goalBy' : 'progress.deck.deckBy', { goal: d.goal?.label, date: date(d.forecast) })
      : t('progress.deck.noPace');
  return (
    <section className="panel deck journey-deck">
      <h3>{d.name}</h3>
      <p className="deck-sub">{sub.join(' · ')}</p>
      <p className="deckstats">
        <span>
          <Trans i18nKey="progress.deck.learned" values={{ count: formatNumber(d.learned) }} components={b} />
        </span>
        <span>
          <Trans i18nKey="progress.deck.left" values={{ count: formatNumber(d.remaining) }} components={b} />
        </span>
        <span>
          <Trans i18nKey="progress.deck.perWeek" values={{ count: formatNumber(d.perWeek) }} components={b} />
        </span>
      </p>
      <div className="meter" aria-hidden="true">
        <i style={{ width: `${d.cards ? (d.learned / d.cards) * 100 : 0}%` }} />
      </div>
      <p className="journey-forecast">{forecast}</p>
      {d.levels && <LevelMix levels={d.levels} />}
    </section>
  );
}

/** The mix of question levels answered in a deck, with a gentle hint when it is nearly all recall. */
function LevelMix({ levels }: { levels: NonNullable<DeckJourney['levels']> }) {
  const { t } = useTranslation();
  const mix = levelMix(levels);
  return (
    <div className="journey-levels">
      <p>
        <span className="muted small">{t('progress.deck.levels')}</span>{' '}
        {mix.shares.map((s) => (
          <span key={s.level} className="journey-level">
            <LevelTag level={s.level}>
              {t('progress.deck.levelShare', { level: t(`levels.${s.level}`), percent: formatPercent(s.share) })}
            </LevelTag>
          </span>
        ))}
      </p>
      {mix.mostlyRecall && <p className="small muted">{t('progress.deck.levelsHint')}</p>}
    </div>
  );
}

/** One square per day, a column per week; darker means more minutes. */
function StudyDays({ p }: { p: Journey }) {
  const { t, i18n } = useTranslation();
  const weeks = heatmapWeeks(p.heatmapSince, p.today, p.studyDays);
  const dir = directionOf(i18n.language);
  const col = (x: number) => heatColumn(x, weeks.length, dir) * STEP;
  const STEP = 15;
  const CELL = 12;
  const TOP = 16;
  const label = t('progress.days.summary', { count: p.studyDays.length });
  const wrap = useRef<HTMLDivElement>(null);
  // Open at today: the most recent weeks are at the end of the line (right, or left when right to left).
  useEffect(() => {
    if (wrap.current) wrap.current.scrollLeft = (dir === 'rtl' ? -1 : 1) * wrap.current.scrollWidth;
  }, [dir]);
  return (
    <section className="panel journey-panel" aria-labelledby="journey-days">
      <h2 id="journey-days">{t('progress.days.title')}</h2>
      {/* Focusable so the calendar can be scrolled with the keyboard when the window is narrow. */}
      <div className="journey-heat-wrap" ref={wrap} tabIndex={0}>
        <svg
          className="journey-heat"
          viewBox={`0 0 ${weeks.length * STEP} ${TOP + 7 * STEP}`}
          role="img"
          aria-label={label}
        >
          {monthStarts(weeks).map((m) => (
            <text key={m.day} x={col(m.column) + (dir === 'rtl' ? CELL : 0)} y={TOP - 5} className="journey-axis">
              {date(m.day, { month: 'short' })}
            </text>
          ))}
          {weeks.map((w, x) =>
            w.map((c, y) =>
              c.future ? null : (
                <rect
                  key={c.day}
                  x={col(x)}
                  y={TOP + y * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  className={`heat-l${c.level}${c.day === p.today ? ' heat-today' : ''}`}
                >
                  <title>
                    {c.level
                      ? t('progress.days.studied', { date: date(c.day), count: c.minutes })
                      : t('progress.days.rest', { date: date(c.day) })}
                  </title>
                </rect>
              ),
            ),
          )}
        </svg>
      </div>
      <div className="journey-foot">
        <span className="grow">{label}</span>
        <span className="journey-legend" aria-hidden="true">
          {t('progress.days.less')}
          {[0, 1, 2, 3].map((l) => (
            <i key={l} className={`heat-l${l}`} />
          ))}
          {t('progress.days.more')}
        </span>
      </div>
    </section>
  );
}

/** Weekly share of real reviews recalled (practice answers are left out), against the target retention. */
function Retention({ p }: { p: Journey }) {
  const { t } = useTranslation();
  const r = p.retention;
  const rate = recallRate(r);
  return (
    <section className="panel journey-panel" aria-labelledby="journey-retention">
      <h2 id="journey-retention">{t('progress.retention.title')}</h2>
      <p className="journey-lead">
        {rate === null
          ? t('progress.retention.empty')
          : t('progress.retention.lead', { percent: formatPercent(rate), count: r.reviews, weeks: r.weeks.length })}
      </p>
      <div className="journey-chart">
        <div className="journey-target" style={{ bottom: `${r.target * 100}%` }} aria-hidden="true" />
        <ol className="journey-bars">
          {r.weeks.map((w) => {
            const v = recallRate(w);
            const week = date(w.week, { day: 'numeric', month: 'short' });
            return (
              <li key={w.week}>
                {v !== null && (
                  <>
                    <span className="journey-bar-value" style={{ bottom: `${v * 100}%` }} aria-hidden="true">
                      {formatPercent(v)}
                    </span>
                    <i style={{ height: `${v * 100}%` }} />
                  </>
                )}
                <span className="sr-only">
                  {v === null
                    ? t('progress.retention.weekEmpty', { week })
                    : t('progress.retention.week', { week, percent: formatPercent(v), count: w.reviews })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="journey-foot journey-spread">
        <span aria-hidden="true">{date(r.weeks[0].week, { day: 'numeric', month: 'short' })}</span>
        <span className="journey-target-key">
          {t('progress.retention.target', { percent: formatPercent(r.target) })}
        </span>
        <span aria-hidden="true">{t('progress.retention.thisWeek')}</span>
      </div>
    </section>
  );
}

/**
 * How sure you were (1–5) against how often those cards were right at their next review (#205): one bar per
 * rating, its height the share right. A rating shows a bar once it has enough reviews behind it.
 */
function Calibration({ p }: { p: Journey }) {
  const { t } = useTranslation();
  const c = p.calibration;
  const [hi, lo] = c.lead;
  const lead = !hi
    ? t('progress.calibration.empty')
    : lo
      ? t('progress.calibration.lead', {
          high: formatNumber(hi.confidence),
          highPercent: formatPercent(hi.rate!),
          low: formatNumber(lo.confidence),
          lowPercent: formatPercent(lo.rate!),
        })
      : t('progress.calibration.leadOne', { level: formatNumber(hi.confidence), percent: formatPercent(hi.rate!) });
  return (
    <section className="panel journey-panel" aria-labelledby="journey-calibration">
      <h2 id="journey-calibration">{t('progress.calibration.title')}</h2>
      <p className="journey-lead">{lead}</p>
      <div className="journey-chart calib-chart">
        <ol className="journey-bars">
          {c.levels.map((l) => (
            <li key={l.confidence}>
              {l.rate === null && hi && (
                <span className="calib-few" aria-hidden="true">
                  {t('progress.calibration.few')}
                </span>
              )}
              {l.rate !== null && (
                <>
                  <span className="journey-bar-value" style={{ bottom: `${l.rate * 100}%` }} aria-hidden="true">
                    {formatPercent(l.rate)}
                  </span>
                  <i style={{ height: `${Math.max(l.rate * 100, 1)}%` }} />
                </>
              )}
              <span className="sr-only">
                {l.rate === null
                  ? t('progress.calibration.levelFew', { level: formatNumber(l.confidence), count: l.rated })
                  : t('progress.calibration.level', {
                      level: formatNumber(l.confidence),
                      percent: formatPercent(l.rate),
                      count: l.rated,
                    })}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <ol className="calib-axis" aria-hidden="true">
        {c.levels.map((l) => (
          <li key={l.confidence}>{formatNumber(l.confidence)}</li>
        ))}
      </ol>
      <div className="journey-foot journey-spread">
        <span>{t('progress.calibration.low')}</span>
        <span>{t('progress.calibration.axis')}</span>
        <span>{t('progress.calibration.high')}</span>
      </div>
    </section>
  );
}

/** Tags the learner has mastered, each with "Teach it back". Nothing shows until there is one. */
function TeachTopics({ onTeach }: { onTeach: (tag: string) => void }) {
  const { t } = useTranslation();
  const [topics, setTopics] = useState<OutputOf<'teachback.topics'>>([]);
  useEffect(() => {
    api
      .teachTopics()
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);
  if (!topics.length) return null;
  return (
    <section className="panel journey-panel journey-teach" aria-labelledby="journey-teach">
      <h2 id="journey-teach">{t('teach.title')}</h2>
      <p className="muted">{t('teach.intro', { seconds: TEACH_SECONDS })}</p>
      <ul>
        {topics.map((topic) => (
          <li key={topic.tag}>
            <span className="grow">
              <b>{topic.tag}</b> <span className="muted small">{t('teach.cards', { count: topic.cards })}</span>
            </span>
            <button
              className="btn"
              onClick={() => onTeach(topic.tag)}
              aria-label={t('teach.startFor', { tag: topic.tag })}
            >
              {t('teach.start')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Hardest({ p, onStudy }: { p: Journey; onStudy: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="panel journey-panel journey-hard" aria-labelledby="journey-hard">
      <div className="journey-hard-head">
        <h2 id="journey-hard">{t('progress.hard.title', { count: p.hardest.length })}</h2>
        {p.hardest.length > 0 && (
          <button className="btn" onClick={onStudy}>
            {t('progress.hard.study')}
          </button>
        )}
      </div>
      {p.hardest.length ? (
        <ol>
          {p.hardest.map((c) => (
            <li key={c.id}>
              <span className="grow">
                <b lang={c.lang ?? undefined}>{c.front}</b>
                <span className="muted">{c.back}</span>
              </span>
              <span className="muted small">
                {c.lapses
                  ? t('progress.hard.forgot', { count: c.lapses })
                  : t('progress.hard.missed', { count: c.wrong })}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">{t('progress.hard.empty')}</p>
      )}
    </section>
  );
}
