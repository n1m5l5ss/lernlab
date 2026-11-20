// Import: drop a file or paste text, see the first cards and how the columns are read, choose the
// deck, then import and get a report. Nothing is saved until the Import button is pressed.
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { ColumnMapping, ImportPreview, MappableField } from '@lernlab/core/importpreview';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { AnkiImport } from './AnkiImport';
import { formatNumber } from './i18n';
import { rovingIndex } from './keys-logic';
import type { ImportReport as Report } from '@lernlab/core/importer';
import { MAPPABLE, defaultTarget, fieldOf, reportLines, setColumn } from './import-logic';

/** CSV column names are file format, not text: they stay in English in every language. */
const CSV_REQUIRED = 'front, back';
const CSV_OPTIONAL =
  'example, explanation, notes, category, tags, image, image_alt, audio, video, alt_answers, type, choices, correct, steps';

type AppState = OutputOf<'state.get'>;
type Source = { file: File } | { text: string };
const TABS = ['file', 'paste', 'anki'] as const;

export function ImportPanel({
  state,
  refresh,
  onDone,
  initialFile,
}: {
  state: AppState;
  refresh: () => Promise<unknown>;
  onDone: () => void;
  /** A file dropped on the Decks screen's drop tile: previewed straight away. */
  initialFile?: File;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<(typeof TABS)[number]>('file');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [text, setText] = useState('');
  const [fieldSep, setFieldSep] = useState('\t');
  const [cardSep, setCardSep] = useState('\n');
  const [mapping, setMapping] = useState<ColumnMapping | undefined>();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [target, setTarget] = useState<number | 'new'>('new');
  const [deckName, setDeckName] = useState('');
  const [language, setLanguage] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const source: Source | null = tab === 'file' && file ? { file } : tab === 'paste' && text.trim() ? { text } : null;

  // Preview whenever the source, the separators or the column mapping change (pasted text waits a moment).
  useEffect(() => {
    if (!source) {
      setPreview(null);
      return;
    }
    let live = true;
    const timer = setTimeout(
      () =>
        api
          .previewImport({ ...source, fieldSep, cardSep, mapping })
          .then((p) => {
            if (!live) return;
            setPreview(p);
            setError('');
          })
          .catch((e: Error) => live && (setPreview(null), setError(e.message))),
      'text' in source ? 300 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [file, text, tab, fieldSep, cardSep, mapping]);

  // A new source suggests its own deck: an existing deck with that name, else a new one.
  const suggested = preview?.deckName || (tab === 'paste' ? t('decks.importPanel.pastedDeckName') : '');
  useEffect(() => {
    setTarget(defaultTarget(state.decks, suggested));
    setDeckName(suggested);
  }, [suggested, file]);

  const choose = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setMapping(undefined);
    setReport(null);
    setError('');
  };
  const reset = () => {
    setFile(null);
    setText('');
    setMapping(undefined);
    setPreview(null);
    setReport(null);
  };
  const deck = target === 'new' ? { deckName: deckName.trim() || suggested } : { deckId: target };

  const doImport = async () => {
    if (!source || !preview) return;
    setBusy(true);
    setError('');
    try {
      const result =
        'file' in source
          ? await api.importFile(source.file, { ...deck, language: language || undefined, mapping })
          : await api.importText({ text: source.text, fieldSep, cardSep, ...deck, language: language || null });
      setReport(result);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className="card col import" aria-labelledby="import-title">
      <div className="row">
        <h2 id="import-title" className="grow import-title">
          {t('decks.importPanel.title')}
        </h2>
        <button className="btn ghost" onClick={onDone}>
          {t('common.close')}
        </button>
      </div>
      {report ? (
        <ImportReport result={report} onAgain={reset} onDone={onDone} />
      ) : (
        <>
          <div
            className="lengths import-tabs"
            role="tablist"
            aria-labelledby="import-title"
            onKeyDown={(e) => {
              const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
              const i = rovingIndex(TABS.indexOf(tab), TABS.length, e.key, rtl);
              if (i === null) return;
              e.preventDefault();
              setTab(TABS[i]);
              (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
            }}
          >
            {TABS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                tabIndex={tab === k ? 0 : -1}
                className={tab === k ? 'on' : ''}
                onClick={() => setTab(k)}
              >
                {t(`decks.importPanel.tab.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'file' && (
            <div
              className={`drop-zone ${over ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                choose(e.dataTransfer.files);
              }}
            >
              <b>{file ? file.name : t('decks.importPanel.drop')}</b>
              <div className="small muted import-formats">{t('decks.importPanel.formats')}</div>
              <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
                {file ? t('decks.importPanel.chooseOther') : t('decks.importPanel.choose')}
              </button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".lernpack,.apkg,.colpkg,.csv,.tsv,.txt,.json,.zip"
                onChange={(e) => {
                  choose(e.target.files);
                  e.target.value = '';
                }}
              />
              <div className="small muted import-formats">
                <Trans
                  i18nKey="decks.importPanel.csvColumns"
                  values={{ required: CSV_REQUIRED, optional: CSV_OPTIONAL }}
                  components={{ code: <code /> }}
                />
              </div>
              <button className="deck-drop-template" onClick={api.downloadTemplate}>
                {t('decks.csvTemplate')}
              </button>
            </div>
          )}
          {tab === 'paste' && (
            <>
              <label className="lbl" htmlFor="import-paste">
                {t('decks.importPanel.pasteLabel')}
              </label>
              <textarea
                id="import-paste"
                className="input import-paste"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('decks.importPanel.pastePlaceholder')}
              />
              <div className="row small import-seps">
                <label>
                  {t('decks.importPanel.fieldSep')}{' '}
                  <select value={fieldSep} onChange={(e) => setFieldSep(e.target.value)}>
                    <option value={'\t'}>{t('decks.importPanel.sep.tab')}</option>
                    <option value=",">{t('decks.importPanel.sep.comma')}</option>
                    <option value=" - ">{t('decks.importPanel.sep.dash')}</option>
                    <option value=":">{t('decks.importPanel.sep.colon')}</option>
                    <option value=";">{t('decks.importPanel.sep.semicolon')}</option>
                  </select>
                </label>
                <label>
                  {t('decks.importPanel.cardSep')}{' '}
                  <select value={cardSep} onChange={(e) => setCardSep(e.target.value)}>
                    <option value={'\n'}>{t('decks.importPanel.sep.newline')}</option>
                    <option value=";">{t('decks.importPanel.sep.semicolon')}</option>
                    <option value="|">{t('decks.importPanel.sep.pipe')}</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {tab === 'anki' && <AnkiImport onImported={refresh} />}
          {tab !== 'anki' && preview && (
            <>
              <p className="import-found" role="status">
                {t('decks.importPanel.found', { count: preview.total })}
                {preview.skipped.map((s) => (
                  <span key={s.reason}> {t(`decks.importReport.willSkip.${s.reason}`, { count: s.count })}</span>
                ))}
              </p>
              {preview.table && (
                <ColumnMapper
                  table={preview.table}
                  onChange={(m) => setMapping(m)}
                  open={!preview.table.header || !!mapping}
                />
              )}
              <PreviewTable cards={preview.cards} />
              <fieldset className="import-target">
                <legend>{t('decks.importPanel.target')}</legend>
                <div className="row import-target-row">
                  <select
                    className="input grow"
                    aria-label={t('decks.importPanel.target')}
                    value={String(target)}
                    onChange={(e) => setTarget(e.target.value === 'new' ? 'new' : Number(e.target.value))}
                  >
                    <option value="new">{t('decks.importPanel.newDeck')}</option>
                    {state.decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {target === 'new' && (
                    <input
                      className="input grow"
                      aria-label={t('decks.importPanel.deckName')}
                      value={deckName}
                      onChange={(e) => setDeckName(e.target.value)}
                      placeholder={t('decks.importPanel.deckNamePlaceholder')}
                    />
                  )}
                  {target === 'new' && (
                    <select
                      className="input grow"
                      aria-label={t('decks.importPanel.language')}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="">{t('decks.importPanel.languageKeep')}</option>
                      {Object.entries(state.languages ?? {}).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </fieldset>
              <div>
                <button className="btn primary" onClick={doImport} disabled={busy || !preview.total}>
                  {busy ? t('common.importing') : t('decks.importPanel.importCount', { count: preview.total })}
                </button>
              </div>
            </>
          )}
          {error && (
            <div className="feedback wrong" role="alert">
              {error}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Which column feeds which card field; shown open when the file's headers are not recognised. */
function ColumnMapper({
  table,
  onChange,
  open,
}: {
  table: NonNullable<ImportPreview['table']>;
  onChange: (m: ColumnMapping) => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(open);
  useEffect(() => setShow((s) => s || open), [open]);
  const set = (fields: ColumnMapping['fields'], header = table.header) => onChange({ header, fields });
  if (!show)
    return (
      <div>
        <button className="btn ghost" onClick={() => setShow(true)}>
          {t('decks.importPanel.changeColumns')}
        </button>
      </div>
    );
  return (
    <fieldset className="import-columns">
      <legend>{t('decks.importPanel.columns')}</legend>
      {!table.header && <p className="small muted">{t('decks.importPanel.columnsHint')}</p>}
      <label className="small">
        <input type="checkbox" checked={table.header} onChange={(e) => set(table.fields, e.target.checked)} />{' '}
        {t('decks.importPanel.firstRowHeader')}
      </label>
      <div className="import-column-grid">
        {table.columns.map((c, i) => (
          <label key={i} className="import-column">
            <span className="lbl">{c.name || t('decks.importPanel.columnN', { n: formatNumber(i + 1) })}</span>
            <span className="small muted import-sample">{c.sample || '—'}</span>
            <select
              className="input"
              value={fieldOf(table.fields, i)}
              onChange={(e) => set(setColumn(table.fields, i, e.target.value as MappableField | ''))}
            >
              <option value="">{t('decks.importPanel.ignore')}</option>
              {MAPPABLE.map((f) => (
                <option key={f} value={f}>
                  {t(`decks.importPanel.field.${f}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PreviewTable({ cards }: { cards: ImportPreview['cards'] }) {
  const { t } = useTranslation();
  if (!cards.length) return null;
  const withExample = cards.some((c) => c.example);
  return (
    <div className="table-wrap import-preview">
      <table className="t">
        <caption className="small muted">{t('decks.importPanel.previewCaption', { count: cards.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('decks.importPanel.field.front')}</th>
            <th scope="col">{t('decks.importPanel.field.back')}</th>
            {withExample && <th scope="col">{t('decks.importPanel.field.example')}</th>}
          </tr>
        </thead>
        <tbody>
          {cards.map((c, i) => (
            <tr key={i}>
              <td>{c.front}</td>
              <td>{c.back}</td>
              {withExample && <td>{c.example}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What an import did: cards added and updated, and what was skipped and why. */
export function ImportReport({ result, onAgain, onDone }: { result: Report; onAgain: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const r = reportLines(result);
  return (
    <div className="import-report" role="status">
      <h3>{t('decks.importReport.title', { deck: result.deck.name })}</h3>
      <ul className="import-report-list">
        <li>{t('decks.importReport.added', { count: r.added })}</li>
        <li>{t('decks.importReport.updated', { count: r.updated })}</li>
        {r.skipped.map((s) => (
          <li key={s.code}>
            {t('decks.importReport.skipped', { count: s.count })}{' '}
            <span className="muted">{t(`decks.importReport.reason.${s.code}`)}</span>
            {s.code === 'missing_media' && r.missingMedia.length > 0 && (
              <span className="small muted"> {r.missingMedia.join(', ')}</span>
            )}
          </li>
        ))}
        {r.moreSkipped > 0 && (
          <li className="muted">{t('decks.importReport.moreSkipped', { count: r.moreSkipped })}</li>
        )}
        {result.media > 0 && <li>{t('decks.importPanel.reportMedia', { count: result.media })}</li>}
        {r.warnings.map((w, i) => (
          <li key={i} className="muted">
            {t(`errors.${w.code}`, { file: w.file ?? '' })}
          </li>
        ))}
      </ul>
      <p className="small muted">{t('decks.importReport.total', { count: r.total })}</p>
      <div className="row">
        <button className="btn" onClick={onAgain}>
          {t('decks.importReport.again')}
        </button>
        <button className="btn primary" onClick={onDone}>
          {t('decks.importReport.done')}
        </button>
      </div>
    </div>
  );
}
