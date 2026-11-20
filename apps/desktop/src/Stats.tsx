import { useEffect, useState } from 'react';
import { api } from './api';

const FORMAT_NAMES: Record<string, string> = {
  typed: 'Typing',
  cloze: 'Fill the gap',
  mc: 'Multiple choice',
  match: 'Match pairs',
  gender: 'Der/die/das',
  listen: 'Listening',
  dictation: 'Dictation',
  speak: 'Speaking',
  unscramble: 'Sentence building',
  rain: 'Word rain',
  boss: 'Boss',
  intro: 'New words',
};

export function Stats() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    api.stats().then(setS);
  }, []);
  if (!s) return <div className="muted">Loading…</div>;
  const byDay = new Map(s.heatmap.map((d: any) => [d.day, d]));
  const days: string[] = [];
  const today = new Date();
  for (let i = 125; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const lvl = (d: any) => (!d ? '' : d.xp > 300 ? 'l3' : d.xp > 100 ? 'l2' : d.xp > 0 ? 'l1' : '');
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card">
        <b>Last 18 weeks</b>
        <div className="heat" style={{ marginTop: 10 }}>
          {days.map((d) => (
            <i key={d} className={lvl(byDay.get(d))} title={d} />
          ))}
        </div>
      </div>
      <div className="card">
        <b>Next 7 days: reviews due</b>
        <div className="row" style={{ alignItems: 'flex-end', height: 90, marginTop: 10 }}>
          {s.forecast.map((f: any) => (
            <div key={f.day} className="col grow" style={{ alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: '70%',
                  background: 'var(--accent)',
                  borderRadius: 6,
                  height: Math.min(70, 4 + f.n * 2),
                }}
              />
              <span className="small muted">{f.n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <b>Accuracy by exercise (30 days)</b>
        <table className="t" style={{ marginTop: 8 }}>
          <tbody>
            {s.byFormat.map((f: any) => (
              <tr key={f.format}>
                <td>{FORMAT_NAMES[f.format] ?? f.format}</td>
                <td>{f.n}</td>
                <td>{Math.round(f.accuracy * 100)}%</td>
                <td className="muted">{(f.avgMs / 1000).toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <b>Weak words (14 days)</b>
        <table className="t" style={{ marginTop: 8 }}>
          <tbody>
            {s.weak.length ? (
              s.weak.map((w: any) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.target}</b>
                  </td>
                  <td className="muted">{w.meaning}</td>
                  <td>{w.misses}×</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="muted">Nothing yet. Play a session!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <b>Mastery ladder</b>
        <div className="small muted">0 seen · 1 recognised · 2 matched · 3 recalled · 4 in context · 5 spoken</div>
        <div className="row" style={{ marginTop: 10 }}>
          {s.mastery.map((m: any) => (
            <span key={m.level} className="badge">
              L{m.level}: {m.n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
