// Decks: a grid of your decks (sub-decks as a tree), with study, settings, export and delete.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { deckTree, type DeckNode } from '@lernlab/core/decktree';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { Gallery } from './Gallery';
import { ImportPanel } from './ImportPanel';
import { onVoicesChanged, systemVoices, tryVoice } from './audio';
import { formatDate, formatLanguage, formatNumber } from './i18n';
import { examSoon } from './plan-logic';
import { examSettings, type ExamSettings } from '@lernlab/core/exam';
import { MAP_TEXT_MAX_LENGTH, parseMaps } from '@lernlab/core/conceptmap';
import type { TFunction } from 'i18next';
import { MAX_RATE, MIN_RATE, clampRate, voicesFor } from './voice-logic';

type AppState = OutputOf<'state.get'>;
type DeckRow = AppState['decks'][number];
type Node = DeckNode<DeckRow & { fresh: number }>;
type Props = {
  state: AppState;
  refresh: () => Promise<unknown>;
  onStudy: () => void;
  onPractice: () => void;
  onBrowse: (deckId: number) => void;
  onExam: (deckId: number) => void;
};
type Form = {
  id?: number;
  name: string;
  language: string;
  newPerDay: string;
  goalLabel: string;
  goalWords: string;
  examDate: string;
  subject: string;
  maps: string;
  voice: string;
  rate: string;
  examQuestions: string;
  examMinutes: string;
  examPassMark: string;
};

/** Under the maps field: how to write a map, or what LernLab read from what is written so far. */
function mapsNote(text: string, t: TFunction): string {
  if (!text.trim()) return t('decks.editor.mapsHint');
  const maps = parseMaps(text);
  if (!maps.length) return t('decks.editor.mapsNone');
  return t('decks.editor.mapsRead', {
    count: maps.length,
    links: maps.reduce((n, m) => n + m.links.length, 0),
  });
}

const formFor = (d?: DeckRow): Form => ({
  voice: d?.settings.voice ?? '',
  rate: String(d?.settings.rate ?? 1),
  id: d?.id,
  name: d?.name ?? '',
  language: d?.language ?? '',
  newPerDay: String(d?.settings.newPerDay ?? 10),
  goalLabel: d?.settings.goal?.label ?? '',
  goalWords: d?.settings.goal?.words ? String(d.settings.goal.words) : '',
  examDate: d?.settings.examDate ?? '',
  subject: d?.settings.subject ?? '',
  maps: d?.settings.maps ?? '',
  ...examForm(examSettings(d?.settings.exam)),
});
const examForm = (e: ExamSettings) => ({
  examQuestions: String(e.questions),
  examMinutes: String(e.minutes),
  examPassMark: String(e.passMark),
});

