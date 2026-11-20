import { useState } from 'react';
import { api } from './api';

export function Settings({ state, onSaved }: { state: any; onSaved: () => void }) {
  const [s, setS] = useState(state.settings);
  const [msg, setMsg] = useState('');
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  const save = async () => { await api.saveSettings(s); setMsg('Saved ✓'); onSaved(); setTimeout(() => setMsg(''), 1500); };
  const reimport = async () => {
    try { await api.startImport(); setMsg('Re-importing from Anki… your progress is kept.'); } catch (e: any) { setMsg(e.message); }
  };
  return (
    <div className="card">
      <div className="field"><span>New words per day<br /><span className="small muted">10 while building the habit; raise later</span></span><input type="number" value={s.newPerDay} onChange={(e) => set('newPerDay', Number(e.target.value))} /></div>
      <div className="field"><span>Daily goal (sessions)</span><input type="number" value={s.dailyGoalSessions} onChange={(e) => set('dailyGoalSessions', Number(e.target.value))} /></div>
      <div className="field"><span>Default session length</span>
        <select value={s.sessionLength} onChange={(e) => set('sessionLength', e.target.value)}>
          <option value="mini">Mini (~4 min)</option><option value="standard">Standard (~12 min)</option><option value="long">Long (~20 min)</option>
        </select></div>
      <div className="field"><span>Sound effects</span><input type="checkbox" checked={s.sound} onChange={(e) => set('sound', e.target.checked)} /></div>
      <div className="field"><span>Teacher speaks German aloud</span><input type="checkbox" checked={s.teacherVoice} onChange={(e) => set('teacherVoice', e.target.checked)} /></div>
      <div className="field"><span>Anki deck<br /><span className="small muted">Imported with sub-decks</span></span><input value={s.deck} onChange={(e) => set('deck', e.target.value)} style={{ width: 200 }} /></div>
      <div className="actions">
        <button className="btn primary" onClick={save}>Save</button>
        <button className="btn ghost" onClick={reimport}>Refresh words from Anki</button>
        <a className="small muted" href="/api/summary/today" target="_blank">Today's summary (JSON for the tutor)</a>
      </div>
      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
