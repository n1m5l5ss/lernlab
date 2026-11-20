import { useEffect, useState } from 'react';
import type { SessionLength } from '@lernlab/core/types';
import { teacherFor } from '@lernlab/core/teacher';
import { api } from './api';
import { useKeys } from './ctx';

const LENGTHS: { key: SessionLength; label: string; sub: string }[] = [
  { key: 'mini', label: 'Mini', sub: '~4 min' },
  { key: 'standard', label: 'Standard', sub: '~12 min' },
  { key: 'long', label: 'Long', sub: '~20 min' },
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
  const [length, setLength] = useState<SessionLength>(state.settings.sessionLength);
  const deck = state.decks.find((d: any) => d.id === state.activeDeck);
  useKeys(
    (e) => {
      if (e.key === 'Enter' && deck && !(e.target as HTMLElement).closest('select')) onStart(length);
    },
    [length, state],
  );

  if (!state.decks.length) {
    return (
      <div className="card col center" style={{ padding: 40 }}>
        <div style={{ fontSize: 44 }}>👋</div>
        <h2 style={{ margin: 0 }}>Welcome to LernLab</h2>
        <p className="muted">
          Learn anything – languages, cloud certifications, medicine, physics – with short game rounds and smart spaced
          repetition. Everything stays on your computer.
        </p>
        <div>
          <button className="btn primary" onClick={goDecks}>
            Import or create your first deck
          </button>
        </div>
      </div>
    );
  }

  const t = teacherFor(deck?.language);
  const s = state.streak;
  const lvl = state.level;
  const greet = state.missedYesterday
    ? t.missedDay()
    : state.today.goalMet
      ? deck?.language === 'de'
        ? ['Tagesziel geschafft! Noch eine Runde?', 'Daily goal done! One more round?']
        : ['Daily goal done! One more round?', '']
      : t.start();
  const pct = (a: number, b: number) => `${b ? Math.min(100, Math.round((a / b) * 100)) : 0}%`;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <div className="teacher grow">
          <div className="avatar">L</div>
          <div className="bubble">
            <div>{greet[0]}</div>
            {greet[1] && <div className="en">{greet[1]}</div>}
          </div>
        </div>
        <select
          value={state.activeDeck ?? ''}
          onChange={async (e) => {
            await api.activate(Number(e.target.value));
            refresh();
          }}
          title="Deck"
        >
          {state.decks.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.due} due
            </option>
          ))}
        </select>
      </div>
      <div className="hero">
        <div className="card">
          <button className="start" onClick={() => onStart(length)}>
            START <span className="kbd">Enter</span>
          </button>
          <div className="lengths">
            {LENGTHS.map((l) => (
              <button key={l.key} className={length === l.key ? 'on' : ''} onClick={() => setLength(l.key)}>
                {l.label}
                <br />
                <span className="small">{l.sub}</span>
              </button>
            ))}
          </div>
          <div className="row small muted" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <span>
              {deck?.name}: {state.due} due · {state.newLeftToday} new today
            </span>
            <span>
              {state.today.goalMet
                ? '✅ goal done'
                : `goal: ${state.settings.dailyGoalSessions} session${state.settings.dailyGoalSessions > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        <div className="statgrid">
          <div className="stat">
            <b>{state.studyDaysMonth}</b>
            <span>study days this month</span>
          </div>
          <div className="stat">
            <b>🔥 {s.current}</b>
            <span>
              streak · ❄️ {s.freezes} freeze{s.freezes === 1 ? '' : 's'}
            </span>
          </div>
          <div className="stat">
            <b>{state.wordsProducible}</b>
            <span>cards you know from memory</span>
          </div>
          <div className="stat">
            <b>Lv {lvl.level}</b>
            <span>{state.totalXp} XP</span>
            <div className="bar" style={{ marginTop: 6 }}>
              <i style={{ width: pct(lvl.into, lvl.span) }} />
            </div>
          </div>
        </div>
      </div>
      {s.repair && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <b>Streak repair quest:</b> do 2 sessions by {s.repair.deadline} to restore your {s.repair.value}-day streak (
          {s.repair.sessionsDone}/2).
        </div>
      )}
      <div className="card">
        <div className="row">
          <b className="grow">{state.goal ? `Road to ${state.goal.label}` : `${deck?.name ?? 'Deck'} progress`}</b>
          <span className="muted small">
            {state.goal ? `${state.goal.known} / ${state.goal.total}` : `${state.wordsProducible} / ${state.itemCount}`}{' '}
            known
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
          <span>
            Met {state.introduced} of {state.itemCount} cards
          </span>
          <span className="grow" />
          <span>
            Today: {state.today.xp} XP · {state.today.minutes} min
          </span>
        </div>
      </div>
      <Achievements got={state.achievements} />
    </div>
  );
}

function Achievements({ got }: { got: Record<string, string> }) {
  const [all, setAll] = useState<Record<string, { title: string; desc: string }>>({});
  useEffect(() => {
    api
      .stats()
      .then((s) => setAll(s.achievements))
      .catch(() => {});
  }, []);
  return (
    <div className="card">
      <b>Badges</b>
      <div className="badges" style={{ marginTop: 10 }}>
        {Object.entries(all).map(([k, a]) => (
          <span key={k} className={`badge ${got[k] ? 'on' : ''}`} title={a.desc}>
            {got[k] ? '🏅' : '🔒'} {a.title}
          </span>
        ))}
      </div>
    </div>
  );
}