export function Decks({ state, refresh, onStudy, onPractice, onBrowse, onExam }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Form | null>(null);
  const [showImport, setShowImport] = useState(!state.decks.length);
  // The gallery goes online only once the user opens it (principle 4).
  const [showGallery, setShowGallery] = useState(false);
  const [dropped, setDropped] = useState<File | undefined>();
  const [removing, setRemoving] = useState<DeckRow | null>(null);
  const [notice, setNotice] = useState('');
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  // "New" on a deck card means new cards available today, so the tree adds those up.
  const tree = useMemo(() => deckTree(state.decks.map((d) => ({ ...d, fresh: d.newToday }))), [state.decks]);

  const study = async (node: Node, then: () => void) => {
    if (node.deckIds.length === 1) await api.activate(node.deckIds[0]);
    else await api.chooseSource({ kind: 'decks', deckIds: node.deckIds });
    await refresh();
    then();
  };
  const askDelete = (d: DeckRow) => {
    setEditing(null);
    setRemoving(d);
    confirmDialog.current?.showModal();
    cancelButton.current?.focus(); // keeping the deck is the safe default
  };
  const remove = async () => {
    if (!removing) return;
    confirmDialog.current?.close();
    const r = await api.deleteDeck(removing.id);
    setNotice(t('decks.deleted', { name: removing.name, file: r.backup }));
    setRemoving(null);
    await refresh();
  };

  const card = (node: Node) => {
    const d = node.deck;
    const n = node.totals;
    const subtitle = d?.languageName
      ? t('decks.languageDeck', { language: d.languageName })
      : t('decks.subjectDeck', { count: n.cards });
    const extra = [
      d?.settings.goal?.label,
      d?.settings.examDate && t('decks.examOn', { date: formatDate(`${d.settings.examDate}T12:00:00`) }),
      examSoon(d?.settings.examDate) && t('decks.examSleep'),
    ].filter(Boolean);
    return (
      <section key={node.path} className={`panel deck ${d && d.id === state.activeDeck ? 'on' : ''}`}>
        <div className="deck-head">
          <h2>{node.label}</h2>
          {d && (
            <button
              className="btn ghost deck-more"
              aria-label={t('decks.options', { name: d.name })}
              onClick={() => setEditing(formFor(d))}
            >
              <span aria-hidden="true">···</span>
            </button>
          )}
        </div>
        <p className="deck-sub">{[subtitle, ...extra].join(' · ')}</p>
        <DeckStats due={n.due} fresh={n.fresh} learned={n.learned} cards={n.cards} />
        <div className="meter" aria-hidden="true">
          <i style={{ width: `${n.cards ? (n.learned / n.cards) * 100 : 0}%` }} />
        </div>
        <div className="deck-actions">
          {n.due + n.fresh > 0 ? (
            <button className="btn" onClick={() => study(node, onStudy)}>
              {t('decks.study')}
            </button>
          ) : (
            <button className="btn" onClick={() => study(node, onPractice)}>
              {t('decks.practice')}
            </button>
          )}
          {d && (
            <button className="btn ghost" onClick={() => api.activate(d.id).then(() => onBrowse(d.id))}>
              {t('decks.browse')}
            </button>
          )}
          {d && d.cards > 0 && (
            <button
              className="btn ghost"
              aria-label={t('decks.examNamed', { name: d.name })}
              onClick={() => onExam(d.id)}
            >
              {t('decks.exam')}
            </button>
          )}
        </div>
        {node.children.length > 0 && (
          <SubDecks nodes={node.children} onStudy={(c) => study(c, onStudy)} onEdit={(x) => setEditing(formFor(x))} />
        )}
      </section>
    );
  };

  return (
    <div className="decks">
      <div className="decks-head">
        <button className="btn" onClick={() => setShowGallery((v) => !v)} aria-expanded={showGallery}>
          {t('decks.gallery.open')}
        </button>
        <button className="btn" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>
          {t('decks.import')}
        </button>
        <button className="btn primary" onClick={() => setEditing(formFor())}>
          {t('decks.newDeck')}
        </button>
      </div>
      {notice && (
        <p className="panel decks-notice" role="status">
          {notice}
        </p>
      )}
      {showGallery && <Gallery decks={state.decks} refresh={refresh} onClose={() => setShowGallery(false)} />}
      {showImport && (
        <ImportPanel
          state={state}
          refresh={refresh}
          initialFile={dropped}
          onDone={() => {
            setShowImport(false);
            setDropped(undefined);
          }}
        />
      )}
      {editing && (
        <DeckEditor
          form={editing}
          languages={state.languages}
          onClose={() => setEditing(null)}
          onDelete={() => {
            const d = state.decks.find((x) => x.id === editing.id);
            if (d) askDelete(d);
          }}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      <div className="deckgrid">
        {tree.map(card)}
        {!showImport && (
          <div
            className="deck-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDropped(e.dataTransfer.files[0]);
              setShowImport(true);
            }}
          >
            <button className="deck-drop-open" onClick={() => setShowImport(true)}>
              <b>{t('decks.importPanel.drop')}</b>
              <span>{t('decks.dropFormats')}</span>
            </button>
            <button className="deck-drop-template" onClick={api.downloadTemplate}>
              {t('decks.csvTemplate')}
            </button>
          </div>
        )}
      </div>
      <dialog
        ref={confirmDialog}
        className="panel session-dialog"
        aria-labelledby="delete-title"
        onClose={() => setRemoving(null)}
      >
        <h2 id="delete-title">{t('decks.deleteTitle', { name: removing?.name ?? '' })}</h2>
        <p className="muted">{t('decks.deleteBody', { count: removing?.cards ?? 0 })}</p>
        <div className="session-dialog-actions">
          <button className="btn danger" onClick={remove}>
            {t('common.delete')}
          </button>
          <button ref={cancelButton} className="btn primary" onClick={() => confirmDialog.current?.close()}>
            {t('decks.keep')}
          </button>
        </div>
      </dialog>
    </div>
  );
}

