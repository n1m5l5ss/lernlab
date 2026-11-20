import { useEffect, useState } from 'react';
import type { SessionLength } from '../shared/types';
import { T } from '../shared/teacher';
import { api } from './api';
import { useKeys } from './ctx';

const LENGTHS: { key: SessionLength; label: string; sub: string }[] = [
  { key: 'mini', label: 'Mini', sub: '~4 min' },
  { key: 'standard', label: 'Standard', sub: '~12 min' },
  { key: 'long', label: 'Lang', sub: '~20 min' },
];

export function Home({ state, onStart, refresh }: { state: any; onStart: (l: SessionLength) => void; refresh: () => void }) {
  const [length, setLength] = useState<SessionLength>(state.settings.sessionLength);
  useKeys((e) => { if (e.key === 'Enter' && state.imported && !state.importing) onStart(length); }, [length, state]);

  if (!state.imported) return <ImportPanel state={state} refresh={refresh} />;

  const s = state.streak;
  const lvl = state.level;
  const greet = state.missedYesterday ? T.missedDay() : state.today.goalMet ? ['Tagesziel geschafft! Noch eine Runde?', 'Daily goal done! One more round?'] : T.start();
  const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="teacher">
        <div className="avatar">L</div>
        <div className="bubble"><div>{greet[0]}</div><div className="en">{greet[1]}</div></div>
      </div>
      <div className="hero">
        <div className="card">
          <button className="start" onClick={() => onStart(length)}>LOS GEHT'S <span className="kbd" style={{ color: '#5a3200', borderColor: '#5a3200' }}>Enter</span></button>
          <div className="lengths">
            {LENGTHS.map((l) => (
              <button key={l.key} className={length === l.key ? 'on' : ''} onClick={() => setLength(l.key)}>{l.label}<br /><span className="small">{l.sub}</span></button>
            ))}
          </div>
          <div className="row small muted" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <span>{state.due} due · {state.newLeftToday} new today</span>
            <span>{state.today.goalMet ? '✅ goal done' : `goal: ${state.settings.dailyGoalSessions} session${state.settings.dailyGoalSessions > 1 ? 's' : ''}`}</span>
          </div>
        </div>
        <div className="statgrid">
          <div className="stat"><b>{state.studyDaysMonth}</b><span>study days this month</span></div>
          <div className="stat"><b>🔥 {s.current}</b><span>streak · ❄️ {s.freezes} freeze{s.freezes === 1 ? '' : 's'}</span></div>
          <div className="stat"><b>{state.wordsProducible}</b><span>words you can produce</span></div>
          <div className="stat"><b>Lv {lvl.level}</b><span>{state.totalXp} XP</span><div className="bar" style={{ marginTop: 6 }}><i style={{ width: pct(lvl.into, lvl.span) }} /></div></div>
        </div>
      </div>
      {s.repair && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <b>Streak repair quest:</b> do 2 sessions by {s.repair.deadline} to restore your {s.repair.value}-day streak ({s.repair.sessionsDone}/2).
        </div>
      )}
      <div className="card">
        <div className="row"><b className="grow">Road to Goethe B1</b><span className="muted small">{state.goethe.known} / {state.goethe.total} exam words producible</span></div>
        <div className="bar green" style={{ marginTop: 8 }}><i style={{ width: pct(state.goethe.known, state.goethe.total) }} /></div>
        <div className="row small muted" style={{ marginTop: 8 }}>
          <span>Introduced {state.introduced} of {state.itemCount} items</span><span className="grow" />
          <span>Today: {state.today.xp} XP · {state.today.minutes} min</span>
        </div>
      </div>
      <Achievements got={state.achievements} />
    </div>
  );
}

function Achievements({ got }: { got: Record<string, string> }) {
  const [all, setAll] = useState<Record<string, { title: string; desc: string }>>({});
  useEffect(() => { api.stats().then((s) => setAll(s.achievements)).catch(() => {}); }, []);
  return (
    <div className="card">
      <b>Abzeichen</b>
      <div className="badges" style={{ marginTop: 10 }}>
        {Object.entries(all).map(([k, a]) => <span key={k} className={`badge ${got[k] ? 'on' : ''}`} title={a.desc}>{got[k] ? '🏅' : '🔒'} {a.title}</span>)}
      </div>
    </div>
  );
}

function ImportPanel({ state, refresh }: { state: any; refresh: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = setInterval(async () => {
      const s = await api.importStatus();
      setStatus(s);
      if (!s.running && s.result) { clearInterval(t); refresh(); }
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const start = async () => { setErr(''); try { await api.startImport(); } catch (e: any) { setErr(e.message); } };
  return (
    <div className="card col">
      <h2 style={{ margin: 0 }}>Willkommen! Let's load your German words.</h2>
      <p className="muted">LernLab imports your <b>{state.settings.deck}</b> deck from Anki once (words, sentences, audio). After that it works without Anki.</p>
      <ol className="muted">
        <li>Open Anki (the AnkiConnect add-on must be installed).</li>
        <li>Click the button below.</li>
      </ol>
      <div className="row">
        <button className="btn primary" onClick={start} disabled={status?.running}>{status?.running ? 'Importing…' : 'Import from Anki'}</button>
        <span className="small muted">{status ? (status.anki ? 'Anki connected ✓' : 'Anki not reachable') : ''}</span>
      </div>
      {status?.log?.length > 0 && <div className="small muted">{status.log[status.log.length - 1]}</div>}
      {(err || status?.error) && <div className="feedback wrong">{err || status.error}</div>}
    </div>
  );
}
