// Progress → Badges: every badge as a tile, earned ones with their day, the rest with how to earn them.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { formatNumber } from './i18n';
import { dayDate, MotivationIcon } from './Motivation';

export function Badges({ got }: { got: Record<string, string> }) {
  const { t } = useTranslation();
  const [all, setAll] = useState<string[]>([]);
  useEffect(() => {
    api
      .stats()
      .then((s) => setAll(s.achievements))
      .catch(() => {});
  }, []);
  const earned = all.filter((k) => got[k]).length;
  return (
    <section className="panel journey-panel" aria-labelledby="badges-title">
      <div className="badges-head">
        <h2 id="badges-title">{t('motivation.badgesTitle')}</h2>
        {all.length > 0 && (
          <span className="muted">
            {t('motivation.badgesCount', { got: formatNumber(earned), total: formatNumber(all.length) })}
          </span>
        )}
      </div>
      <ul className="badge-grid">
        {all.map((k) => (
          <li key={k} className={`badge-tile${got[k] ? ' on' : ''}`}>
            <MotivationIcon kind="badge" off={!got[k]} />
            <div>
              <b>{t(`badges.${k}.title`)}</b>
              <span className="muted">{t(`badges.${k}.desc`)}</span>
              <span className="badge-when">
                {got[k] ? t('motivation.earnedOn', { date: dayDate(got[k]) }) : t('motivation.notYet')}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
