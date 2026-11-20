import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionLength, SessionPlan } from '@lernlab/core/types';
import type { OutputOf } from '../backend/handlers';
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
import { Badges } from './Badges';
import { Shell } from './Shell';
import { formatDate, setLanguage } from './i18n';
import { applyTheme } from './theme';
import { hashFor, isStartHash, routeFromHash, type Route } from './routes';

type AppState = OutputOf<'state.get'>;
/** The study session and its summary fill the window; everything else sits in the shell. */
type FullScreen =
  | { name: 'play'; plan: SessionPlan }
  | {
      name: 'summary';
      result: SessionResult;
      server: OutputOf<'session.finish'> | null;
      lang: string | null;
      items: SessionPlan['items'];
    };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState | null>(null);
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash));
  const [full, setFull] = useState<FullScreen | null>(null);
  const [error, setError] = useState('');

  const refresh = () =>
    api
      .state()
      .then((s) => {
        setState(s);
        setSound(s.settings.sound);
        void setLanguage(s.settings.uiLanguage);
        applyTheme(s.settings.theme);
        return s;
      })
      .catch((e: unknown) => {
        setError(message(e));
        return null;
      });
  const start = async (length: SessionLength, practice = false) => {
    try {
      setFull({ name: 'play', plan: await api.session(length, practice) });
    } catch (e) {
      setError(message(e));
    }
  };
  const go = (r: Route) => {
    setFull(null);
    if (location.hash !== hashFor(r)) location.hash = hashFor(r);
    else setRoute(r);
  };

  useEffect(() => {
    refresh().then((s) => {
      // #start opens straight into a session: zero clicks to begin (bookmark it, or use the desktop shortcut).
      if (s?.decks?.length && isStartHash(location.hash)) {
        history.replaceState(null, '', hashFor('home'));
        start(s.settings.sessionLength);
      }
    });
    const onHash = () => {
      if (isStartHash(location.hash)) {
        history.replaceState(null, '', hashFor('home'));
        setRoute('home');
        start('standard');
        return;
      }
      setRoute(routeFromHash(location.hash));
      setFull(null);
      refresh();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const finish = async (result: SessionResult, plan: SessionPlan) => {
    const server = await api.finish(result).catch(() => null);
    setFull({ name: 'summary', result, server, lang: plan.lang, items: { ...plan.extras, ...plan.items } });
    refresh();
  };

  if (error)
    return (
      <div className="wrap">
        <div className="card feedback wrong" role="alert">
          {error}{' '}
          <button
            className="btn"
            onClick={() => {
              setError('');
              refresh();
            }}
          >
            {t('app.retry')}
          </button>
        </div>
      </div>
    );
  if (!state) return <div className="wrap muted">{t('app.loading')}</div>;
  if (full?.name === 'play')
    return (
      <Session
        plan={full.plan}
        settings={state.settings}
        onFinish={(r) => finish(r, full.plan)}
        onQuit={() => {
          go('home');
          refresh();
        }}
      />
    );
  if (full?.name === 'summary')
    return (
      <Summary
        result={full.result}
        server={full.server}
        lang={full.lang}
        items={full.items}
        onAgain={() => start('mini', full.result.practice)}
        onHome={() => go('home')}
      />
    );

  return (
    <Shell
      route={route}
      kicker={route === 'home' ? formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }) : undefined}
    >
      {route === 'home' && <Home state={state} onStart={start} refresh={refresh} goDecks={() => go('decks')} />}
      {route === 'decks' && (
        <Decks
          state={state}
          refresh={refresh}
          onStudy={() => go('home')}
          onPractice={() => start(state.settings.sessionLength, true)}
          onBrowse={() => go('cards')}
        />
      )}
      {route === 'cards' && <Browse state={state} refresh={refresh} />}
      {route === 'progress' && (
        <div className="col" style={{ gap: 'var(--space-5)' }}>
          <Progress />
          <Badges got={state.achievements} />
          <Stats />
        </div>
      )}
      {route === 'settings' && <Settings state={state} onSaved={refresh} />}
    </Shell>
  );
}
