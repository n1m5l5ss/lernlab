import { useEffect, useRef, useState } from 'react';
import { api } from './api';

type Props = { state: any; refresh: () => Promise<any>; onStudy: () => void; onBrowse: (deckId: number) => void };

export function Decks({ state, refresh, onStudy, onBrowse }: Props) {
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
          Your decks
        </h2>
        <button className="btn" onClick={() => setEditing({ name: '', language: '', newPerDay: 10 })}>
          + New deck
        </button>
        <button className="btn primary" onClick={() => setShowImport((v) => !v)}>
          ⬆ Import
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
              {d.languageName ? `Language · ${d.languageName}` : 'Any subject'}
              {d.settings.goal ? ` · goal: ${d.settings.goal.label}` : ''}
            </div>
            <div className="deckstats">
              <span>
                <b>{d.cards}</b> cards
              </span>
              <span>
                <b>{d.due}</b> due
              </span>
              <span>
                <b>{d.learned}</b> learned
              </span>
            </div>
            <div className="bar green">
              <i style={{ width: `${d.cards ? (d.learned / d.cards) * 100 : 0}%` }} />
            </div>
            <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
              <button className="btn primary" onClick={() => open(d.id, onStudy)}>
                Study
              </button>
              <button className="btn" onClick={() => open(d.id, () => onBrowse(d.id))}>
                Cards
              </button>
              <button
                className="btn ghost"
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
      {!state.decks.length && !showImport && (
        <div className="card muted">No decks yet. Import one or create a new deck.</div>
      )}
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
    if (!confirm(`Delete the deck "${d.name}" with all its cards and progress? This cannot be undone.`)) return;
    await api.deleteDeck(d.id);
    onSaved();
  };
  return (
    <div className="card">
      <b>{d.id ? 'Deck settings' : 'New deck'}</b>
      <label className="lbl">Name</label>
      <input
        className="input"
        value={d.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="e.g. AWS Solutions Architect, Anatomy, German"
      />
      <label className="lbl">Language of the cards' front side</label>
      <select className="input" value={d.language ?? ''} onChange={(e) => set('language', e.target.value)}>
        <option value="">Not a language deck (any subject)</option>
        {Object.entries(languages).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <div className="small muted">Language decks get speaking, pronunciation and sentence-building rounds.</div>
      <div className="row" style={{ gap: 12 }}>
        <div className="grow">
          <label className="lbl">New cards per day</label>
          <input
            className="input"
            type="number"
            value={d.newPerDay ?? 10}
            onChange={(e) => set('newPerDay', e.target.value)}
          />
        </div>
        <div className="grow">
          <label className="lbl">Goal (optional)</label>
          <input
            className="input"
            value={d.goalLabel ?? ''}
            onChange={(e) => set('goalLabel', e.target.value)}
            placeholder="e.g. Goethe B1, AWS SAA exam"
          />
        </div>
        <div style={{ width: 130 }}>
          <label className="lbl">Goal size</label>
          <input
            className="input"
            type="number"
            value={d.goalWords ?? ''}
            onChange={(e) => set('goalWords', e.target.value)}
            placeholder="cards"
          />
        </div>
      </div>
      {err && <div className="feedback wrong">{err}</div>}
      <div className="actions">
        <button className="btn primary" onClick={save} disabled={!d.name?.trim()}>
          Save
        </button>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <span className="grow" />
        {d.id && (
          <a className="btn ghost" href="#" onClick={(e) => exportAs(e, 'lernpack')}>
            Export .lernpack
          </a>
        )}
        {d.id && (
          <a className="btn ghost" href="#" onClick={(e) => exportAs(e, 'csv')}>
            Export CSV
          </a>
        )}
        {d.id && (
          <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function ImportPanel({ state, refresh, onDone }: { state: any; refresh: () => Promise<any>; onDone: () => void }) {
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
    const t = setInterval(async () => {
      const a = await api.ankiInfo();
      setAnki(a);
      if (!a.running) {
        clearInterval(t);
        setBusy(false);
        setMsg(
          a.error
            ? { ok: false, text: a.error }
            : { ok: true, text: `Imported ${a.result?.total ?? 0} cards from Anki.` },
        );
        refresh();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [anki?.running]);

  const report = (r: any) =>
    setMsg({
      ok: true,
      text: `“${r.deck.name}”: ${r.added} new, ${r.updated} updated (${r.total} cards${r.media ? `, ${r.media} media files` : ''}${r.mediaMissing ? `, ${r.mediaMissing} missing media skipped` : ''}).`,
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
          deckName: deckName || 'Pasted cards',
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
        <b className="grow">Import cards</b>
        <button className="btn ghost" onClick={onDone}>
          Close
        </button>
      </div>
      <div className="lengths" style={{ marginTop: 0 }}>
        {(['file', 'paste', 'anki'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'file' ? 'File' : t === 'paste' ? 'Paste text' : 'From Anki'}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="grow">
          <label className="lbl">Deck name (optional)</label>
          <input
            className="input"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Taken from the file if empty"
          />
        </div>
        <div className="grow">
          <label className="lbl">Language (optional)</label>
          <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Not a language / keep from file</option>
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
          <b>Drop a deck file here</b>
          <div className="small muted" style={{ margin: '6px 0 12px' }}>
            .lernpack · Anki .apkg / .colpkg · CSV / TSV / TXT · JSON · .zip (CSV + images/audio)
          </div>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Importing…' : 'Choose file'}
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
            CSV columns: <code>front, back</code> + optional{' '}
            <code>
              example, explanation, notes, category, tags, image, audio, video, alt_answers, type, choices, correct,
              steps
            </code>
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
            placeholder={'term<TAB>definition\nAmazon S3\tObject storage\nMitochondrion\tPowerhouse of the cell'}
          />
          <div className="row small" style={{ gap: 16 }}>
            <span>
              Between term and definition:{' '}
              <select value={fieldSep} onChange={(e) => setFieldSep(e.target.value)}>
                <option value={'\t'}>Tab</option>
                <option value=",">Comma</option>
                <option value=" - ">Dash ( - )</option>
                <option value=":">Colon</option>
                <option value=";">Semicolon</option>
              </select>
            </span>
            <span>
              Between cards:{' '}
              <select value={cardSep} onChange={(e) => setCardSep(e.target.value)}>
                <option value={'\n'}>New line</option>
                <option value=";">Semicolon</option>
                <option value="|">Pipe |</option>
              </select>
            </span>
            <span className="muted">
              {text.trim()
                ? `${text.split(cardSep === '\n' ? /\r?\n/ : cardSep).filter((x) => x.trim()).length} cards`
                : ''}
            </span>
          </div>
          <div>
            <button className="btn primary" onClick={doPaste} disabled={busy || !text.trim()}>
              Import pasted cards
            </button>
          </div>
        </>
      )}
      {tab === 'anki' && (
        <div className="col">
          {!anki ? (
            <div className="muted">Checking Anki…</div>
          ) : !anki.anki ? (
            <div className="muted">
              Anki isn't reachable. Open Anki with the <b>AnkiConnect</b> add-on (code 2055492159), or export a deck
              from Anki as <code>.apkg</code> and drop it in the File tab.
            </div>
          ) : (
            <div className="row">
              <select className="input grow" value={ankiDeck} onChange={(e) => setAnkiDeck(e.target.value)}>
                {(anki.ankiDecks ?? []).map((d: string) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <button className="btn primary" onClick={doAnki} disabled={busy || !ankiDeck}>
                {busy ? 'Importing…' : 'Import deck'}
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
