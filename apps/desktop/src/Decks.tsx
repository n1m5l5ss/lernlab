import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from './api';

/** CSV column names are file format, not text: they stay in English in every language. */
const CSV_REQUIRED = 'front, back';
const CSV_OPTIONAL =
  'example, explanation, notes, category, tags, image, audio, video, alt_answers, type, choices, correct, steps';

type Props = { state: any; refresh: () => Promise<any>; onStudy: () => void; onBrowse: (deckId: number) => void };

export function Decks({ state, refresh, onStudy, onBrowse }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<any>(null);
  const [showImport, setShowImport] = useState(!state.decks.length);
  const open = async (id: number, then: () => void) => {
    await api.activate(id);
    await refresh();
    then();
  };
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <h2 className="grow" style={{ margin: 0 }}>
          {t('decks.title')}
        </h2>
        <button className="btn" onClick={() => setEditing({ name: '', language: '', newPerDay: 10 })}>
          {t('decks.newDeck')}
        </button>
        <button className="btn primary" onClick={() => setShowImport((v) => !v)}>
          {t('decks.import')}
        </button>
      </div>
      {showImport && <ImportPanel state={state} refresh={refresh} onDone={() => setShowImport(false)} />}
      {editing && (
        <DeckEditor
          deck={editing}
          languages={state.languages}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      <div className="deckgrid">
        {state.decks.map((d: any) => (
          <div key={d.id} className={`card deck ${d.id === state.activeDeck ? 'on' : ''}`}>
            <h3>{d.name}</h3>
            <div className="small muted">
              {d.languageName ? t('decks.languageDeck', { language: d.languageName }) : t('decks.anySubject')}
              {d.settings.goal ? t('decks.goalSuffix', { goal: d.settings.goal.label }) : ''}
            </div>
            <div className="deckstats">
              <span>
                <Trans i18nKey="decks.cards" count={d.cards} components={{ b: <b /> }} />
              </span>
              <span>
                <Trans i18nKey="decks.due" count={d.due} components={{ b: <b /> }} />
              </span>
              <span>
                <Trans i18nKey="decks.learned" count={d.learned} components={{ b: <b /> }} />
              </span>
            </div>
            <div className="bar green">
              <i style={{ width: `${d.cards ? (d.learned / d.cards) * 100 : 0}%` }} />
            </div>
            <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
              <button className="btn primary" onClick={() => open(d.id, onStudy)}>
                {t('decks.study')}
              </button>
              <button className="btn" onClick={() => open(d.id, () => onBrowse(d.id))}>
                {t('decks.browse')}
              </button>
              <button
                className="btn ghost"
                title={t('decks.settingsButton')}
                aria-label={t('decks.settingsButton')}
                onClick={() =>
                  setEditing({
                    ...d,
                    newPerDay: d.settings.newPerDay ?? 10,
                    goalLabel: d.settings.goal?.label ?? '',
                    goalWords: d.settings.goal?.words ?? '',
                  })
                }
              >
                ⚙
              </button>
            </div>
          </div>
        ))}
      </div>
      {!state.decks.length && !showImport && <div className="card muted">{t('decks.empty')}</div>}
    </div>
  );
}

function DeckEditor({
  deck,
  languages,
  onClose,
  onSaved,
}: {
  deck: any;
  languages: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [d, setD] = useState(deck);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setD({ ...d, [k]: v });
  const save = async () => {
    try {
      const goal = d.goalLabel
        ? { ...(deck.settings?.goal ?? {}), label: d.goalLabel, words: Number(d.goalWords) || 0 }
        : undefined;
      if (d.id)
        await api.updateDeck(d.id, {
          name: d.name,
          language: d.language || null,
          description: d.description ?? '',
          settings: { newPerDay: Number(d.newPerDay), goal },
        });
      else await api.createDeck({ name: d.name, language: d.language || null, goal });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const exportAs = (e: React.MouseEvent, format: 'csv' | 'lernpack') => {
    e.preventDefault();
    api.exportDeck(d.id, format).catch((x: Error) => setErr(x.message));
  };
  const remove = async () => {
    if (!confirm(t('decks.editor.confirmDelete', { name: d.name }))) return;
    await api.deleteDeck(d.id);
    onSaved();
  };
  return (
    <div className="card">
      <b>{d.id ? t('decks.editor.settingsTitle') : t('decks.editor.newTitle')}</b>
      <label className="lbl">{t('decks.editor.name')}</label>
      <input
        className="input"
        value={d.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder={t('decks.editor.namePlaceholder')}
      />
      <label className="lbl">{t('decks.editor.frontLanguage')}</label>
      <select className="input" value={d.language ?? ''} onChange={(e) => set('language', e.target.value)}>
        <option value="">{t('decks.editor.notLanguage')}</option>
        {Object.entries(languages).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <div className="small muted">{t('decks.editor.languageHint')}</div>
      <div className="row" style={{ gap: 12 }}>
        <div className="grow">
          <label className="lbl">{t('decks.editor.newPerDay')}</label>
          <input
            className="input"
            type="number"
            value={d.newPerDay ?? 10}
            onChange={(e) => set('newPerDay', e.target.value)}
          />
        </div>
        <div className="grow">
          <label className="lbl">{t('decks.editor.goal')}</label>
          <input
            className="input"
            value={d.goalLabel ?? ''}
            onChange={(e) => set('goalLabel', e.target.value)}
            placeholder={t('decks.editor.goalPlaceholder')}
          />
        </div>
        <div style={{ width: 130 }}>
          <label className="lbl">{t('decks.editor.goalSize')}</label>
          <input
            className="input"
            type="number"
            value={d.goalWords ?? ''}
            onChange={(e) => set('goalWords', e.target.value)}
            placeholder={t('decks.editor.goalSizePlaceholder')}
          />
        </div>
      </div>
      {err && <div className="feedback wrong">{err}</div>}
      <div className="actions">
        <button className="btn primary" onClick={save} disabled={!d.name?.trim()}>
          {t('common.save')}
        </button>
        <button className="btn ghost" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <span className="grow" />
        {d.id && (
          <a className="btn ghost" href="#" onClick={(e) => exportAs(e, 'lernpack')}>
            {t('decks.editor.exportLernpack')}
          </a>
        )}
        {d.id && (
          <a className="btn ghost" href="#" onClick={(e) => exportAs(e, 'csv')}>
            {t('decks.editor.exportCsv')}
          </a>
        )}
        {d.id && (
          <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={remove}>
            {t('common.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

function ImportPanel({ state, refresh, onDone }: { state: any; refresh: () => Promise<any>; onDone: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'file' | 'paste' | 'anki'>('file');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deckName, setDeckName] = useState('');
  const [language, setLanguage] = useState('');
  const [text, setText] = useState('');
  const [fieldSep, setFieldSep] = useState('\t');
  const [cardSep, setCardSep] = useState('\n');
  const [anki, setAnki] = useState<any>(null);
  const [ankiDeck, setAnkiDeck] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'anki')
      api
        .ankiInfo()
        .then((a) => {
          setAnki(a);
          setAnkiDeck((d) => d || a.ankiDecks?.[0] || '');
        })
        .catch(() => setAnki({ anki: false }));
  }, [tab]);
  useEffect(() => {
    if (!anki?.running) return;
    const timer = setInterval(async () => {
      const a = await api.ankiInfo();
      setAnki(a);
      if (!a.running) {
        clearInterval(timer);
        setBusy(false);
        setMsg(
          a.error
            ? { ok: false, text: a.error }
            : { ok: true, text: t('decks.importPanel.ankiDone', { count: a.result?.total ?? 0 }) },
        );
        refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [anki?.running]);

  const report = (r: any) =>
    setMsg({
      ok: true,
      text: [
        t('decks.importPanel.report', { deck: r.deck.name, added: r.added, updated: r.updated, total: r.total }),
        r.media ? t('decks.importPanel.reportMedia', { count: r.media }) : '',
        r.mediaMissing ? t('decks.importPanel.reportMissing', { count: r.mediaMissing }) : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  const doFiles = async (files: FileList | File[]) => {
    setBusy(true);
    setMsg(null);
    try {
      for (const f of Array.from(files))
        report(await api.importFile(f, { deckName: deckName || undefined, language: language || undefined }));
      await refresh();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };
  const doPaste = async () => {
    setBusy(true);
    setMsg(null);
    try {
      report(
        await api.importText({
          text,
          fieldSep,
          cardSep,
          deckName: deckName || t('decks.importPanel.pastedDeckName'),
          language: language || null,
        }),
      );
      setText('');
      await refresh();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };
  const doAnki = async () => {
    setMsg(null);
    try {
      await api.ankiImport({ source: ankiDeck, deckName: deckName || undefined });
      setBusy(true);
      setAnki({ ...anki, running: true });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div className="card col">
      <div className="row">
        <b className="grow">{t('decks.importPanel.title')}</b>
        <button className="btn ghost" onClick={onDone}>
          {t('common.close')}
        </button>
      </div>
      <div className="lengths" style={{ marginTop: 0 }}>
        {(['file', 'paste', 'anki'] as const).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t(`decks.importPanel.tab.${k}`)}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="grow">
          <label className="lbl">{t('decks.importPanel.deckName')}</label>
          <input
            className="input"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder={t('decks.importPanel.deckNamePlaceholder')}
          />
        </div>
        <div className="grow">
          <label className="lbl">{t('decks.importPanel.language')}</label>
          <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">{t('decks.importPanel.languageKeep')}</option>
            {Object.entries(state.languages ?? {}).map(([k, v]) => (
              <option key={k} value={k}>
                {v as string}
              </option>
            ))}
          </select>
        </div>
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
            doFiles(e.dataTransfer.files);
          }}
        >
          <div style={{ fontSize: 34 }}>📦</div>
          <b>{t('decks.importPanel.drop')}</b>
          <div className="small muted" style={{ margin: '6px 0 12px' }}>
            {t('decks.importPanel.formats')}
          </div>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? t('common.importing') : t('decks.importPanel.choose')}
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept=".lernpack,.apkg,.colpkg,.csv,.tsv,.txt,.json,.zip"
            onChange={(e) => e.target.files && doFiles(e.target.files)}
          />
          <div className="small muted" style={{ marginTop: 12 }}>
            <Trans
              i18nKey="decks.importPanel.csvColumns"
              values={{ required: CSV_REQUIRED, optional: CSV_OPTIONAL }}
              components={{ code: <code /> }}
            />
          </div>
        </div>
      )}
      {tab === 'paste' && (
        <>
          <textarea
            className="input"
            style={{ minHeight: 160, fontFamily: 'ui-monospace, monospace' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('decks.importPanel.pastePlaceholder')}
          />
          <div className="row small" style={{ gap: 16 }}>
            <span>
              {t('decks.importPanel.fieldSep')}{' '}
              <select value={fieldSep} onChange={(e) => setFieldSep(e.target.value)}>
                <option value={'\t'}>{t('decks.importPanel.sep.tab')}</option>
                <option value=",">{t('decks.importPanel.sep.comma')}</option>
                <option value=" - ">{t('decks.importPanel.sep.dash')}</option>
                <option value=":">{t('decks.importPanel.sep.colon')}</option>
                <option value=";">{t('decks.importPanel.sep.semicolon')}</option>
              </select>
            </span>
            <span>
              {t('decks.importPanel.cardSep')}{' '}
              <select value={cardSep} onChange={(e) => setCardSep(e.target.value)}>
                <option value={'\n'}>{t('decks.importPanel.sep.newline')}</option>
                <option value=";">{t('decks.importPanel.sep.semicolon')}</option>
                <option value="|">{t('decks.importPanel.sep.pipe')}</option>
              </select>
            </span>
            <span className="muted">
              {text.trim()
                ? t('decks.importPanel.cardCount', {
                    count: text.split(cardSep === '\n' ? /\r?\n/ : cardSep).filter((x) => x.trim()).length,
                  })
                : ''}
            </span>
          </div>
          <div>
            <button className="btn primary" onClick={doPaste} disabled={busy || !text.trim()}>
              {t('decks.importPanel.importPasted')}
            </button>
          </div>
        </>
      )}
      {tab === 'anki' && (
        <div className="col">
          {!anki ? (
            <div className="muted">{t('decks.importPanel.checkingAnki')}</div>
          ) : !anki.anki ? (
            <div className="muted">
              <Trans i18nKey="decks.importPanel.ankiUnreachable" components={{ b: <b />, code: <code /> }} />
            </div>
          ) : (
            <div className="row">
              <select className="input grow" value={ankiDeck} onChange={(e) => setAnkiDeck(e.target.value)}>
                {(anki.ankiDecks ?? []).map((d: string) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <button className="btn primary" onClick={doAnki} disabled={busy || !ankiDeck}>
                {busy ? t('common.importing') : t('decks.importPanel.importDeck')}
              </button>
            </div>
          )}
          {anki?.log?.length > 0 && anki.running && <div className="small muted">{anki.log[anki.log.length - 1]}</div>}
        </div>
      )}
      {msg && <div className={`feedback ${msg.ok ? 'right' : 'wrong'}`}>{msg.text}</div>}
    </div>
  );
}
