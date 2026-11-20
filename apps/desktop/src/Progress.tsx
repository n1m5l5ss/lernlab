import { useEffect, useState } from 'react';
import { api } from './api';

const fmt = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function Progress() {
  const [p, setP] = useState<any>(null);
  useEffect(() => { api.progress().then(setP); }, []);
  if (!p) return <div className="muted">Loading…</div>;
  const t = p.totals;
  const f = p.forecast;
  const max = Math.max(10, ...p.series.map((s: any) => s.cumulative));
  const W = 640, H = 140;
  const pts = p.series.map((s: any, i: number) => `${(i / (p.series.length - 1)) * W},${H - (s.cumulative / max) * (H - 10)}`).join(' ');
  const pct = (a: number, b: number) => `${b ? Math.min(100, (a / b) * 100) : 0}%`;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat"><b>{t.producible}</b><span>learned (recalled from memory)</span></div>
        <div className="stat"><b>{t.introduced}</b><span>cards met</span></div>
        <div className="stat"><b>{t.remainingDeck}</b><span>left in your deck</span></div>
        <div className="stat"><b>{t.hours} h</b><span>studied · {t.studyDays} days</span></div>
      </div>
      <div className="card">
        <div className="row"><b className="grow">{p.deck?.name ?? 'Cards'} learned, last 60 days</b><span className="small muted">{p.pace.wordsPerDay} cards/day · {p.pace.minutesPerDay} min/day (7-day average)</span></div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160, marginTop: 10 }} role="img" aria-label="Cards learned over time">
          <polyline points={`0,${H} ${pts} ${W},${H}`} fill="#2ec27e22" stroke="none" />
          <polyline points={pts} fill="none" stroke="#2ec27e" strokeWidth="3" />
        </svg>
        <div className="row small muted"><span>{p.series[0].day}</span><span className="grow" /><span>today</span></div>
      </div>
      <div className="card col">
        <b>How much is left</b>
        <div><div className="row small"><span className="grow">This deck</span><span>{t.producible} / {t.vocabTotal}</span></div><div className="bar green"><i style={{ width: pct(t.producible, t.vocabTotal) }} /></div></div>
        {t.grammar.total > 0 && <div><div className="row small"><span className="grow">Lessons started</span><span>{t.grammar.done} / {t.grammar.total}</span></div><div className="bar"><i style={{ width: pct(t.grammar.done, t.grammar.total) }} /></div></div>}
        {f.goal && <div><div className="row small"><span className="grow">{f.goal.label} (≈ {f.goal.target} cards)</span><span>{t.producible} / {f.goal.target}</span></div><div className="bar green"><i style={{ width: pct(t.producible, f.goal.target) }} /></div></div>}
        {f.goal?.hours && <div><div className="row small"><span className="grow">{f.goal.label} study hours (estimate {f.goal.hours.low}–{f.goal.hours.high} h)</span><span>{f.goal.hours.done} / {f.goal.hours.low} h</span></div><div className="bar"><i style={{ width: pct(f.goal.hours.done, f.goal.hours.low) }} /></div></div>}
      </div>
      <div className="card">
        <b>Forecast</b>
        <table className="t" style={{ marginTop: 8 }}><tbody>
          <tr><td>Finish your deck at your current pace</td><td><b>{fmt(f.deckAtCurrentPace)}</b></td></tr>
          <tr><td>Finish your deck at {p.pace.newPerDaySetting} new words/day</td><td><b>{fmt(f.deckAtSetting)}</b></td></tr>
          {f.goal && <tr><td>{f.goal.label} at your current pace</td><td><b>{fmt(f.goal.atCurrentPace)}</b></td></tr>}
          {f.goal && <tr><td>{f.goal.label} at 30 cards/day</td><td><b>{fmt(f.goal.at30PerDay)}</b></td></tr>}
        </tbody></table>
        <div className="small muted" style={{ marginTop: 8 }}>Pace counts missed days, so the dates move with what you actually do.{f.goal ? ' Knowing the cards is only part of an exam – practise its real format too.' : ''}</div>
      </div>
    </div>
  );
}
