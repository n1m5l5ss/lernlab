// The motivation layer (issue #30): small line icons for level, badge, freeze and repair, and the Streak panel on Progress.
// Forgiving by design: freezes cover days off on their own, and a broken streak can come back (docs/PLAN.md, Streak).
import { useTranslation } from 'react-i18next';
import type { StreakState } from '@lernlab/core/game';
import { formatDate, formatNumber } from './i18n';

export type MotivationIconKind = 'level' | 'badge' | 'freeze' | 'repair' | 'goal' | 'boss';

/** The most freezes you can hold (docs/PLAN.md: 2 to start, one every 7 days, 3 at most). */
export const MAX_FREEZES = 3;

/** Day keys (YYYY-MM-DD) are read at noon so no time zone moves them to another day. */
export const dayDate = (day: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) =>
  formatDate(`${day}T12:00:00`, opts);

const PATHS: Record<MotivationIconKind, string> = {
  level: 'M12 19V5M5 12l7-7 7 7',
  badge: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 21l5-3 5 3-1.5-7',
  freeze: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2',
  repair: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
  goal: 'M20 6 9 17l-5-5',
  boss: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
};

/** A line icon in a round tinted disc; decorative, so screen readers skip it (the text next to it says it all). */
export function MotivationIcon({ kind, off = false }: { kind: MotivationIconKind; off?: boolean }) {
  return (
    <span className={`motivation-icon${off ? ' off' : ''}`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PATHS[kind]} />
      </svg>
    </span>
  );
}

/** Progress → Streak: days in a row, the freezes you hold and how you earn them, and repair, explained. */
export function StreakPanel({ streak }: { streak: StreakState }) {
  const { t } = useTranslation();
  return (
    <section className="panel journey-panel streak-panel" aria-labelledby="streak-title">
      <h2 id="streak-title">{t('motivation.streakTitle')}</h2>
      <div className="streak-grid">
        <div className="streak-block">
          <p className="streak-value">{t('motivation.streakDays', { count: streak.current })}</p>
          <p className="muted">{t('motivation.longest', { count: streak.longest })}</p>
        </div>
        <div className="streak-block">
          <div className="streak-freezes">
            <p className="streak-value">{t('motivation.freezesOf', { count: streak.freezes, max: MAX_FREEZES })}</p>
            <ol className="freeze-slots" aria-hidden="true">
              {Array.from({ length: MAX_FREEZES }, (_, i) => (
                <li key={i}>
                  <MotivationIcon kind="freeze" off={i >= streak.freezes} />
                </li>
              ))}
            </ol>
          </div>
          <p className="muted">{t('motivation.freezesHow', { max: MAX_FREEZES })}</p>
        </div>
        <div className="streak-block">
          <p className="streak-value">{t('motivation.repairTitle')}</p>
          {streak.repair ? (
            <p className="streak-repair-active">
              {t('motivation.repairActive', {
                count: streak.repair.value,
                done: formatNumber(streak.repair.sessionsDone),
                deadline: dayDate(streak.repair.deadline),
              })}
            </p>
          ) : (
            <p className="muted">{t('motivation.repairHow')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
