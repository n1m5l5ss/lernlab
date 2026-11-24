// Settings: every option in one place, grouped into sections. Each change is saved as soon as it is made.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { isDesktop } from './bridge';
import i18next, { LANGUAGES, PSEUDO, PSEUDO_RTL, formatDate, formatPercent, setLanguage } from './i18n';
import { THEMES } from '@lernlab/ui/tokens';
import { applyTheme } from './theme';
import { TEXT_SIZES, applyDisplay } from './display';
import { LENGTHS } from './lengths';
import { cleanMorningTime, cleanReminderTime } from '@lernlab/core/reminder';
import { ASSISTANT_GUIDE_URL, LIBRARIES, LICENSE_URL, ONLINE_CASES, REPO_URL } from './about';
import { clientConfig } from './assistant-logic';
import { DataControls } from './DataControls';
import { allowRemoteMedia } from './remote-media';
import { Button, Card, Input, SegmentedControl, Select } from './components';
import { PlanFields } from './StudyPlan';
import { LearnersSettings } from './Together';
import { planDraftOf, planPatch, timeOfDay } from './plan-logic';

const TIMERS = [
  { key: 'off', blitz: 0, q: 0 },
  { key: 'relaxed', blitz: 20, q: 0 },
  { key: 'normal', blitz: 8, q: 0 },
  { key: 'challenge', blitz: 5, q: 12 },
] as const;
const RETENTION = [
  { key: 'relaxed', value: 0.85 },
  { key: 'balanced', value: 0.9 },
  { key: 'intense', value: 0.95 },
] as const;

type AppState = OutputOf<'state.get'>;
type SettingsValue = AppState['settings'];
type Info = OutputOf<'app.info'>;

/** One labelled row: the label (with an optional hint) on the left, the control on the right. */
function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field settings-row">
      <label htmlFor={id}>
        {label}
        {hint && <span className="settings-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card as="section" className="settings-section" aria-labelledby={`settings-${id}`}>
      <h2 id={`settings-${id}`}>{title}</h2>
      {children}
    </Card>
  );
}

