import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { formatDate, formatPercent } from './i18n';

export function Stats() {
  const { t, i18n } = useTranslation();
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    api.stats().then(setS);
  }, []);
  if (!s) return <div className="muted">{t('app.loading')}</div>;
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
        <b>{t('stats.heatmap')}</b>
        <div className="heat" style={{ marginTop: 10 }}>
          {days.map((d) => (
            <i key={d} className={lvl(byDay.get(d))} title={formatDate(d + 'T12:00:00')} />
          ))}
        </div>
      </div>
      <div className="card">
        <b>{t('stats.forecast')}</b>
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
        <b>{t('stats.accuracy')}</b>
        <table className="t" style={{ marginTop: 8 }}>
          <tbody>
            {s.byFormat.map((f: any) => (
              <tr key={f.format}>
                <td>{i18n.exists(`stats.format.${f.format}`) ? t(`stats.format.${f.format}`) : f.format}</td>
                <td>{f.n}</td>
                <td>{formatPercent(f.accuracy)}</td>
                <td className="muted">{t('stats.seconds', { seconds: f.avgMs / 1000 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <b>{t('stats.weak')}</b>
        <table className="t" style={{ marginTop: 8 }}>
          <tbody>
            {s.weak.length ? (
              s.weak.map((w: any) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.target}</b>
                  </td>
                  <td className="muted">{w.meaning}</td>
                  <td>{t('stats.misses', { count: w.misses })}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="muted">{t('stats.weakEmpty')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <b>{t('stats.ladder')}</b>
        <div className="small muted">{t('stats.ladderLegend')}</div>
        <div className="row" style={{ marginTop: 10 }}>
          {s.mastery.map((m: any) => (
            <span key={m.level} className="badge">
              {t('stats.ladderLevel', { level: m.level, count: m.n })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