function DeckStats({ due, fresh, learned, cards }: { due: number; fresh: number; learned: number; cards: number }) {
  return (
    <p className="deckstats">
      <span>
        <Trans i18nKey="decks.due" values={{ count: formatNumber(due) }} components={{ b: <b /> }} />
      </span>
      <span>
        <Trans i18nKey="decks.new" values={{ count: formatNumber(fresh) }} components={{ b: <b /> }} />
      </span>
      <span>
        <Trans
          i18nKey="decks.known"
          values={{ count: formatNumber(learned), total: formatNumber(cards) }}
          components={{ b: <b /> }}
        />
      </span>
    </p>
  );
}

/** Sub-decks inside their parent's card, one row each, nested as deep as the path goes. */
function SubDecks({
  nodes,
  onStudy,
  onEdit,
}: {
  nodes: Node[];
  onStudy: (n: Node) => void;
  onEdit: (d: DeckRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="deck-children">
      {nodes.map((c) => (
        <li key={c.path}>
          <div className="deck-child">
            <span className="grow">
              <b>{c.label}</b>
              <span className="muted"> · {t('decks.childCounts', { due: c.totals.due, fresh: c.totals.fresh })}</span>
            </span>
            {c.totals.due + c.totals.fresh > 0 && (
              <button
                className="btn ghost"
                onClick={() => onStudy(c)}
                aria-label={t('decks.studyNamed', { name: c.path })}
              >
                {t('decks.study')}
              </button>
            )}
            {c.deck && (
              <button
                className="btn ghost deck-more"
                aria-label={t('decks.options', { name: c.path })}
                onClick={() => onEdit(c.deck!)}
              >
                <span aria-hidden="true">···</span>
              </button>
            )}
          </div>
          {c.children.length > 0 && <SubDecks nodes={c.children} onStudy={onStudy} onEdit={onEdit} />}
        </li>
      ))}
    </ul>
  );
}

function DeckEditor({
  form,
  languages,
  onClose,
  onDelete,
  onSaved,
}: {
  form: Form;
  languages: Record<string, string>;
  onClose: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState(form);
  const [err, setErr] = useState('');
  const set = (k: keyof Form, v: string) => setF({ ...f, [k]: v });
  const save = async () => {
    const settings = {
      newPerDay: Number(f.newPerDay),
      goal: f.goalLabel.trim() ? { label: f.goalLabel, words: Number(f.goalWords) || 0 } : null,
      examDate: f.examDate,
      subject: f.subject,
      maps: f.maps,
      voice: f.voice,
      rate: Number(f.rate),
      exam: { questions: f.examQuestions, minutes: f.examMinutes, passMark: f.examPassMark },
    };
    try {
      if (f.id) await api.updateDeck(f.id, { name: f.name, language: f.language || null, settings });
      else await api.createDeck({ name: f.name, language: f.language || null, settings });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const exportAs = (format: 'csv' | 'lernpack' | 'apkg') =>
    f.id && api.exportDeck(f.id, format).catch((x: Error) => setErr(x.message));
  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="deck-field">
      <span>{label}</span>
      <input className="input" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  );
  return (
    <section className="panel deck-editor" aria-labelledby="deck-editor-title">
      <h2 id="deck-editor-title">{f.id ? t('decks.editor.settingsTitle') : t('decks.editor.newTitle')}</h2>
      {field('name', t('decks.editor.name'), { placeholder: t('decks.editor.namePlaceholder'), autoFocus: true })}
      <p className="small muted">{t('decks.editor.subdeckHint')}</p>
      <label className="deck-field">
        <span>{t('decks.editor.frontLanguage')}</span>
        <select className="input" value={f.language} onChange={(e) => set('language', e.target.value)}>
          <option value="">{t('decks.editor.notLanguage')}</option>
          {Object.entries(languages).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">{t('decks.editor.languageHint')}</p>
      <div className="deck-editor-row">
        {field('newPerDay', t('decks.editor.newPerDay'), { type: 'number', min: 0, max: 999 })}
        {field('goalLabel', t('decks.editor.goal'), { placeholder: t('decks.editor.goalPlaceholder') })}
        {field('goalWords', t('decks.editor.goalSize'), {
          type: 'number',
          min: 0,
          placeholder: t('decks.editor.goalSizePlaceholder'),
        })}
        {field('examDate', t('decks.editor.examDate'), { type: 'date' })}
      </div>
      <label className="deck-field">
        <span>{t('decks.editor.subject')}</span>
        <select
          className="input"
          value={f.subject}
          aria-describedby="deck-subject-hint"
          onChange={(e) => set('subject', e.target.value)}
        >
          <option value="">{t('decks.editor.subjectOther')}</option>
          <option value="maths">{t('decks.editor.subjectMaths')}</option>
          <option value="science">{t('decks.editor.subjectScience')}</option>
        </select>
      </label>
      <p id="deck-subject-hint" className="small muted">
        {t('decks.editor.subjectHint')}
      </p>
      <label className="deck-field" htmlFor="deck-maps">
        <span>{t('decks.editor.maps')}</span>
      </label>
      <textarea
        id="deck-maps"
        className="input deck-maps"
        rows={5}
        spellCheck={false}
        maxLength={MAP_TEXT_MAX_LENGTH}
        value={f.maps}
        aria-describedby="deck-maps-hint"
        placeholder={t('decks.editor.mapsPlaceholder')}
        onChange={(e) => set('maps', e.target.value)}
      />
      <p id="deck-maps-hint" className="small muted">
        {mapsNote(f.maps, t)}
      </p>
      <fieldset className="deck-voice">
        <legend>{t('decks.editor.examTitle')}</legend>
        <p className="small muted">{t('decks.editor.examHint')}</p>
        <div className="deck-editor-row">
          {field('examQuestions', t('decks.editor.examQuestions'), { type: 'number', min: 1, max: 200 })}
          {field('examMinutes', t('decks.editor.examMinutes'), { type: 'number', min: 1, max: 300 })}
          {field('examPassMark', t('decks.editor.examPassMark'), { type: 'number', min: 1, max: 100 })}
        </div>
      </fieldset>
      <VoicePicker
        language={f.language}
        voice={f.voice}
        rate={f.rate}
        onChange={(k, v) => setF((cur) => ({ ...cur, [k]: v }))}
      />

      {err && (
        <p role="alert" className="feedback wrong">
          {err}
        </p>
      )}
      <div className="deck-editor-actions">
        <button className="btn primary" onClick={save} disabled={!f.name.trim()}>
          {t('common.save')}
        </button>
        <button className="btn ghost" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <span className="grow" />
        {f.id && (
          <>
            <button className="btn ghost" onClick={() => exportAs('lernpack')}>
              {t('decks.editor.exportLernpack')}
            </button>
            <button className="btn ghost" onClick={() => exportAs('csv')}>
              {t('decks.editor.exportCsv')}
            </button>
            <button className="btn ghost" onClick={() => exportAs('apkg')}>
              {t('decks.editor.exportAnki')}
            </button>
            <button className="btn danger" onClick={onDelete}>
              {t('common.delete')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** The installed system voices; the list fills in a moment after start and changes when voices are added. */
function useSystemVoices() {
  const [voices, setVoices] = useState(systemVoices);
  useEffect(() => onVoicesChanged(() => setVoices(systemVoices())), []);
  return voices;
}

/** Reading aloud: a voice that speaks the deck's language, a speed and a "Try it" button. */
function VoicePicker({
  language,
  voice,
  rate,
  onChange,
}: {
  language: string;
  voice: string;
  rate: string;
  onChange: (k: 'voice' | 'rate', v: string) => void;
}) {
  const { t } = useTranslation();
  const voices = voicesFor(language, useSystemVoices());
  const name = language ? formatLanguage(language) : '';
  const speed = clampRate(rate);
  return (
    <fieldset className="deck-voice">
      <legend>{t('decks.editor.voiceTitle')}</legend>
      {!language ? (
        <p className="small muted">{t('decks.editor.voiceNeedsLanguage')}</p>
      ) : !voices.length ? (
        <p className="small deck-voice-missing" role="status">
          {t('decks.editor.noVoice', { language: name })}
        </p>
      ) : (
        <>
          <p className="small muted">{t('decks.editor.voiceHint')}</p>
          <div className="deck-voice-row">
            <label className="deck-field">
              <span>{t('decks.editor.voice')}</span>
              <select
                className="input"
                value={voices.some((v) => v.voiceURI === voice) ? voice : ''}
                onChange={(e) => onChange('voice', e.target.value)}
              >
                <option value="">{t('decks.editor.voiceAuto', { language: name })}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
            </label>
            <label className="deck-field">
              <span>
                {t('decks.editor.speed')}{' '}
                <output className="muted">
                  {t('decks.editor.speedValue', { rate: formatNumber(speed, { maximumFractionDigits: 2 }) })}
                </output>
              </span>
              <input
                type="range"
                min={MIN_RATE}
                max={MAX_RATE}
                step={0.05}
                value={speed}
                onChange={(e) => onChange('rate', e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => tryVoice(formatLanguage(language, language), language, voice, speed)}
            >
              {t('decks.editor.tryVoice')}
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
