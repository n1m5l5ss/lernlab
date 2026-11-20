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
import { Decks } from './Decks';
import { Browse } from './Browse';

type Tab = 'home' | 'decks' | 'browse' | 'progress' | 'stats' | 'settings';
type View = { name: Tab } | { name: 'play'; plan: SessionPlan } | { name: 'summary'; result: SessionResult; server: any; lang: string | null };
const TABS: [Tab, string][] = [['home', 'Study'], ['decks', 'Decks'], ['browse', 'Cards'], ['progress', 'Progress'], ['stats', 'Stats'], ['settings', 'Settings']];

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
      // #start opens straight into a session: zero clicks to begin (bookmark it, or use the desktop shortcut).
      if (s?.decks?.length && location.hash.replace(/[#/]/g, '') === 'start') { history.replaceState(null, '', '/'); start(s.settings.sessionLength); }
    });
    const onHash = () => { if (location.hash.replace(/[#/]/g, '') === 'start') { history.replaceState(null, '', '/'); start('standard'); } };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const finish = async (result: SessionResult, lang: string | null) => {
    const server = await api.finish(result).catch(() => null);
    setView({ name: 'summary', result, server, lang });
    refresh();
  };

  if (error) return <div className="wrap"><div className="card feedback wrong">{error} <button className="btn" onClick={() => { setError(''); refresh(); }}>Retry</button></div></div>;
  if (!state) return <div className="wrap muted">Loading…</div>;
  if (view.name === 'play') return <Session plan={view.plan} settings={state.settings} onFinish={(r) => finish(r, view.plan.lang)} onQuit={() => { setView({ name: 'home' }); refresh(); }} />;
  if (view.name === 'summary') return <Summary result={view.result} server={view.server} lang={view.lang} onAgain={() => start('mini')} onHome={() => setView({ name: 'home' })} />;

  return (
    <div className="wrap" style={{ maxWidth: view.name === 'browse' || view.name === 'decks' ? 1180 : undefined }}>
      <div className="nav">
        <div className="logo grow"><img src="/icon.svg" alt="" />LernLab</div>
        {TABS.map(([n, label]) => <button key={n} className={`tab ${view.name === n ? 'on' : ''}`} onClick={() => { setView({ name: n }); refresh(); }}>{label}</button>)}
      </div>
      {view.name === 'home' && <Home state={state} onStart={start} refresh={refresh} goDecks={() => setView({ name: 'decks' })} />}
      {view.name === 'decks' && <Decks state={state} refresh={refresh} onStudy={() => setView({ name: 'home' })} onBrowse={() => setView({ name: 'browse' })} />}
      {view.name === 'browse' && <Browse state={state} refresh={refresh} />}
      {view.name === 'progress' && <Progress />}
      {view.name === 'stats' && <Stats />}
      {view.name === 'settings' && <Settings state={state} onSaved={refresh} />}
    </div>
  );
}
