import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import i18next, { LANGUAGES, PSEUDO, formatPercent, setLanguage } from './i18n';
import { THEMES } from '@lernlab/ui/tokens';
import { applyTheme } from './theme';

const TIMERS = [
  { key: 'off', blitz: 0, q: 0 },
  { key: 'relaxed', blitz: 20, q: 0 },
  { key: 'normal', blitz: 8, q: 0 },
  { key: 'challenge', blitz: 5, q: 12 },
] as const;
const LENGTHS = [
  { key: 'mini', minutes: 4 },
  { key: 'standard', minutes: 12 },
  { key: 'long', minutes: 20 },
] as const;
const RETENTION = [
  { key: 'relaxed', value: 0.85 },
  { key: 'balanced', value: 0.9 },
  { key: 'intense', value: 0.95 },
] as const;

type AppState = OutputOf<'state.get'>;
type SettingsValue = AppState['settings'];

export function Settings({ state, onSaved }: { state: AppState; onSaved: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState(state.settings);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof SettingsValue>(k: K, v: SettingsValue[K]) => setS({ ...s, [k]: v });
  const save = async (next = s) => {
    await api.saveSettings(next);
    await setLanguage(next.uiLanguage);
    setMsg(i18next.t('common.saved')); // the new language, not the one this render started with
    onSaved();
    setTimeout(() => setMsg(''), 1500);
  };
  const timer = TIMERS.findIndex((x) => x.blitz === s.blitzSeconds && x.q === (s.questionTimer ?? 0));
  return (
    <div className="card">
      <div className="field">
        <label htmlFor="set-lang">
          {t('settings.language')}
          <br />
          <span className="small muted">{t('settings.languageHint')}</span>
        </label>
        <select
          id="set-lang"
          value={s.uiLanguage ?? 'en'}
          onChange={(e) => {
            const next = { ...s, uiLanguage: e.target.value };
            setS(next);
            save(next);
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
          <option value={PSEUDO}>{t('settings.pseudo')}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="set-theme">{t('settings.theme')}</label>
        <select
          id="set-theme"
          value={s.theme ?? 'system'}
          onChange={(e) => {
            const next = { ...s, theme: e.target.value as SettingsValue['theme'] };
            setS(next);
            applyTheme(next.theme);
            save(next);
          }}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {t(`settings.themeOption.${theme}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>{t('settings.dailyGoal')}</span>
        <input
          type="number"
          value={s.dailyGoalSessions}
          onChange={(e) => set('dailyGoalSessions', Number(e.target.value))}
        />
      </div>
      <div className="field">
        <span>{t('settings.sessionLength')}</span>
        <select
          value={s.sessionLength}
          onChange={(e) => set('sessionLength', e.target.value as SettingsValue['sessionLength'])}
        >
          {LENGTHS.map((l) => (
            <option key={l.key} value={l.key}>
              {t(`settings.length.${l.key}`, { minutes: l.minutes })}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>
          {t('settings.timers')}
          <br />
          <span className="small muted">{t('settings.timersHint')}</span>
        </span>
        <div className="lengths" style={{ margin: 0, width: 360 }}>
          {TIMERS.map((x, i) => (
            <button
              key={x.key}
              className={timer === i ? 'on' : ''}
              onClick={() => setS({ ...s, blitzSeconds: x.blitz, questionTimer: x.q })}
            >
              {t(`settings.timer.${x.key}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{t('settings.sound')}</span>
        <input type="checkbox" checked={s.sound} onChange={(e) => set('sound', e.target.checked)} />
      </div>
      <div className="field">
        <span>{t('settings.teacherVoice')}</span>
        <input type="checkbox" checked={s.teacherVoice} onChange={(e) => set('teacherVoice', e.target.checked)} />
      </div>
      <div className="field">
        <label htmlFor="set-updates">
          {t('settings.autoUpdate')}
          <br />
          <span className="small muted">{t('settings.autoUpdateHint')}</span>
        </label>
        <input
          id="set-updates"
          type="checkbox"
          checked={s.autoUpdate !== false}
          onChange={(e) => set('autoUpdate', e.target.checked)}
        />
      </div>
      <div className="field">
        <label htmlFor="set-beta">
          {t('settings.betaUpdates')}
          <br />
          <span className="small muted">{t('settings.betaUpdatesHint')}</span>
        </label>
        <input
          id="set-beta"
          type="checkbox"
          checked={s.betaUpdates === true}
          disabled={s.autoUpdate === false}
          onChange={(e) => set('betaUpdates', e.target.checked)}
        />
      </div>
      <div className="field">
        <span>
          {t('settings.retention')}
          <br />
          <span className="small muted">{t('settings.retentionHint')}</span>
        </span>
        <select value={s.retention} onChange={(e) => set('retention', Number(e.target.value))}>
          {RETENTION.map((r) => (
            <option key={r.key} value={r.value}>
              {t(`settings.retentionLevel.${r.key}`, { percent: formatPercent(r.value) })}
            </option>
          ))}
        </select>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={() => save()}>
          {t('common.save')}
        </button>
        <a
          className="small muted"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            api.downloadSummary().catch((err: Error) => setMsg(err.message));
          }}
        >
          {t('settings.summaryLink')}
        </a>
        {msg && <span className="small">{msg}</span>}
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>
        {t('settings.perDeckNote')}
      </p>
    </div>
  );
}