export function Settings({ state, onSaved }: { state: AppState; onSaved: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState(state.settings);
  const [newPerDay, setNewPerDay] = useState(String(state.settings.newPerDay));
  const [dailyGoal, setDailyGoal] = useState(String(state.settings.dailyGoalSessions));
  const [reminderTime, setReminderTime] = useState(state.settings.reminderTime);
  const [morningTime, setMorningTime] = useState(state.settings.morningTime);
  const [plan, setPlan] = useState(() => planDraftOf(state.settings));
  // The hour you usually study, from your own sessions on this computer (#204).
  const [usualTime, setUsualTime] = useState<string | null>(null);
  const desktop = isDesktop();
  const [msg, setMsg] = useState('');
  // Internet media (#177) turns on only after the warning is accepted; keeping it off is the default button.
  const remoteDialog = useRef<HTMLDialogElement>(null);
  const keepOffButton = useRef<HTMLButtonElement>(null);
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    api.appInfo().then(setInfo, (err: Error) => setMsg(err.message));
    api.suggestPlanTime().then(
      (r) => setUsualTime(r.time),
      () => setUsualTime(null),
    );
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(''), 2500);
    return () => clearTimeout(id);
  }, [msg]);

  const update = async (patch: Partial<SettingsValue>) => {
    const next = { ...s, ...patch };
    setS(next);
    applyTheme(next.theme);
    applyDisplay(next);
    try {
      const saved = await api.saveSettings(next);
      setS(saved);
      allowRemoteMedia(saved.remoteMedia);
      setNewPerDay(String(saved.newPerDay));
      setDailyGoal(String(saved.dailyGoalSessions));
      setReminderTime(saved.reminderTime);
      setMorningTime(saved.morningTime);
      setPlan(planDraftOf(saved));
      await setLanguage(saved.uiLanguage);
      setMsg(i18next.t('common.saved')); // the new language, not the one this render started with
      onSaved();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };
  const backup = async () => {
    try {
      setMsg(t('settings.backupDone', { file: (await api.backupNow()).file }));
    } catch (err) {
      setMsg((err as Error).message);
    }
  };
  const timer = TIMERS.findIndex((x) => x.blitz === s.blitzSeconds && x.q === (s.questionTimer ?? 0));
  type Toggle =
    | 'sound'
    | 'teacherVoice'
    | 'reducedMotion'
    | 'betaUpdates'
    | 'reminder'
    | 'launchAtLogin'
    | 'aiAssistant'
    | 'habitNote'
    | 'confidence'
    | 'calm'
    | 'sleepBridge'
    | 'sayAloud'
    | 'actOut'
    | 'quietMinute';
  const check = (key: Toggle, id: string, disabled = false) => (
    <input
      id={id}
      type="checkbox"
      checked={s[key] === true}
      disabled={disabled}
      onChange={(e) => update({ [key]: e.target.checked })}
    />
  );

  return (
    <div className="settings">
      <div className="settings-status" role="status" aria-live="polite">
        {msg && <span className="toast">{msg}</span>}
      </div>

      <Section id="look" title={t('settings.section.look')}>
        <Select
          id="set-lang"
          label={t('settings.language')}
          hint={t('settings.languageHint')}
          className="field settings-row"
          value={s.uiLanguage ?? 'en'}
          onChange={(e) => update({ uiLanguage: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
          <option value={PSEUDO}>{t('settings.pseudo')}</option>
          <option value={PSEUDO_RTL}>{t('settings.pseudoRtl')}</option>
        </Select>
        <Select
          id="set-theme"
          label={t('settings.theme')}
          className="field settings-row"
          value={s.theme ?? 'system'}
          onChange={(e) => update({ theme: e.target.value as SettingsValue['theme'] })}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {t(`settings.themeOption.${theme}`)}
            </option>
          ))}
        </Select>
        <Select
          id="set-text"
          label={t('settings.textSize')}
          className="field settings-row"
          value={s.textSize}
          onChange={(e) => update({ textSize: e.target.value as SettingsValue['textSize'] })}
        >
          {TEXT_SIZES.map((size) => (
            <option key={size} value={size}>
              {t(`settings.textSizeOption.${size}`)}
            </option>
          ))}
        </Select>
        <Row id="set-motion" label={t('settings.reducedMotion')} hint={t('settings.reducedMotionHint')}>
          {check('reducedMotion', 'set-motion')}
        </Row>
        <Row id="set-sound" label={t('settings.sound')}>
          {check('sound', 'set-sound')}
        </Row>
        <Row id="set-voice" label={t('settings.teacherVoice')}>
          {check('teacherVoice', 'set-voice')}
        </Row>
      </Section>

      <Section id="study" title={t('settings.section.study')}>
        <Select
          id="set-length"
          label={t('settings.sessionLength')}
          className="field settings-row"
          value={s.sessionLength}
          onChange={(e) => update({ sessionLength: e.target.value as SettingsValue['sessionLength'] })}
        >
          {LENGTHS.map((l) => (
            <option key={l.key} value={l.key}>
              {t('home.lengthMinutes', { count: l.minutes })}
            </option>
          ))}
        </Select>
        <Input
          id="set-goal"
          label={t('settings.dailyGoal')}
          className="field settings-row"
          type="number"
          min={1}
          max={5}
          value={dailyGoal}
          onChange={(e) => setDailyGoal(e.target.value)}
          onBlur={() => update({ dailyGoalSessions: Number(dailyGoal) })}
        />
        <Input
          id="set-new"
          label={t('settings.newPerDay')}
          hint={t('settings.newPerDayHint')}
          className="field settings-row"
          type="number"
          min={0}
          max={100}
          value={newPerDay}
          onChange={(e) => setNewPerDay(e.target.value)}
          onBlur={() => update({ newPerDay: Number(newPerDay) })}
        />
        <div className="field settings-row">
          <span id="set-timers">
            {t('settings.timers')}
            <span className="settings-hint">{t('settings.timersHint')}</span>
          </span>
          <SegmentedControl
            className="settings-choice"
            labelledBy="set-timers"
            value={TIMERS[timer]?.key ?? null}
            onChange={(key) => {
              const x = TIMERS.find((y) => y.key === key);
              if (x) update({ blitzSeconds: x.blitz, questionTimer: x.q });
            }}
            options={TIMERS.map((x) => ({ value: x.key, label: t(`settings.timer.${x.key}`) }))}
          />
        </div>
        <Select
          id="set-retention"
          label={t('settings.retention')}
          hint={t('settings.retentionHint')}
          className="field settings-row"
          value={s.retention}
          onChange={(e) => update({ retention: Number(e.target.value) })}
        >
          {RETENTION.map((r) => (
            <option key={r.key} value={r.value}>
              {t(`settings.retentionLevel.${r.key}`, { percent: formatPercent(r.value) })}
            </option>
          ))}
        </Select>
        <Row id="set-confidence" label={t('settings.confidence')} hint={t('settings.confidenceHint')}>
          {check('confidence', 'set-confidence')}
        </Row>
        <Row id="set-say-aloud" label={t('settings.sayAloud')} hint={t('settings.sayAloudHint')}>
          {check('sayAloud', 'set-say-aloud')}
        </Row>
        <Row id="set-act-out" label={t('settings.actOut')} hint={t('settings.actOutHint')}>
          {check('actOut', 'set-act-out')}
        </Row>
        <Row id="set-quiet-minute" label={t('settings.quietMinute')} hint={t('settings.quietMinuteHint')}>
          {check('quietMinute', 'set-quiet-minute')}
        </Row>
        <Row id="set-calm" label={t('settings.calm')} hint={t('settings.calmHint')}>
          {check('calm', 'set-calm')}
        </Row>
        <Row id="set-sleep" label={t('settings.sleepBridge')} hint={t('settings.sleepBridgeHint')}>
          {check('sleepBridge', 'set-sleep')}
        </Row>
      </Section>

      <Section id="plan" title={t('settings.section.plan')}>
        <p className="settings-hint">{t('plan.lead')}</p>
        <PlanFields
          idPrefix="set-plan"
          className="field settings-row"
          draft={plan}
          onChange={setPlan}
          onCommit={(next) => {
            const patch = planPatch(next)!;
            if (
              patch.planAfter !== s.planAfter ||
              patch.planMinutes !== s.planMinutes ||
              patch.planBackup !== s.planBackup
            )
              void update(patch);
          }}
        />
        {usualTime && (
          <div className="settings-block plan-suggest">
            <span>{t('plan.suggest', { time: formatDate(timeOfDay(usualTime), { timeStyle: 'short' }) })}</span>
            {desktop && (s.reminderTime !== usualTime || !s.reminder) && (
              <div className="settings-actions">
                <Button onClick={() => update({ reminder: true, reminderTime: usualTime })}>
                  {t('plan.suggestUse')}
                </Button>
              </div>
            )}
          </div>
        )}
        <Row id="set-habit" label={t('plan.habitSetting')} hint={t('plan.habitSettingHint')}>
          {check('habitNote', 'set-habit')}
        </Row>
      </Section>

      <Section id="reminders" title={t('settings.section.reminders')}>
        {!desktop && <p className="settings-hint">{t('settings.reminders.desktopOnly')}</p>}
        <Row id="set-reminder" label={t('settings.reminders.daily')} hint={t('settings.reminders.dailyHint')}>
          {check('reminder', 'set-reminder', !desktop)}
        </Row>
        <Input
          id="set-reminder-time"
          label={t('settings.reminders.time')}
          className="field settings-row"
          type="time"
          value={reminderTime}
          disabled={!desktop || !s.reminder}
          onChange={(e) => setReminderTime(e.target.value)}
          // The field is empty while half typed; save only a complete time.
          onBlur={() => cleanReminderTime(reminderTime) === reminderTime && update({ reminderTime })}
        />
        {s.sleepBridge && (
          <Input
            id="set-morning-time"
            label={t('settings.reminders.morningTime')}
            className="field settings-row"
            type="time"
            value={morningTime}
            disabled={!desktop || !s.reminder}
            onChange={(e) => setMorningTime(e.target.value)}
            onBlur={() => cleanMorningTime(morningTime) === morningTime && update({ morningTime })}
          />
        )}
        <Row
          id="set-login"
          label={t('settings.reminders.launchAtLogin')}
          hint={t('settings.reminders.launchAtLoginHint')}
        >
          {check('launchAtLogin', 'set-login', !desktop)}
        </Row>
      </Section>

      <Section id="people" title={t('settings.section.people')}>
        <LearnersSettings state={state} onSaved={onSaved} />
      </Section>

      <Section id="data" title={t('settings.section.data')}>
        <div className="settings-block">
          <span className="settings-label">{t('settings.dataFolder')}</span>
          <span className="settings-hint">{t('settings.dataFolderHint')}</span>
          {info && <code className="settings-path">{info.dataDir}</code>}
          {isDesktop() && <span className="settings-hint">{t('settings.dataFolderDesktop')}</span>}
        </div>
        <div className="settings-block">
          <span className="settings-label">{t('settings.backups')}</span>
          {info && <span className="settings-hint">{t('settings.backupsHint', { path: info.backupsDir })}</span>}
          <div className="settings-actions">
            <Button onClick={backup}>{t('settings.backupNow')}</Button>
            <a
              className="small"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                api.downloadSummary().catch((err: Error) => setMsg(err.message));
              }}
            >
              {t('settings.summaryLink')}
            </a>
          </div>
        </div>
        <DataControls say={setMsg} />
      </Section>

      <Section id="assistant" title={t('settings.section.assistant')}>
        <Row id="set-assistant" label={t('settings.assistant.enable')} hint={t('settings.assistant.enableHint')}>
          {check('aiAssistant', 'set-assistant')}
        </Row>
        <p className="settings-hint assistant-privacy">{t('settings.assistant.privacy')}</p>
        {s.aiAssistant && info?.assistant && (
          <div className="settings-block">
            <span className="settings-hint" id="set-assistant-config">
              {t('settings.assistant.connect')}
            </span>
            <pre className="settings-path assistant-config" aria-labelledby="set-assistant-config">
              {clientConfig(info.assistant)}
            </pre>
            <div className="settings-actions">
              <Button
                onClick={() =>
                  navigator.clipboard.writeText(clientConfig(info.assistant!)).then(
                    () => setMsg(t('settings.assistant.copied')),
                    (err: Error) => setMsg(err.message),
                  )
                }
              >
                {t('settings.assistant.copy')}
              </Button>
            </div>
          </div>
        )}
        <a className="small" href={ASSISTANT_GUIDE_URL} target="_blank" rel="noreferrer">
          {t('settings.assistant.guide')}
        </a>
      </Section>

      <Section id="privacy" title={t('settings.section.privacy')}>
        <Row id="set-updates" label={t('settings.autoUpdate')} hint={t('settings.autoUpdateHint')}>
          <input
            id="set-updates"
            type="checkbox"
            checked={s.autoUpdate !== false}
            onChange={(e) => update({ autoUpdate: e.target.checked })}
          />
        </Row>
        <Row id="set-beta" label={t('settings.betaUpdates')} hint={t('settings.betaUpdatesHint')}>
          {check('betaUpdates', 'set-beta', s.autoUpdate === false)}
        </Row>
        <Row id="set-remote-media" label={t('settings.remoteMedia.label')} hint={t('settings.remoteMedia.hint')}>
          <input
            id="set-remote-media"
            type="checkbox"
            checked={s.remoteMedia === true}
            onChange={(e) => {
              if (!e.target.checked) return void update({ remoteMedia: false });
              remoteDialog.current?.showModal();
              keepOffButton.current?.focus();
            }}
          />
        </Row>
        <div className="settings-block">
          <span className="settings-label" id="set-online">
            {t('settings.online.intro')}
          </span>
          <ol className="settings-online" aria-labelledby="set-online">
            {ONLINE_CASES.map((c) => (
              <li key={c}>{t(`settings.online.${c}`)}</li>
            ))}
          </ol>
          <span className="settings-hint">{t('settings.online.outro')}</span>
        </div>
      </Section>

      <dialog ref={remoteDialog} className="panel session-dialog" aria-labelledby="remote-media-title">
        <h2 id="remote-media-title">{t('settings.remoteMedia.warnTitle')}</h2>
        <p className="muted">{t('settings.remoteMedia.warnBody')}</p>
        <div className="session-dialog-actions">
          <button
            className="btn"
            onClick={() => {
              remoteDialog.current?.close();
              void update({ remoteMedia: true });
            }}
          >
            {t('settings.remoteMedia.accept')}
          </button>
          <button ref={keepOffButton} className="btn primary" onClick={() => remoteDialog.current?.close()}>
            {t('settings.remoteMedia.cancel')}
          </button>
        </div>
      </dialog>

      <Section id="about" title={t('settings.section.about')}>
        <div className="settings-block">
          {info && <span className="settings-label">{t('settings.about.version', { version: info.version })}</span>}
          {info && <span>{t('settings.about.licence', { licence: info.licence })}</span>}
          <span>{t('settings.about.createdBy')}</span>
          <div className="settings-actions">
            <a href={LICENSE_URL} target="_blank" rel="noreferrer">
              {t('settings.about.licenceLink')}
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              {t('settings.about.source')}
            </a>
          </div>
        </div>
        <div className="settings-block">
          <span className="settings-label" id="set-libs">
            {t('settings.about.libraries')}
          </span>
          <ul className="settings-libs" aria-labelledby="set-libs">
            {LIBRARIES.map((l) => (
              <li key={l.pkg}>{t('settings.about.library', { name: l.name, licence: l.licence })}</li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
