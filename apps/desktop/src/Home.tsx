import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionLength } from '@lernlab/core/types';
import { teacherFor } from '@lernlab/core/teacher';
import { api } from './api';
import { useKeys } from './ctx';
import { bubbleFor } from './lines';
import { UpdateNote } from './UpdateNote';

const LENGTHS: { key: SessionLength; minutes: number }[] = [
  { key: 'mini', minutes: 4 },
  { key: 'standard', minutes: 12 },
  { key: 'long', minutes: 20 },
];

export function Home({
  state,
  onStart,
  refresh,
  goDecks,
}: {
  state: any;
  onStart: (l: SessionLength) => void;
  refresh: () => void;
  goDecks: () => void;
}) {
  const { t } = useTranslation();
  const [length, setLength] = useState<SessionLength>(state.settings.sessionLength);
  const deck = state.decks.find((d: any) => d.id === state.activeDeck);
  useKeys(
    (e) => {
      if (e.key === 'Enter' && deck && !(e.target as HTMLElement).closest('select, a, button, input, textarea'))
        onStart(length);
    },
    [length, state],
  );

  if (!state.decks.length) {
    return (
      <div className="card col center" style={{ padding: 40 }}>
        <div style={{ fontSize: 44 }}>👋</div>
        <h2 style={{ margin: 0 }}>{t('home.welcomeTitle')}</h2>
        <p className="muted">{t('home.welcomeBody')}</p>
        <div>
          <button className="btn primary" onClick={goDecks}>
            {t('home.welcomeAction')}
          </button>
        </div>
      </div>
    );
  }

  const teacher = teacherFor(deck?.language);
  const s = state.streak;
  const lvl = state.level;
  const greet = bubbleFor(
    state.missedYesterday ? teacher.missedDay() : state.today.goalMet ? teacher.goalMet() : teacher.start(),
    t,
  );
  const pct = (a: number, b: number) => `${b ? Math.min(100, Math.round((a / b) * 100)) : 0}%`;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <div className="teacher grow">
          <div className="avatar" aria-hidden="true">
            {t('home.teacherInitial')}
          </div>
          <div className="bubble">
            <div>{greet.main}</div>
            {greet.gloss && <div className="en">{greet.gloss}</div>}
          </div>
        </div>
        <select
          value={state.activeDeck ?? ''}
          onChange={async (e) => {
            await api.activate(Number(e.target.value));
            refresh();
          }}
          title={t('home.deckPicker')}
          aria-label={t('home.deckPicker')}
        >
          {state.decks.map((d: any) => (
            <option key={d.id} value={d.id}>
              {t('home.deckOption', { name: d.name, count: d.due })}
            </option>
          ))}
        </select>
      </div>
      <UpdateNote />
      <div className="hero">
        <div className="card">
          <button className="start" onClick={() => onStart(length)}>
            {t('home.start')} <span className="kbd">{t('home.startKey')}</span>
          </button>
          <div className="lengths">
            {LENGTHS.map((l) => (
              <button key={l.key} className={length === l.key ? 'on' : ''} onClick={() => setLength(l.key)}>
                {t(`home.length.${l.key}`)}
                <br />
                <span className="small">{t('home.minutes', { count: l.minutes })}</span>
              </button>
            ))}
          </div>
          <div className="row small muted" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <span>{t('home.deckLine', { deck: deck?.name, due: state.due, newCount: state.newLeftToday })}</span>
            <span>
              {state.today.goalMet ? t('home.goalDone') : t('home.goal', { count: state.settings.dailyGoalSessions })}
            </span>
          </div>
        </div>
        <div className="statgrid">
          <div className="stat">
            <b>{state.studyDaysMonth}</b>
            <span>{t('home.studyDays')}</span>
          </div>
          <div className="stat">
            <b>{t('home.streak', { count: s.current })}</b>
            <span>{t('home.freezes', { count: s.freezes })}</span>
          </div>
          <div className="stat">
            <b>{state.wordsProducible}</b>
            <span>{t('home.knownFromMemory')}</span>
          </div>
          <div className="stat">
            <b>{t('home.level', { level: lvl.level })}</b>
            <span>{t('home.xp', { xp: state.totalXp })}</span>
            <div className="bar" style={{ marginTop: 6 }}>
              <i style={{ width: pct(lvl.into, lvl.span) }} />
            </div>
          </div>
        </div>
      </div>
      {s.repair && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <b>{t('home.repairTitle')}</b>{' '}
          {t('home.repairBody', { deadline: s.repair.deadline, days: s.repair.value, done: s.repair.sessionsDone })}
        </div>
      )}
      <div className="card">
        <div className="row">
          <b className="grow">
            {state.goal
              ? t('home.roadTo', { goal: state.goal.label })
              : t('home.deckProgress', { deck: deck?.name ?? t('home.deckFallback') })}
          </b>
          <span className="muted small">
            {state.goal
              ? t('home.knownCount', { known: state.goal.known, total: state.goal.total })
              : t('home.knownCount', { known: state.wordsProducible, total: state.itemCount })}
          </span>
        </div>
        <div className="bar green" style={{ marginTop: 8 }}>
          <i
            style={{
              width: state.goal ? pct(state.goal.known, state.goal.total) : pct(state.wordsProducible, state.itemCount),
            }}
          />
        </div>
        <div className="row small muted" style={{ marginTop: 8 }}>
          <span>{t('home.met', { introduced: state.introduced, total: state.itemCount })}</span>
          <span className="grow" />
          <span>{t('home.today', { xp: state.today.xp, minutes: state.today.minutes })}</span>
        </div>
      </div>
      <Achievements got={state.achievements} />
    </div>
  );
}

function Achievements({ got }: { got: Record<string, string> }) {
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
