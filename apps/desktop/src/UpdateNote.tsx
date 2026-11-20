// "Update ready" note on Home. Shown only here, so an update never interrupts a session.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UpdateReady } from './bridge';
import { ReleaseNoteList } from './WhatsNew';

export function UpdateNote() {
  const { t } = useTranslation();
  const updates = typeof window !== 'undefined' ? window.lernlab?.updates : undefined;
  const [ready, setReady] = useState<UpdateReady | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!updates) return;
    updates.status().then(setReady, () => {});
    updates.onReady(setReady);
  }, [updates]);
  if (!ready) return null;
  return (
    <div className="card row update-note" role="status" style={{ borderColor: 'var(--accent)' }}>
      <span className="grow">{t('update.ready', { version: ready.version })}</span>
      {ready.notes && ready.notes.added.length + ready.notes.fixed.length > 0 && (
        <details className="update-notes">
          <summary>{t('update.notes')}</summary>
          <ReleaseNoteList notes={ready.notes} compact />
        </details>
      )}
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          if (!(await updates!.install().catch(() => false))) setBusy(false);
        }}
      >
        {busy ? t('update.restarting') : t('update.restart')}
      </button>
    </div>
  );
}
