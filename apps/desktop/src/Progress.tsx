import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { formatDate } from './i18n';

/** Day keys (YYYY-MM-DD) are read at noon so no time zone shifts them to another day. */
const day = (d: string) => d + 'T12:00:00';

export function Progress() {
  const { t } = useTranslation();
  const [p, setP] = useState<any>(null);
  const fmt = (d: string | null) => (d ? formatDate(day(d)) : t('common.noDate'));
  useEffect(() => {
    api.progress().then(setP);
  }, []);
  if (!p) return <div className="muted">{t('app.loading')}</div>;
  const tot = p.totals;
  const f = p.forecast;
  const max = Math.max(10, ...p.series.map((s: any) => s.cumulative));
  const W = 640,
    H = 140;
  const pts = p.series
    .map((s: any, i: number) => `${(i / (p.series.length - 1)) * W},${H - (s.cumulative / max) * (H - 10)}`)
    .join(' ');
  const pct = (a: number, b: number) => `${b ? Math.min(100, (a / b) * 100) : 0}%`;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat">
          <b>{tot.producible}</b>
          <span>{t('progress.learned')}</span>
        </div>
        <div className="stat">
          <b>{tot.introduced}</b>
          <span>{t('progress.met')}</span>
        </div>
        <div className="stat">
          <b>{tot.remainingDeck}</b>
          <span>{t('progress.left')}</span>
        </div>
        <div className="stat">
          <b>{t('progress.hours', { hours: tot.hours })}</b>
          <span>{t('progress.studied', { count: tot.studyDays })}</span>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <b className="grow">{t('progress.chartTitle', { deck: p.deck?.name ?? t('progress.cardsFallback') })}</b>
          <span className="small muted">
            {t('progress.pace', { cards: p.pace.wordsPerDay, minutes: p.pace.minutesPerDay })}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 160, marginTop: 10 }}
          role="img"
          aria-label={t('progress.chartLabel')}
        >
          <polyline points={`0,${H} ${pts} ${W},${H}`} fill="#2ec27e22" stroke="none" />
          <polyline points={pts} fill="none" stroke="#2ec27e" strokeWidth="3" />
        </svg>
        <div className="row small muted">
          <span>{formatDate(day(p.series[0].day))}</span>
          <span className="grow" />
          <span>{t('progress.today')}</span>
        </div>
      </div>
      <div className="card col">
        <b>{t('progress.leftTitle')}</b>
        <div>
          <div className="row small">
            <span className="grow">{t('progress.thisDeck')}</span>
            <span>{t('progress.of', { done: tot.producible, total: tot.vocabTotal })}</span>
          </div>
          <div className="bar green">
            <i style={{ width: pct(tot.producible, tot.vocabTotal) }} />
          </div>
        </div>
        {tot.grammar.total > 0 && (
          <div>
            <div className="row small">
              <span className="grow">{t('progress.lessons')}</span>
              <span>{t('progress.of', { done: tot.grammar.done, total: tot.grammar.total })}</span>
            </div>
            <div className="bar">
              <i style={{ width: pct(tot.grammar.done, tot.grammar.total) }} />
            </div>
          </div>
        )}
        {f.goal && (
          <div>
            <div className="row small">
              <span className="grow">{t('progress.goalCards', { goal: f.goal.label, count: f.goal.target })}</span>
              <span>{t('progress.of', { done: tot.producible, total: f.goal.target })}</span>
            </div>
            <div className="bar green">
              <i style={{ width: pct(tot.producible, f.goal.target) }} />
            </div>
          </div>
        )}
        {f.goal?.hours && (
          <div>
            <div className="row small">
              <span className="grow">
                {t('progress.goalHours', { goal: f.goal.label, low: f.goal.hours.low, high: f.goal.hours.high })}
              </span>
              <span>{t('progress.ofHours', { done: f.goal.hours.done, total: f.goal.hours.low })}</span>
            </div>
            <div className="bar">
              <i style={{ width: pct(f.goal.hours.done, f.goal.hours.low) }} />
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <b>{t('progress.forecast')}</b>
        <table className="t" style={{ marginTop: 8 }}>
          <tbody>
            <tr>
              <td>{t('progress.deckCurrentPace')}</td>
              <td>
                <b>{fmt(f.deckAtCurrentPace)}</b>
              </td>
            </tr>
            <tr>
              <td>{t('progress.deckAtSetting', { count: p.pace.newPerDaySetting })}</td>
              <td>
                <b>{fmt(f.deckAtSetting)}</b>
              </td>
            </tr>
            {f.goal && (
              <tr>
                <td>{t('progress.goalCurrentPace', { goal: f.goal.label })}</td>
                <td>
                  <b>{fmt(f.goal.atCurrentPace)}</b>
                </td>
              </tr>
            )}
            {f.goal && (
              <tr>
                <td>{t('progress.goalAt30', { goal: f.goal.label, count: 30 })}</td>
                <td>
                  <b>{fmt(f.goal.at30PerDay)}</b>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="small muted" style={{ marginTop: 8 }}>
          {t('progress.paceNote')}
          {f.goal ? ` ${t('progress.examNote')}` : ''}
        </div>
      </div>
    </div>
  );
}
