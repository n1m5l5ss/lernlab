// Settings → Your data: restore a backup (with a preview), export or import everything as one zip,
// and delete all data after typing a confirmation word. Each step that replaces data backs it up first.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { formatDate } from './i18n';
import { backupKind, confirmed } from './data-logic';

type Backup = OutputOf<'backup.list'>[number];
type Asking = null | 'restore' | 'import' | 'delete';

/** Reload so every screen reads the new data, after the message has been seen. */
const reloadSoon = () => setTimeout(() => window.location.reload(), 1500);

export function DataControls({ say }: { say: (msg: string) => void }) {
  const { t, i18n } = useTranslation();
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [asking, setAsking] = useState<Asking>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const picked = backups?.find((b) => b.file === chosen);
  const word = t('settings.data.deleteWord');

  const run = async (work: () => Promise<string>, reload = true) => {
    setBusy(true);
    try {
      say(await work());
      setAsking(null);
      if (reload) reloadSoon();
    } catch (err) {
      say((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const showBackups = async () => {
    try {
      const list = await api.backups();
      setBackups(list);
      setChosen(list[0]?.file ?? '');
    } catch (err) {
      say((err as Error).message);
    }
  };
  const label = (b: Backup) =>
    t('settings.data.backupOption', {
      date: formatDate(b.date, { dateStyle: 'medium', timeStyle: 'short' }),
      kind: t(`settings.data.kind.${backupKind(b.label)}`),
    });
  const cancel = (
    <button className="btn" onClick={() => setAsking(null)} disabled={busy}>
      {t('common.cancel')}
    </button>
  );

  return (
    <>
      <div className="settings-block">
        <span className="settings-label">{t('settings.data.restore')}</span>
        <span className="settings-hint">{t('settings.data.restoreHint')}</span>
        {!backups ? (
          <div className="settings-actions">
            <button className="btn" onClick={showBackups}>
              {t('settings.data.chooseBackup')}
            </button>
          </div>
        ) : backups.length === 0 ? (
          <span>{t('settings.data.noBackups')}</span>
        ) : (
          <>
            <select
              id="set-backup"
              aria-label={t('settings.data.restore')}
              value={chosen}
              onChange={(e) => {
                setChosen(e.target.value);
                setAsking(null);
              }}
            >
              {backups.map((b) => (
                <option key={b.file} value={b.file}>
                  {label(b)}
                </option>
              ))}
            </select>
            {picked && (
              <p className="data-preview" aria-live="polite">
                {picked.counts
                  ? [
                      t('settings.data.decks', { count: picked.counts.decks }),
                      t('settings.data.cards', { count: picked.counts.cards }),
                      t('settings.data.reviews', { count: picked.counts.reviews }),
                    ].join(' · ')
                  : t('settings.data.unreadable')}
              </p>
            )}
            {asking === 'restore' && picked ? (
              <div className="data-confirm" role="group" aria-labelledby="data-restore-q">
                <p id="data-restore-q">{t('settings.data.restoreConfirm', { backup: label(picked) })}</p>
                <div className="settings-actions">
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await api.restoreBackup(picked.file);
                        return t('settings.data.restored', { file: r.safety });
                      })
                    }
                  >
                    {t('settings.data.restoreNow')}
                  </button>
                  {cancel}
                </div>
              </div>
            ) : (
              <div className="settings-actions">
                <button className="btn" disabled={!picked?.counts} onClick={() => setAsking('restore')}>
                  {t('settings.data.restoreButton')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="settings-block">
        <span className="settings-label">{t('settings.data.everything')}</span>
        <span className="settings-hint">{t('settings.data.everythingHint')}</span>
        <div className="settings-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() => run(async () => (await api.exportAll(), t('settings.data.exported')), false)}
          >
            {t('settings.data.export')}
          </button>
          <button className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
            {t('settings.data.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              setZip(e.target.files?.[0] ?? null);
              setAsking(e.target.files?.[0] ? 'import' : null);
              e.target.value = '';
            }}
          />
        </div>
        {asking === 'import' && zip && (
          <div className="data-confirm" role="group" aria-labelledby="data-import-q">
            <p id="data-import-q">{t('settings.data.importConfirm', { file: zip.name })}</p>
            <div className="settings-actions">
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api.importAll(zip);
                    return t('settings.data.imported', { file: r.safety });
                  })
                }
              >
                {t('settings.data.importNow')}
              </button>
              {cancel}
            </div>
          </div>
        )}
      </div>

      <div className="settings-block">
        <span className="settings-label">{t('settings.data.delete')}</span>
        <span className="settings-hint">{t('settings.data.deleteHint')}</span>
        {asking === 'delete' ? (
          <div className="data-confirm data-danger">
            <label htmlFor="set-delete-word">{t('settings.data.deleteType', { word })}</label>
            <input
              id="set-delete-word"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
            />
            <div className="settings-actions">
              <button
                className="btn danger"
                disabled={busy || !confirmed(typed, word, i18n.language)}
                onClick={() => run(async () => t('settings.data.deleted', { file: (await api.deleteAll()).backup }))}
              >
                {t('settings.data.deleteNow')}
              </button>
              {cancel}
            </div>
          </div>
        ) : (
          <div className="settings-actions">
            <button
              className="btn danger"
              onClick={() => {
                setTyped('');
                setAsking('delete');
              }}
            >
              {t('settings.data.delete')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
