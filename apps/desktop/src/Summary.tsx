// The end of a session: what you recalled, what you earned, and the cards that come back tomorrow.
import { useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';
import type { Item } from '@lernlab/core/types';
import type { OutputOf } from '../backend/handlers';
import { sfx } from './audio';
import { useKeys } from './ctx';
import { formatNumber } from './i18n';
import { Rich } from './rich';
import type { SessionResult } from './Session';
import { summaryFacts } from './summary-logic';

export function Summary({
  result,
  server,
  items,
  lang,
  onAgain,
  onHome,
}: {
  result: SessionResult;
  server: OutputOf<'session.finish'> | null;
  items: Record<number, Item>;
  lang: string | null;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { t } = useTranslation();
  const f = useMemo(() => summaryFacts(result, server, items), [result, server, items]);
  useEffect(() => {
    sfx.win();
    // A celebration only at the end, and only for a real milestone.
    if (server?.goalMetNow || server?.unlocked?.length)
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
  }, []);
  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onHome();
    }
    if (e.key === ' ') {
      e.preventDefault();
      onAgain();
    }
  });
  return (
    <main className="summary">
      <p className="summary-kicker">
        {t(result.practice ? 'summary.kickerPractice' : 'summary.kicker', { count: f.minutes })}
      </p>
      <h1 tabIndex={-1}>
        {f.total ? t('summary.recalled', { count: f.recalled, total: f.total }) : t('summary.noAnswers')}
      </h1>
      {result.practice && <p className="summary-note">{t('summary.practice')}</p>}
      <div className="summary-tiles">
        <section className="panel summary-tile">
          <b>{formatNumber(f.introduced)}</b>
          <span>{t('summary.introduced', { count: f.introduced })}</span>
        </section>
        <section className="panel summary-tile">
          <b>{t('summary.xp', { xp: f.xp })}</b>
          {f.level && (
            <>
              <div className="meter" aria-hidden="true">
                <i style={{ width: `${f.level.percent}%` }} />
              </div>
              <span className="small">{t('summary.toLevel', { xp: f.level.toNext, level: f.level.next })}</span>
            </>
          )}
        </section>
        <section className="panel summary-tile">
          <b>{f.daysThisWeek === null ? '–' : t('summary.daysOf', { count: f.daysThisWeek })}</b>
          <span>{t('summary.daysThisWeek')}</span>
        </section>
      </div>
      {(server?.goalMetNow || !!server?.unlocked.length || result.bossWon) && (
        <ul className="panel summary-wins">
          {server?.goalMetNow && <li>{t('summary.goalReached', { xp: 25 })}</li>}
          {server?.unlocked.map((u) => (
            <li key={u.key}>
              {t('summary.newBadge', { title: t(`badges.${u.key}.title`), desc: t(`badges.${u.key}.desc`) })}
            </li>
          ))}
          {result.bossWon && <li>{t('summary.bossDefeated', { xp: 30 })}</li>}
        </ul>
      )}
      {f.missed.length > 0 && (
        <section className="panel summary-missed" aria-labelledby="summary-missed">
          <h2 id="summary-missed">
            {t(result.practice ? 'summary.missedPractice' : 'summary.missed', { count: result.missed.length })}
          </h2>
          <ul>
            {f.missed.map((it) => (
              <li key={it.id}>
                <b lang={lang ?? undefined}>
                  <Rich html={it.target} />
                </b>
                <span className="muted">
                  <Rich html={it.meaning} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="summary-actions">
        <button className="btn" onClick={onAgain}>
          {t('summary.again')} <span className="kbd">{t('summary.againKey')}</span>
        </button>
        <button className="btn primary" onClick={onHome}>
          {t('summary.done')} <span className="kbd">{t('summary.doneKey')}</span>
        </button>
      </div>
    </main>
  );
}
