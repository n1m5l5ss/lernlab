// Progress: the journey. Per deck learned vs remaining, pace and forecast; study days; retention; hardest cards.
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { directionOf } from './direction';
import { formatDate, formatNumber, formatPercent } from './i18n';
import { heatColumn, heatmapWeeks, monthStarts, recallRate } from './progress-logic';

type Journey = OutputOf<'progress.get'>;
type DeckJourney = Journey['decks'][number];

/** Day keys (YYYY-MM-DD) are read at noon so no time zone shifts them to another day. */
const date = (day: string, opts?: Intl.DateTimeFormatOptions) => formatDate(`${day}T12:00:00`, opts);
const b = { b: <b /> };

export function Progress({ onStudyHardest }: { onStudyHardest: () => void }) {
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
      <Hardest p={p} onStudy={onStudyHardest} />
    </div>
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
    </section>
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
