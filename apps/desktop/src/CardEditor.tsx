// Card editor: four card types, a live preview drawn like the real exercise, media by drag and drop,
// and a gentle warning when the deck already has a card with the same front.
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SAFE_TAGS } from '@lernlab/core/cards';
import type { Duplicate } from '@lernlab/core/browse';
import { api } from './api';
import { mediaUrl } from './bridge';
import {
  CARD_TYPES,
  EMPTY,
  fieldsToSave,
  previewOf,
  showImageAlt,
  sortDrop,
  type Form,
  type MediaSlot,
  type Preview,
} from './card-editor-logic';
import { Media, Rich } from './rich';

/** Cloze gap markers are card syntax, not text. */
const CLOZE = { open: '{{c1::', close: '}}' };
const SLOTS: MediaSlot[] = ['image', 'audio', 'video'];
const ACCEPT: Record<MediaSlot, string> = { image: 'image/*', audio: 'audio/*', video: 'video/*' };
type Deck = { id: number; language: string | null };
/** Open the optional fields when the card already uses one. */
const hasMore = (f: Form) =>
  !!(f.alt || f.explanation || f.example || f.exampleTranslation || f.notes || f.category || f.tags);

export function CardEditor({
  card,
  deckId,
  decks,
  onClose,
  onSaved,
  onDelete,
}: {
  card: Form;
  deckId: number;
  decks: Deck[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const uid = useId();
  const [c, setC] = useState(card);
  const [msg, setMsg] = useState('');
  const [dups, setDups] = useState<Duplicate[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const confirm = useRef<HTMLDialogElement>(null);
  const frontField = useRef<HTMLTextAreaElement>(null);
  const deck = useMemo<Deck>(() => {
    const id = card.item?.deckId ?? deckId;
    return { id, language: card.item?.lang ?? decks.find((d) => d.id === id)?.language ?? null };
  }, [card.item, deckId, decks]);
  const preview = useMemo(() => previewOf(c, deck), [c, deck]);

  // Look for a card with the same front while typing; it only warns, saving stays possible.
  useEffect(() => {
    if (!c.front.trim()) {
      setDups([]);
      return;
    }
    let live = true;
    const timer = setTimeout(
      () =>
        api.findDuplicates(deck.id, c.front, c.id).then(
          (r) => live && setDups(r.matches),
          () => {},
        ),
      250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [c.front, c.id, deck.id]);

  const set = <K extends keyof Form>(k: K, value: Form[K]) => {
    setMsg('');
    setC((prev) => ({ ...prev, [k]: value }));
  };
  const fail = (e: unknown) => setMsg(e instanceof Error ? e.message : String(e));
  const upload = async (k: MediaSlot, f?: File) => {
    if (!f) return;
    setUploading((n) => n + 1);
    try {
      const r = await api.uploadMedia(f);
      set(k, r.file);
    } catch (e) {
      fail(e);
    } finally {
      setUploading((n) => n - 1);
    }
  };
  const drop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    const { slots, rejected } = sortDrop(files);
    await Promise.all(SLOTS.map((k) => slots[k] !== undefined && upload(k, files[slots[k]!])));
    if (rejected.length) setMsg(t('browse.editor.dropRejected', { names: rejected.join(', ') }));
  };
  const save = async () => {
    if (!c.front.trim() || uploading) return;
    try {
      if (c.id) await api.saveCard(c.id, fieldsToSave(c));
      else await api.addCard(deck.id, fieldsToSave(c));
      onSaved();
      if (!c.id) {
        setC({ ...EMPTY, type: c.type, tags: c.tags, category: c.category });
        frontField.current?.focus();
      }
      setMsg(t('common.saved'));
    } catch (e) {
      fail(e);
    }
  };
  const toggle = async (k: 'suspended' | 'starred') => {
    if (!c.id) return;
    await api.saveCard(c.id, { [k]: !c[k] });
    set(k, !c[k]);
    onSaved();
  };
  type TextKey = Exclude<keyof typeof EMPTY, 'type'>;
  const f = (k: TextKey, label: string, ph = '', area = false) => (
    <>
      <label className="lbl" htmlFor={`${uid}-${k}`}>
        {label}
      </label>
      {area ? (
        <textarea
          id={`${uid}-${k}`}
          ref={k === 'front' ? frontField : undefined}
          className="input"
          value={c[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder={ph}
        />
      ) : (
        <input
          id={`${uid}-${k}`}
          className="input"
          value={c[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder={ph}
        />
      )}
    </>
  );

  return (
    <div
      className="card card-editor"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save();
        }
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return; // i18n-ignore: a drag data type, not text
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={drop}
    >
      <div className="row">
        <b className="grow">{c.id ? t('browse.editor.editTitle') : t('browse.editor.newTitle')}</b>
        <button className="btn ghost" onClick={onClose} aria-label={t('browse.editor.closeLabel')}>
          ✕
        </button>
      </div>
      <label className="lbl" htmlFor={`${uid}-type`}>
        {t('browse.editor.type')}
      </label>
      <select
        id={`${uid}-type`}
        className="input"
        value={c.type}
        onChange={(e) => set('type', e.target.value as Form['type'])}
      >
        {CARD_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`browse.editor.types.${type}`, CLOZE)}
          </option>
        ))}
      </select>
      {f(
        'front',
        c.type === 'mcq'
          ? t('browse.editor.question')
          : c.type === 'order'
            ? t('browse.editor.prompt')
            : t('browse.editor.front'),
        c.type === 'cloze' ? t('browse.editor.clozePlaceholder', CLOZE) : t('browse.editor.frontPlaceholder'),
        true,
      )}
      {dups.length > 0 && (
        <p className="editor-dup small" role="status">
          {t('browse.editor.duplicate', { count: dups.length, front: dups[0].front, back: dups[0].back })}
        </p>
      )}
      {c.type === 'mcq' ? (
        <>
          {f('choices', t('browse.editor.choices'), t('browse.editor.choicesPlaceholder'))}
          {f('correct', t('browse.editor.correct'), '2|3')}
        </>
      ) : c.type === 'order' ? (
        f('steps', t('browse.editor.steps'), t('browse.editor.stepsPlaceholder'))
      ) : (
        f(
          'back',
          c.type === 'cloze' ? t('browse.editor.extra') : t('browse.editor.back'),
          t('browse.editor.backPlaceholder'),
          true,
        )
      )}
      <p className="small muted editor-format">
        {t('browse.editor.formatHint', { tags: SAFE_TAGS.map((x) => `<${x}>`).join(' ') })}
      </p>
      <span className="lbl">{t('browse.editor.media')}</span>
      <div className={`editor-drop${dragging ? ' over' : ''}`}>
        <p className="small muted">{uploading ? t('browse.editor.uploading') : t('browse.editor.dropHint')}</p>
        <div className="editor-slots">
          {SLOTS.map((k) =>
            c[k] ? (
              <span key={k} className="editor-slot">
                {t(`browse.editor.mediaSet.${k}`)}
                <button
                  className="btn ghost"
                  onClick={() => set(k, '')}
                  aria-label={t(`browse.editor.mediaRemove.${k}`)}
                >
                  ✕
                </button>
              </span>
            ) : (
              <label key={k} className="btn ghost editor-slot">
                {t(`browse.editor.mediaAdd.${k}`)}
                <input type="file" hidden accept={ACCEPT[k]} onChange={(e) => upload(k, e.target.files?.[0])} />
              </label>
            ),
          )}
        </div>
      </div>
      {showImageAlt(c) && f('imageAlt', t('browse.editor.imageAlt'), t('browse.editor.imageAltPlaceholder'))}
      <CardPreview preview={preview} lang={deck.language} />
      <details className="editor-more" open={hasMore(card)}>
        <summary>{t('browse.editor.moreFields')}</summary>
        {c.type === 'basic' && f('alt', t('browse.editor.alt'), t('browse.editor.altPlaceholder'))}
        {f('explanation', t('browse.editor.explanation'), t('browse.editor.explanationPlaceholder'), true)}
        {c.type === 'basic' && f('example', t('browse.editor.example'), t('browse.editor.examplePlaceholder'))}
        {c.type === 'basic' && f('exampleTranslation', t('browse.editor.exampleTranslation'))}
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <div className="grow">
            {f('category', t('browse.editor.category'), t('browse.editor.categoryPlaceholder'))}
          </div>
          <div className="grow">{f('tags', t('browse.editor.tags'), t('browse.editor.tagsPlaceholder'))}</div>
        </div>
      </details>
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button
          className="btn primary"
          onClick={save}
          disabled={!c.front.trim() || uploading > 0}
          aria-keyshortcuts="Control+Enter"
        >
          {c.id ? t('common.save') : t('browse.editor.add')}
        </button>
        {c.id && (
          <button className="btn ghost" onClick={() => toggle('starred')}>
            {c.starred ? t('browse.editor.starred') : t('browse.editor.star')}
          </button>
        )}
        {c.id && (
          <button className="btn ghost" onClick={() => toggle('suspended')}>
            {c.suspended ? t('browse.editor.unsuspend') : t('browse.editor.suspend')}
          </button>
        )}
        {c.id && (
          <button className="btn danger" onClick={() => confirm.current?.showModal?.()}>
            {t('common.delete')}
          </button>
        )}
        {msg && (
          <span className="small" role="status">
            {msg}
          </span>
        )}
      </div>
      <dialog ref={confirm} className="panel session-dialog" aria-labelledby={`${uid}-delete`}>
        <h2 id={`${uid}-delete`}>{t('browse.bulk.deleteTitle', { count: 1 })}</h2>
        <p>{t('browse.bulk.deleteBody', { count: 1 })}</p>
        <div className="session-dialog-actions">
          <button
            className="btn danger"
            onClick={() => {
              confirm.current?.close();
              if (c.id) onDelete(c.id);
            }}
          >
            {t('common.delete')}
          </button>
          <button className="btn primary" autoFocus onClick={() => confirm.current?.close()}>
            {t('browse.bulk.keep', { count: 1 })}
          </button>
        </div>
      </dialog>
    </div>
  );
}

/** Question and answer, drawn with the same parts and styles as the exercise in a session. */
function CardPreview({ preview, lang }: { preview: Preview | null; lang: string | null }) {
  const { t } = useTranslation();
  if (!preview) return null;
  const { item, view, explanation } = preview;
  const media = <Media item={item} size="sm" />;
  let question: ReactNode;
  let answer: ReactNode;
  switch (view.type) {
    case 'typed':
      question = (
        <>
          <div className="blocktitle">{lang ? t('ex.typed.titleLanguage') : t('ex.typed.title')}</div>
          {view.mediaFirst && media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
          <div className="typed editor-fake-input" aria-hidden="true">
            {t('ex.typed.placeholder')}
          </div>
        </>
      );
      answer = (
        <>
          <div className="ans">
            <Rich html={view.answer} />
          </div>
          {view.also.length > 0 && (
            <div className="small">{t('browse.editor.alsoAccepted', { answers: view.also.join(', ') })}</div>
          )}
          {!view.mediaFirst && media}
        </>
      );
      break;
    case 'flip':
      question = (
        <>
          <div className="blocktitle">{t('ex.flip.title')}</div>
          {view.mediaFirst && media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
        </>
      );
      answer = (
        <>
          <div className="ans">
            <Rich html={view.answer} />
          </div>
          {!view.mediaFirst && media}
        </>
      );
      break;
    case 'cloze':
      question = (
        <>
          <div className="blocktitle">{t('ex.cloze.title')}</div>
          {media}
          <div className="cloze">
            {view.before} <span className="editor-gap">…</span> {view.after}
          </div>
          <div className="small muted">{t('ex.typed.hint', { hint: view.hint })}</div>
        </>
      );
      answer = (
        <>
          <div className="ans">{view.answer}</div>
          {view.extra && <div className="small">{view.extra}</div>}
        </>
      );
      break;
    case 'mcq': {
      const multi = view.correct.length > 1;
      const opts = (reveal: boolean) => (
        <div className="col">
          {view.choices.map((choice, i) => (
            <div key={i} className={`opt${reveal && view.correct.includes(i) ? ' right' : ''}`}>
              <span className="k">{i + 1}</span>
              <Rich html={choice} />
            </div>
          ))}
        </div>
      );
      question = (
        <>
          <div className="blocktitle">
            {multi ? t('ex.mcq.titleMulti', { count: view.correct.length }) : t('ex.mcq.title')}
          </div>
          {media}
          <div className="prompt">
            <Rich html={view.stem} />
          </div>
          {opts(false)}
          <div className="small muted">{t('browse.editor.previewShuffled')}</div>
        </>
      );
      answer = opts(true);
      break;
    }
    case 'order':
      question = (
        <>
          <div className="blocktitle">{t('ex.order.title')}</div>
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
          <div className="small muted">{t('browse.editor.previewShuffled')}</div>
        </>
      );
      answer = (
        <ol className="editor-steps">
          {view.steps.map((s, i) => (
            <li key={i}>
              <Rich html={s} />
            </li>
          ))}
        </ol>
      );
      break;
    case 'problem':
      return (
        <p className="editor-dup small" role="status">
          {t(`browse.editor.problem.${view.problem}`, CLOZE)}
        </p>
      );
  }
  return (
    <section className="editor-preview" aria-label={t('browse.editor.preview')}>
      <div>
        <span className="lbl">{t('browse.editor.previewQuestion')}</span>
        <div className="editor-preview-side">{question}</div>
      </div>
      <div>
        <span className="lbl">{t('browse.editor.previewAnswer')}</span>
        <div className="editor-preview-side">
          {view.type === 'mcq' || view.type === 'order' ? answer : <div className="feedback right">{answer}</div>}
          {explanation && (
            <div className="small editor-explain">
              <Rich html={explanation} />
            </div>
          )}
          {item.audio && (
            <audio controls preload="none" src={mediaUrl(item.audio)} aria-label={t('browse.editor.mediaSet.audio')} />
          )}
        </div>
      </div>
    </section>
  );
}
