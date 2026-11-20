import { useEffect, useState } from 'react';
import type { SessionLength, SessionPlan } from '../shared/types';
import { api } from './api';
import { setSound } from './audio';
import { Home } from './Home';
import { Session, type SessionResult } from './Session';
import { Summary } from './Summary';
import { Stats } from './Stats';
import { Settings } from './Settings';
import { Progress } from './Progress';

type View = { name: 'home' } | { name: 'stats' } | { name: 'progress' } | { name: 'settings' } | { name: 'play'; plan: SessionPlan } | { name: 'summary'; result: SessionResult; server: any };

export function App() {
  const [state, setState] = useState<any>(null);
  const [view, setView] = useState<View>({ name: 'home' });
  const [error, setError] = useState('');

  const refresh = () => api.state().then((s) => { setState(s); setSound(s.settings.sound); return s; }).catch((e) => setError(e.message));

  const start = async (length: SessionLength) => {
    try { setView({ name: 'play', plan: await api.session(length) }); } catch (e: any) { setError(e.message); }
  };

  useEffect(() => {
    refresh().then((s) => {
      // http://localhost:5179/#start opens straight into a session: zero clicks to begin.
      if (s?.imported && location.hash.replace('#', '').replace('/', '') === 'start') { history.replaceState(null, '', '/'); start(s.settings.sessionLength); }
    });
  }, []);

  const finish = async (result: SessionResult) => {
    const server = await api.finish(result).catch(() => null);
    setView({ name: 'summary', result, server });
    refresh();
  };

  if (error) return <div className="wrap"><div className="card feedback wrong">{error} <button className="btn" onClick={() => { setError(''); refresh(); }}>Retry</button></div></div>;
  if (!state) return <div className="wrap muted">Loading…</div>;
  if (view.name === 'play') return <Session plan={view.plan} settings={state.settings} onFinish={finish} onQuit={() => { setView({ name: 'home' }); refresh(); }} />;
  if (view.name === 'summary') return <Summary result={view.result} server={view.server} onAgain={() => start('mini')} onHome={() => setView({ name: 'home' })} />;

  return (
    <div className="wrap">
      <div className="nav">
        <div className="logo grow"><img src="/icon.svg" alt="" />LernLab <span className="small muted" style={{ fontWeight: 500 }}>Deutsch</span></div>
        {(['home', 'progress', 'stats', 'settings'] as const).map((n) => (
          <button key={n} className={`tab ${view.name === n ? 'on' : ''}`} onClick={() => { setView({ name: n } as View); refresh(); }}>{n === 'home' ? 'Spielen' : n === 'progress' ? 'Fortschritt' : n === 'stats' ? 'Statistik' : 'Einstellungen'}</button>
        ))}
      </div>
      {view.name === 'home' && <Home state={state} onStart={start} refresh={refresh} />}
      {view.name === 'progress' && <Progress />}
      {view.name === 'stats' && <Stats />}
      {view.name === 'settings' && <Settings state={state} onSaved={refresh} />}
    </div>
  );
}
