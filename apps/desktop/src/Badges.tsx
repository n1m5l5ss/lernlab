import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';

/** Every badge, earned or still locked. Shown on Progress. */
export function Badges({ got }: { got: Record<string, string> }) {
  const { t } = useTranslation();
  const [all, setAll] = useState<string[]>([]);
  useEffect(() => {
    api
      .stats()
      .then((s) => setAll(s.achievements))
      .catch(() => {});
  }, []);
  return (
    <div className="card">
      <b>{t('home.badges')}</b>
      <div className="badges" style={{ marginTop: 10 }}>
        {all.map((k) => (
          <span key={k} className={`badge ${got[k] ? 'on' : ''}`} title={t(`badges.${k}.desc`)}>
            {got[k] ? '🏅' : '🔒'} {t(`badges.${k}.title`)}
          </span>
        ))}
      </div>
    </div>
  );
}
