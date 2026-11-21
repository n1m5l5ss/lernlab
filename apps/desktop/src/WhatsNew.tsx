// "What's new in X.Y.Z" (issue #58, docs/RELEASING.md): a calm page on the first launch after an update, before
// Home and never during study. The items come from CHANGELOG.md, bundled at build time; it works offline.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReleaseNotes } from '@lernlab/core/whatsnew';
import { api } from './api';
import { CHANGELOG_URL } from './about';

type Items = Pick<ReleaseNotes, 'added' | 'fixed'>;

/** The New and Fixed lists. Also used by the "Update ready" note for the GitHub Release notes. */
export function ReleaseNoteList({ notes, compact = false }: { notes: Items; compact?: boolean }) {
  const { t } = useTranslation();
  const groups = (['added', 'fixed'] as const).filter((g) => notes[g].length > 0);
  return (
    <div className={compact ? 'whats-new-groups compact' : 'whats-new-groups'}>
      {groups.map((g) => (
        <section key={g} className="whats-new-group" aria-labelledby={`whats-new-${g}${compact ? '-c' : ''}`}>
          <h2 id={`whats-new-${g}${compact ? '-c' : ''}`} className={`whats-new-tag ${g}`}>
            {t(g === 'added' ? 'whatsNew.new' : 'whatsNew.fixed')}
          </h2>
          <ul>
            {notes[g].slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function WhatsNew({ notes, onDone }: { notes: ReleaseNotes; onDone: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus(), []);

  const done = async () => {
    setBusy(true);
    // Even if saving fails, never block studying: carry on to Home (it shows again next launch).
    await api.whatsNewSeen().catch(() => null);
    onDone();
  };

  return (
    <main className="welcome whats-new" aria-labelledby="whats-new-title">
      <p className="welcome-brand">{t('app.name')}</p>
      <h1 id="whats-new-title" className="welcome-title" tabIndex={-1} ref={title}>
        {t('whatsNew.title', { version: notes.version })}
      </h1>
      <p className="welcome-lead">{t('whatsNew.lead')}</p>
      <ReleaseNoteList notes={notes} />
      <div className="welcome-actions">
        <button className="btn primary welcome-continue" disabled={busy} onClick={done}>
          {t('whatsNew.continue')}
        </button>
        <a className="welcome-link" href={CHANGELOG_URL} target="_blank" rel="noreferrer">
          {t('whatsNew.fullChangelog')}
        </a>
      </div>
    </main>
  );
}
