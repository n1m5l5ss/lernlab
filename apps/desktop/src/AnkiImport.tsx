// "From Anki" in the import panel: finds AnkiConnect on this computer, lists Anki's decks with their card
// counts, and imports the ticked decks with their media. When Anki can't be reached it says how to fix that.
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { formatNumber } from './i18n';
import { coveredByParent, decksToImport, depth, leafName, selectedCards, toggleDeck } from './anki-logic';

type Info = OutputOf<'import.ankiInfo'>;
type Status = OutputOf<'import.status'>;

/** `deckName` renames the deck when exactly one Anki deck is imported. */
export function AnkiImport({ deckName = '', onImported }: { deckName?: string; onImported: () => unknown }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<Status | Info | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      const a = await api.ankiInfo();
      setInfo(a);
      setStatus(a);
    } catch {
      setInfo(null);
    }
    setChecking(false);
  };
  useEffect(() => {
    void check();
  }, []);

  const running = !!status?.running;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const s = await api.importStatus();
      setStatus(s);
      if (!s.running) {
        clearInterval(timer);
        onImported();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const start = async () => {
    setError(null);
    try {
      await api.ankiImport({ sources: decksToImport(selected), deckName: deckName || undefined });
      setStatus({ ...(status ?? info!), running: true, results: [], current: null });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!info) return <div className="muted">{t('decks.ankiImport.checking')}</div>;

  if (info.ankiState !== 'ready')
    return (
      <div className="anki-help" role="status">
        <b>{t(`decks.ankiImport.${info.ankiState === 'not_ankiconnect' ? 'otherApp' : 'notRunning'}`)}</b>
        <ol>
          <li>{t('decks.ankiImport.step1')}</li>
          <li>
            <Trans i18nKey="decks.ankiImport.step2" components={{ b: <b />, code: <code /> }} />
          </li>
          <li>{t('decks.ankiImport.step3')}</li>
        </ol>
        <p className="small muted">
          <Trans i18nKey="decks.ankiImport.apkgHint" components={{ code: <code /> }} />
        </p>
        <div>
          <button className="btn" onClick={check} disabled={checking}>
            {checking ? t('decks.ankiImport.checking') : t('decks.ankiImport.checkAgain')}
          </button>
        </div>
      </div>
    );

  const toImport = decksToImport(selected);
  const cards = selectedCards(info.ankiDecks, selected);
  const current = running ? status?.current : null;
  const results = status?.results ?? [];
  return (
    <div className="col">
      <div className="small muted">{t('decks.ankiImport.connected')}</div>
      {info.ankiDecks.length === 0 ? (
        <div className="muted">{t('decks.ankiImport.noDecks')}</div>
      ) : (
        <ul className="anki-decks" aria-label={t('decks.ankiImport.listLabel')}>
          {info.ankiDecks.map((d) => {
            const covered = coveredByParent(d.name, selected);
            return (
              <li key={d.name} style={{ paddingInlineStart: `calc(var(--space-5) * ${depth(d.name)})` }}>
                <label>
                  <input
                    type="checkbox"
                    checked={covered || selected.has(d.name)}
                    disabled={covered || running}
                    onChange={() => setSelected((s) => toggleDeck(s, d.name))}
                  />
                  <span className="grow" title={d.name}>
                    {leafName(d.name)}
                  </span>
                  {d.cards !== null && (
                    <span className="small muted">
                      {t('decks.ankiImport.cards', { count: d.cards, n: formatNumber(d.cards) })}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="row">
        <button className="btn primary" onClick={start} disabled={running || !toImport.length}>
          {running ? t('common.importing') : t('decks.ankiImport.import', { count: toImport.length })}
        </button>
        {cards !== null && toImport.length > 0 && (
          <span className="small muted">{t('decks.ankiImport.cards', { count: cards, n: formatNumber(cards) })}</span>
        )}
      </div>
      <div role="status" aria-live="polite" className="col">
        {current && (
          <div className="small muted">
            {current.progress.step === 'media'
              ? t('decks.ankiImport.progressMedia', {
                  deck: leafName(current.source),
                  done: formatNumber(current.progress.done),
                  total: formatNumber(current.progress.total),
                })
              : t('decks.ankiImport.progressNotes', {
                  deck: leafName(current.source),
                  n: current.index + 1,
                  count: current.count,
                })}
          </div>
        )}
        {!running &&
          results.map((r) =>
            'report' in r ? (
              <div key={r.source} className="feedback right">
                {t('decks.ankiImport.done', {
                  deck: r.report.deck.name,
                  added: r.report.added,
                  updated: r.report.updated,
                  total: r.report.total,
                })}{' '}
                {r.report.media > 0 && t('decks.importPanel.reportMedia', { count: r.report.media })}{' '}
                {r.report.mediaMissing > 0 && t('decks.ankiImport.missing', { count: r.report.mediaMissing })}
              </div>
            ) : (
              <div key={r.source} className="feedback wrong">
                {t('decks.ankiImport.failed', {
                  deck: leafName(r.source),
                  reason: t(`errors.${r.error.code}`, { ...r.error.params, defaultValue: t('errors.failed') }),
                })}
              </div>
            ),
          )}
      </div>
      {error && <div className="feedback wrong">{error}</div>}
    </div>
  );
}
