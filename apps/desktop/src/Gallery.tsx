// The deck gallery: community decks from the lernlab-decks repo on GitHub. It goes online only while it
// is open (principle 4): it is mounted when the user opens it, and loads the index then.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchGallery, type GalleryDeck } from '@lernlab/core/gallery';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { formatLanguage, formatNumber } from './i18n';
import { isInstalled, licenceUrl, sizeParts, SUBMIT_DECK_URL } from './gallery-logic';

type Props = { decks: { name: string }[]; refresh: () => Promise<unknown>; onClose: () => void };
type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; decks: GalleryDeck[] };
type Installs = Record<
  string,
  { state: 'busy' } | { state: 'done'; added: number } | { state: 'error'; message: string }
>;

export function Gallery({ decks, refresh, onClose }: Props) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [query, setQuery] = useState('');
  const [installs, setInstalls] = useState<Installs>({});

  const open = async () => {
    setLoad({ state: 'loading' });
    try {
      setLoad({ state: 'ready', decks: (await api.gallery()).decks });
    } catch (e) {
      setLoad({ state: 'error', message: (e as Error).message });
    }
  };
  useEffect(() => {
    void open();
  }, []);

  const install = async (d: GalleryDeck) => {
    setInstalls((s) => ({ ...s, [d.id]: { state: 'busy' } }));
    try {
      const r: OutputOf<'gallery.install'> = await api.installFromGallery(d.id);
      setInstalls((s) => ({ ...s, [d.id]: { state: 'done', added: r.added } }));
      await refresh();
    } catch (e) {
      setInstalls((s) => ({ ...s, [d.id]: { state: 'error', message: (e as Error).message } }));
    }
  };

  const shown = useMemo(() => (load.state === 'ready' ? searchGallery(load.decks, query) : []), [load, query]);

  return (
    <section className="panel gallery" aria-labelledby="gallery-title">
      <div className="gallery-head">
        <h2 id="gallery-title">{t('decks.gallery.title')}</h2>
        <a className="btn ghost" href={SUBMIT_DECK_URL} target="_blank" rel="noreferrer">
          {t('decks.gallery.share')}
        </a>
        <button className="btn ghost" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      <p className="small muted">{t('decks.gallery.intro')}</p>
      {load.state === 'loading' && (
        <p className="muted" role="status">
          {t('decks.gallery.loading')}
        </p>
      )}
      {load.state === 'error' && (
        <div className="gallery-offline" role="status">
          <b>{t('decks.gallery.offline')}</b>
          <p className="small muted">{load.message}</p>
          <p className="small muted">{t('decks.gallery.offlineHint')}</p>
          <div>
            <button className="btn" onClick={open}>
              {t('decks.gallery.retry')}
            </button>
          </div>
        </div>
      )}
      {load.state === 'ready' && (
        <>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('decks.gallery.search')}
            aria-label={t('decks.gallery.search')}
          />
          <p className="small muted" role="status">
            {query
              ? t('decks.gallery.found', { count: shown.length })
              : t('decks.gallery.count', { count: shown.length })}
          </p>
          <ul className="gallery-list">
            {shown.map((d) => (
              <GalleryItem
                key={d.id}
                deck={d}
                installed={isInstalled(d.title, decks)}
                status={installs[d.id]}
                onInstall={() => install(d)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function GalleryItem({
  deck: d,
  installed,
  status,
  onInstall,
}: {
  deck: GalleryDeck;
  installed: boolean;
  status: Installs[string] | undefined;
  onInstall: () => void;
}) {
  const { t } = useTranslation();
  const size = sizeParts(d.size);
  const link = licenceUrl(d.licence);
  const facts = [
    d.language ? formatLanguage(d.language) : t('decks.gallery.subject'),
    t('decks.gallery.cards', { count: d.cards, n: formatNumber(d.cards) }),
    t('decks.gallery.by', { author: d.author }),
    formatNumber(size.value, { style: 'unit', unit: size.unit, unitDisplay: 'short' }),
  ];
  const busy = status?.state === 'busy';
  return (
    <li className="gallery-item">
      <div className="gallery-text">
        <h3 lang={d.language ?? undefined}>{d.title}</h3>
        <p className="small muted">{facts.join(' · ')}</p>
        {d.description && <p className="small">{d.description}</p>}
        <p className="small gallery-licence">
          {t('decks.gallery.licence')}{' '}
          {link ? (
            <a href={link} target="_blank" rel="noreferrer">
              {d.licence}
            </a>
          ) : (
            <b>{d.licence}</b>
          )}
        </p>
      </div>
      <div className="gallery-actions">
        <button
          className={`btn ${installed ? 'ghost' : 'primary'}`}
          onClick={onInstall}
          disabled={busy}
          aria-label={t(installed ? 'decks.gallery.updateNamed' : 'decks.gallery.installNamed', {
            name: d.title,
            licence: d.licence,
          })}
        >
          {busy ? t('decks.gallery.installing') : t(installed ? 'decks.gallery.update' : 'decks.gallery.install')}
        </button>
        <div role="status" aria-live="polite" className="small">
          {status?.state === 'done' && (
            <span className="gallery-done">{t('decks.gallery.installed', { count: status.added })}</span>
          )}
          {status?.state === 'error' && <span className="feedback wrong">{status.message}</span>}
          {!status && installed && <span className="muted">{t('decks.gallery.have')}</span>}
        </div>
      </div>
    </li>
  );
}
