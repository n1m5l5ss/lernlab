import { useState } from 'react';
import { api } from './api';

const TIMERS = [
  { label: 'Off', blitz: 0, q: 0 },
  { label: 'Relaxed', blitz: 20, q: 0 },
  { label: 'Normal', blitz: 8, q: 0 },
  { label: 'Challenge', blitz: 5, q: 12 },
];

export function Settings({ state, onSaved }: { state: any; onSaved: () => void }) {
  const [s, setS] = useState(state.settings);
  const [msg, setMsg] = useState('');
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  const save = async (next = s) => { await api.saveSettings(next); setMsg('Saved ✓'); onSaved(); setTimeout(() => setMsg(''), 1500); };
  const timer = TIMERS.findIndex((t) => t.blitz === s.blitzSeconds && t.q === (s.questionTimer ?? 0));
  return (
    <div className="card">
      <div className="field"><span>Daily goal (sessions)</span><input type="number" value={s.dailyGoalSessions} onChange={(e) => set('dailyGoalSessions', Number(e.target.value))} /></div>
      <div className="field"><span>Default session length</span>
        <select value={s.sessionLength} onChange={(e) => set('sessionLength', e.target.value)}>
          <option value="mini">Mini (~4 min)</option><option value="standard">Standard (~12 min)</option><option value="long">Long (~20 min)</option>
        </select></div>
      <div className="field"><span>Timers<br /><span className="small muted">Timed rounds only use cards you already know. "Challenge" also times review questions.</span></span>
        <div className="lengths" style={{ margin: 0, width: 360 }}>
          {TIMERS.map((t, i) => <button key={t.label} className={timer === i ? 'on' : ''} onClick={() => setS({ ...s, blitzSeconds: t.blitz, questionTimer: t.q })}>{t.label}</button>)}
        </div></div>
      <div className="field"><span>Sound effects</span><input type="checkbox" checked={s.sound} onChange={(e) => set('sound', e.target.checked)} /></div>
      <div className="field"><span>Teacher speaks aloud (language decks)</span><input type="checkbox" checked={s.teacherVoice} onChange={(e) => set('teacherVoice', e.target.checked)} /></div>
      <div className="field"><span>Target memory retention<br /><span className="small muted">Higher = more reviews. 90% is the recommended balance.</span></span>
        <select value={s.retention} onChange={(e) => set('retention', Number(e.target.value))}>
          <option value={0.85}>Relaxed (85%)</option><option value={0.9}>Balanced (90%)</option><option value={0.95}>Intense (95%)</option>
        </select></div>
      <div className="actions">
        <button className="btn primary" onClick={() => save()}>Save</button>
        <a className="small muted" href="/api/summary/today" target="_blank" rel="noreferrer">Today's summary (JSON for tutors/scripts)</a>
        {msg && <span className="small">{msg}</span>}
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>New cards per day, language and goals are set per deck (Decks → ⚙).</p>
    </div>
  );
}
