// First-run welcome (mockup: docs/design/images/Welcome-light.png). Shown once to a brand-new user: pick what
// to learn, then Home with a sample deck, the import, or straight into a 2-minute sample session.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { PICKS, welcomeStep, type Next, type Pick } from './welcome-logic';

export function Welcome({ onDone, onError }: { onDone: (next: Next) => void; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [pick, setPick] = useState<Pick>('language');
  const [busy, setBusy] = useState(false);

  const go = async (action: 'continue' | 'sample' | 'skip') => {
    const step = welcomeStep(action, pick);
    setBusy(true);
    try {
      await api.finishWelcome(step.choice);
      onDone(step.next);
    } catch (e) {
      setBusy(false);
      onError(e);
    }
  };

  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <p className="welcome-brand">{t('app.name')}</p>
      <h1 id="welcome-title" className="welcome-title">
        {t('welcome.title')}
      </h1>
      <p className="welcome-lead">{t('welcome.lead')}</p>
      <fieldset className="welcome-picks" disabled={busy}>
        <legend>{t('welcome.question')}</legend>
        {PICKS.map((p) => (
          <label key={p} className="welcome-pick">
            <input type="radio" name="welcome-pick" value={p} checked={pick === p} onChange={() => setPick(p)} />
            <span>
              <b>{t(`welcome.${p}`)}</b>
              <span className="welcome-hint">{t(`welcome.${p}Hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="welcome-actions">
        <button className="btn primary welcome-continue" disabled={busy} onClick={() => go('continue')}>
          {t('welcome.continue')}
        </button>
        <button className="welcome-link" disabled={busy} onClick={() => go('sample')}>
          {t('welcome.sample')}
        </button>
        <button className="welcome-link welcome-skip" disabled={busy} onClick={() => go('skip')}>
          {t('welcome.skip')}
        </button>
      </div>
    </main>
  );
}
