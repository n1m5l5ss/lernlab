import { useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Trans, useTranslation } from 'react-i18next';
import { teacherFor } from '@lernlab/core/teacher';
import { sfx } from './audio';
import { formatPercent } from './i18n';
import { useKeys } from './ctx';
import { bubbleFor } from './lines';
import type { SessionResult } from './Session';

export function Summary({
  result,
  server,
  lang,
  onAgain,
  onHome,
}: {
  result: SessionResult;
  server: any;
  lang: string | null;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { t } = useTranslation();
  const acc = result.answers ? result.correct / result.answers : 0;
  const teacher = teacherFor(lang);
  const done = useMemo(() => bubbleFor(teacher.done(), t), []);
  const hw = bubbleFor(teacher.homework(new Date().getDate()), t);
  useEffect(() => {
    sfx.win();
    if (server?.goalMetNow || server?.unlocked?.length)
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
  }, []);
  useKeys((e) => {
    if (e.key === 'Enter') onHome();
    if (e.key === ' ') {
      e.preventDefault();
      onAgain();
    }
  });
  return (
    <div className="wrap summary col" style={{ gap: 16 }}>
      <div className="teacher" style={{ justifyContent: 'center' }}>
        <div className="avatar" aria-hidden="true">
          {t('home.teacherInitial')}
        </div>
        <div className="bubble" style={{ textAlign: 'left' }}>
          <div>{done.main}</div>
          {done.gloss && <div className="en">{done.gloss}</div>}
        </div>
      </div>
      <div className="big">{t('summary.xp', { xp: result.xp + (server?.bonus ?? 0) })}</div>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat">
          <b>{formatPercent(acc)}</b>
          <span>{t('summary.accuracy')}</span>
        </div>
        <div className="stat">
          <b>{result.answers}</b>
          <span>{t('summary.answers')}</span>
        </div>
        <div className="stat">
          <b>{Math.max(1, Math.round(result.seconds / 60))}</b>
          <span>{t('summary.minutes')}</span>
        </div>
        <div className="stat">
          <b className="flame">
            {server?.streak ? t('summary.streak', { count: server.streak.current }) : t('summary.noStreak')}
          </b>
          <span>{t('summary.dayStreak')}</span>
        </div>
      </div>
      {server?.goalMetNow && (
        <div className="card" style={{ borderColor: 'var(--good)' }}>
          {t('summary.goalReached', { xp: 25 })}
        </div>
      )}
      {server?.unlocked?.map((u: any) => (
        <div key={u.key} className="card" style={{ borderColor: 'var(--accent)' }}>
          <Trans
            i18nKey="summary.newBadge"
            values={{ title: t(`badges.${u.key}.title`), desc: t(`badges.${u.key}.desc`) }}
            components={{ b: <b /> }}
          />
        </div>
      ))}
      {result.bossWon === true && <div className="card">{t('summary.bossDefeated', { xp: 30 })}</div>}
      <div className="card" style={{ textAlign: 'left' }}>
        <b>{t('summary.homework')}</b>
        <div style={{ marginTop: 6 }}>{hw.main}</div>
        {hw.gloss && <div className="small muted">{hw.gloss}</div>}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" onClick={onAgain}>
          {t('summary.again')} <span className="kbd">{t('summary.againKey')}</span>
        </button>
        <button className="btn" onClick={onHome}>
          {t('summary.done')} <span className="kbd">{t('summary.doneKey')}</span>
        </button>
      </div>
    </div>
  );
}
