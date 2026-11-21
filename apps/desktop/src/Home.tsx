// Home (mockup: docs/design/images/Home-light.png): one obvious next step, Start, with today's work above it.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionLength } from '@lernlab/core/types';
import { estimateMinutes } from '@lernlab/core/game';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { useKeys } from './ctx';
import { Button, ProgressBar, SegmentedControl, Select } from './components';
import { formatDate, formatNumber } from './i18n';
import { LENGTHS } from './lengths';
import { dayDate, MotivationIcon } from './Motivation';
import { parseSourceValue, sourceValue } from './sources';
import { UpdateNote } from './UpdateNote';
import { HabitNote } from './StudyPlan';
import { markOnce, MARKS } from './perf';

type AppState = OutputOf<'state.get'>;

/** Day keys are read at noon so no time zone moves them to another day. */
const noon = (day: string) => new Date(`${day}T12:00:00`);

export function Home({
  state,
  onStart,
  refresh,
  goDecks,
}: {
  state: AppState;
  onStart: (l: SessionLength, practice: boolean) => void;
  refresh: () => void;
  goDecks: () => void;
}) {
  const { t } = useTranslation();
  const [length, setLength] = useState<SessionLength>(state.settings.sessionLength);
  const [practice, setPractice] = useState(false);
  const canStart = state.decks.length > 0;
  // Home has its data and Start works: the end of the startup path (docs/TESTING.md, performance budgets).
  useEffect(() => markOnce(MARKS.homeInteractive), []);
  useKeys(
    (e) => {
      // Enter starts, unless a control has focus and Enter means something there.
      if (e.key === 'Enter' && canStart && !(e.target as HTMLElement).closest('select, a, button, input, textarea'))
        onStart(length, practice);
    },
    [length, state],
  );

  if (!canStart) {
    return (
      <section className="panel home-empty" aria-labelledby="home-empty-title">
        <h2 id="home-empty-title">{t('home.welcomeTitle')}</h2>
        <p className="muted">{t('home.welcomeBody')}</p>
        <div>
          <Button variant="primary" onClick={goDecks}>
            {t('home.welcomeAction')}
          </Button>
        </div>
      </section>
    );
  }

  const s = state.streak;
  const lvl = state.level;
  const goal = state.goal;
  const daysStudied = state.week.filter((d) => d.studied).length;

  return (
    <div className="home">
      <UpdateNote />
      <section className="panel home-session" aria-label={t('home.sessionLabel')}>
        <div className="home-numbers">
          <div>
            <span className="home-number">{formatNumber(state.due)}</span>
            <span className="muted">{t('home.reviewsDue', { count: state.due })}</span>
          </div>
          <div>
            <span className="home-number">{formatNumber(state.newLeftToday)}</span>
            <span className="muted">{t('home.newCards', { count: state.newLeftToday })}</span>
          </div>
          <div>
            <span className="home-number">
              {t('home.estimate', { count: estimateMinutes(state.due, state.newLeftToday) })}
            </span>
            <span className="muted">{t('home.estimated')}</span>
          </div>
        </div>
        <div className="home-choices">
          <Select
            id="home-deck"
            label={t('home.deckPicker')}
            className="home-field home-deck"
            value={sourceValue(state.source)}
            onChange={async (e) => {
              const source = parseSourceValue(e.target.value);
              if (!source) return;
              await api.chooseSource(source);
              refresh();
            }}
          >
            {state.decks.map((d) => (
              <option key={d.id} value={`deck:${d.id}`}>
                {d.name}
              </option>
            ))}
            {state.source.kind === 'decks' && (
              <option value={sourceValue(state.source)}>
                {t('home.source.decks', { count: state.source.deckIds.length })}
              </option>
            )}
            <option value="all">{t('home.allDecks')}</option>
            {state.starredCount > 0 && (
              <option value="starred">{t('home.source.starred', { count: state.starredCount })}</option>
            )}
            {state.hardestCount > 0 && (
              <option value="hardest">{t('home.source.hardest', { count: state.hardestCount })}</option>
            )}
            {state.tags.length > 0 && (
              <optgroup label={t('home.source.tags')}>
                {state.tags.map((tag) => (
                  <option key={tag} value={`tag:${tag}`}>
                    {t('home.source.tag', { tag })}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          <div className="home-field">
            <span id="home-length">{t('home.sessionLength')}</span>
            <SegmentedControl
              labelledBy="home-length"
              className="home-segmented"
              value={length}
              onChange={setLength}
              options={LENGTHS.map((l) => ({ value: l.key, label: t('home.lengthMinutes', { count: l.minutes }) }))}
            />
          </div>
        </div>
        <label className="home-practice">
          <input type="checkbox" role="switch" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
          <span>
            <b>{t('home.practice')}</b> <span className="muted">{t('home.practiceHint')}</span>
          </span>
        </label>
        <Button variant="primary" className="home-start" onClick={() => onStart(length, practice)}>
          {practice ? t('home.startPractice') : t('home.startStudying')} <kbd>{t('home.startKey')}</kbd>
        </Button>
      </section>
      {s.repair && (
        <p className="panel home-repair">
          <MotivationIcon kind="repair" />
          <span>
            <b>{t('home.repairTitle')}</b>{' '}
            {t('home.repairBody', {
              deadline: dayDate(s.repair.deadline),
              count: s.repair.value,
              done: s.repair.sessionsDone,
            })}
          </span>
        </p>
      )}
      <div className="home-tiles">
        <section className="panel home-tile" aria-labelledby="home-week">
          <h2 id="home-week">{t('home.thisWeek')}</h2>
          <p className="home-tile-value">{t('home.daysOfWeek', { count: daysStudied })}</p>
          <ol className="week">
            {state.week.map((d) => (
              <li key={d.day} className={`${d.studied ? 'on' : ''} ${d.today ? 'today' : ''}`}>
                <i aria-hidden="true" />
                <span aria-hidden="true">{formatDate(noon(d.day), { weekday: 'narrow' })}</span>
                <span className="sr-only">
                  {t(d.studied ? 'home.dayStudied' : 'home.dayNotStudied', {
                    day: formatDate(noon(d.day), { weekday: 'long' }),
                  })}
                </span>
              </li>
            ))}
          </ol>
          <p className="home-freezes muted">
            <MotivationIcon kind="freeze" off={!s.freezes} />
            {s.freezes ? t('home.freezes', { count: s.freezes }) : t('home.freezesNone')}
          </p>
          {state.settings.habitNote && (
            <HabitNote onHide={() => void api.saveSettings({ habitNote: false }).then(refresh, () => refresh())} />
          )}
        </section>
        <section className="panel home-tile" aria-labelledby="home-level">
          <h2 id="home-level">{t('home.levelTitle', { level: lvl.level })}</h2>
          <p className="home-tile-value">{t('home.xpOf', { xp: lvl.into, next: lvl.span })}</p>
          <ProgressBar labelledBy="home-level" value={lvl.into} max={lvl.span} />
        </section>
        <section className="panel home-tile" aria-labelledby="home-goal">
          <h2 id="home-goal">{goal ? t('home.goalTitle', { goal: goal.label }) : t('home.knownTitle')}</h2>
          <p className="home-tile-value">
            {goal
              ? t('home.knownOf', { known: goal.known, total: goal.total })
              : t('home.knownOf', { known: state.wordsProducible, total: state.itemCount })}
          </p>
          <ProgressBar
            labelledBy="home-goal"
            value={goal ? goal.known : state.wordsProducible}
            max={goal ? goal.total : state.itemCount}
          />
        </section>
      </div>
    </div>
  );
}
