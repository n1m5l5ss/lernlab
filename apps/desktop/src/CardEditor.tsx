// Card editor: ten card types, a live preview drawn like the real exercise, media by drag and drop,
// and a gentle warning when the deck already has a card with the same front.
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SAFE_TAGS } from '@lernlab/core/cards';
import { CODE_LANGS } from '@lernlab/core/code';
import type { Duplicate } from '@lernlab/core/browse';
import { api } from './api';
import { AudioSlot } from './AudioSlot';
import { mediaUrl } from './bridge';
import {
  CARD_TYPES,
  EMPTY,
  addVariant,
  canAddVariant,
  choiceRows,
  editCorrection,
  editVariant,
  fieldsToSave,
  keyPointRows,
  workedRows,
  showCase,
  previewOf,
  removeVariant,
  showImageAlt,
  showVariants,
  sortDrop,
  type Form,
  type MediaSlot,
  type Preview,
} from './card-editor-logic';
import { LEVELS, VARIANTS_MAX, type Variant } from '@lernlab/core/variants';
import { CORRECTION_MAX_LENGTH } from '@lernlab/core/misconceptions';
import { KEY_POINTS_MAX, KEY_POINTS_MIN, KEY_POINT_MAX_LENGTH } from '@lernlab/core/explain';
import { ANSWER_WORDS_MAX } from '@lernlab/core/cardquality';
import {
  WORKED_LABEL_MAX_LENGTH,
  WORKED_RESULT_MAX_LENGTH,
  WORKED_STEPS_MAX,
  WORKED_STEPS_MIN,
  type WorkedStep,
} from '@lernlab/core/worked';
import { Media, Rich } from './rich';
import { CaseFor } from './case-view';
import { CASE_MAX_LENGTH } from '@lernlab/core/cases';
import { CodeBlock } from './code-block';
import { OcclusionEditor } from './occlusion';
import { newGroupId, occlusionCards, shapesFor, shapesReady } from './occlusion-logic';

/** Cloze gap markers are card syntax, not text. */
const CLOZE = { open: '{{c1::', close: '}}' };
const SLOTS: MediaSlot[] = ['image', 'audio', 'video'];
const ACCEPT: Record<MediaSlot, string> = { image: 'image/*', audio: 'audio/*', video: 'video/*' };
type Deck = { id: number; language: string | null };
/** Open the optional fields when the card already uses one. */
const hasMore = (f: Form) =>
  !!(
    f.alt ||
    f.explanation ||
    f.example ||
    f.exampleTranslation ||
    f.notes ||
    f.mnemonic ||
    f.category ||
    f.tags ||
    f.requires
  );

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
  // Occlusion: the boxes on the picture (a saved card's whole group) and the one being edited and previewed.
  const [shapes, setShapes] = useState(() => shapesFor(card.item));
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      shapes.findIndex((s) => s.id === card.id),
    ),
  );
  const occlusion = c.type === 'occlusion';
  // A saved occlusion card edits only its own box; a card turned into one becomes its first box.
  const ownBox = card.item?.kind === 'occlusion' ? card.id : undefined;
  const ready = !occlusion || shapesReady(c.image, shapes);
  const deck = useMemo<Deck>(() => {
    const id = card.item?.deckId ?? deckId;
    return { id, language: card.item?.lang ?? decks.find((d) => d.id === id)?.language ?? null };
  }, [card.item, deckId, decks]);
  const preview = useMemo(() => previewOf(c, deck, shapes, selected), [c, deck, shapes, selected]);

  // Look for a card with the same front while typing; it only warns, saving stays possible.
  useEffect(() => {
    // The boxes of one picture share their front on purpose.
    if (!c.front.trim() || occlusion) {
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
  }, [c.front, c.id, deck.id, occlusion]);

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
    if (!c.front.trim() || uploading || !ready) return;
    try {
      // An occlusion picture saves one card per box (a saved one saves only itself).
      const cards = occlusion ? occlusionCards(fieldsToSave(c), shapes, ownBox, newGroupId()) : [fieldsToSave(c)];
      for (const [k, card] of cards.entries()) {
        if (c.id && k === 0) await api.saveCard(c.id, card);
        else await api.addCard(deck.id, card);
      }
      onSaved();
      if (!c.id) {
        setC({ ...EMPTY, type: c.type, tags: c.tags, category: c.category });
        setShapes([]);
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
  type TextKey = Exclude<keyof typeof EMPTY, 'type' | 'variants' | 'corrections' | 'workedSteps'>;
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
            : c.type === 'code'
              ? t('browse.editor.codeTask')
              : occlusion
                ? t('browse.editor.occlusion.title')
                : c.type === 'myth'
                  ? t('browse.editor.myth')
                  : c.type === 'explain'
                    ? t('browse.editor.explain')
                    : c.type === 'worked'
                      ? t('browse.editor.worked.problem')
                      : t('browse.editor.front'),
        c.type === 'cloze'
          ? t('browse.editor.clozePlaceholder', CLOZE)
          : c.type === 'code'
            ? t('browse.editor.codeTaskPlaceholder')
            : occlusion
              ? t('browse.editor.occlusion.titlePlaceholder')
              : c.type === 'myth'
                ? t('browse.editor.mythPlaceholder')
                : c.type === 'explain'
                  ? t('browse.editor.explainPlaceholder')
                  : c.type === 'worked'
                    ? t('browse.editor.worked.problemPlaceholder')
                    : t('browse.editor.frontPlaceholder'),
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
          <CorrectionsField form={c} onChange={(v) => set('corrections', v)} />
        </>
      ) : c.type === 'order' ? (
        f('steps', t('browse.editor.steps'), t('browse.editor.stepsPlaceholder'))
      ) : c.type === 'code' ? (
        <>
          <label className="lbl" htmlFor={`${uid}-codeLang`}>
            {t('browse.editor.codeLang')}
          </label>
          <select
            id={`${uid}-codeLang`}
            className="input"
            value={c.codeLang}
            onChange={(e) => set('codeLang', e.target.value)}
          >
            <option value="">{t('browse.editor.codeLangNone')}</option>
            {[
              ...CODE_LANGS,
              ...(CODE_LANGS.some((l) => l.id === c.codeLang) || !c.codeLang
                ? []
                : [{ id: c.codeLang, name: c.codeLang }]),
            ].map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label className="lbl" htmlFor={`${uid}-code`}>
            {t('browse.editor.code')}
          </label>
          <textarea
            id={`${uid}-code`}
            className="input code-input"
            rows={6}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={c.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder={t('browse.editor.codePlaceholder', CLOZE)}
          />
          {f('back', t('browse.editor.codeOutput'), t('browse.editor.codeOutputPlaceholder'), true)}
          <p className="small muted">{t('browse.editor.codeHelp', CLOZE)}</p>
        </>
      ) : occlusion ? null : c.type === 'numeric' ? (
        <>
          {f('back', t('browse.editor.number'), t('browse.editor.numberPlaceholder'))}
          {f('tolerance', t('browse.editor.tolerance'), t('browse.editor.tolerancePlaceholder'))}
        </>
      ) : c.type === 'myth' ? (
        f('back', t('browse.editor.mythWhy'), t('browse.editor.mythWhyPlaceholder'), true)
      ) : c.type === 'explain' ? (
        <>
          {f('back', t('browse.editor.explainBack'), t('browse.editor.explainBackPlaceholder'), true)}
          <KeyPointsField points={c.keyPoints} onChange={(v) => set('keyPoints', v)} />
        </>
      ) : c.type === 'worked' ? (
        <>
          <WorkedStepsField steps={c.workedSteps} onChange={(v) => set('workedSteps', v)} />
          {f('back', t('browse.editor.worked.answer'), t('browse.editor.worked.answerPlaceholder'), true)}
        </>
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
      {showCase(c) && (
        <>
          <label className="lbl" htmlFor={`${uid}-case`}>
            {t('browse.editor.case.label')}
          </label>
          <textarea
            id={`${uid}-case`}
            className="input"
            maxLength={CASE_MAX_LENGTH}
            value={c.case}
            aria-describedby={`${uid}-case-hint`}
            placeholder={t('browse.editor.case.placeholder')}
            onChange={(e) => set('case', e.target.value)}
          />
          <p id={`${uid}-case-hint`} className="small muted">
            {t('browse.editor.case.hint')}
          </p>
        </>
      )}
      {showVariants(c) && <VariantsField variants={c.variants} onChange={(v) => set('variants', v)} />}
      <span className="lbl">{t('browse.editor.media')}</span>
      <div className={`editor-drop${dragging ? ' over' : ''}`}>
        <p className="small muted">{uploading ? t('browse.editor.uploading') : t('browse.editor.dropHint')}</p>
        <div className="editor-slots">
          {SLOTS.map((k) =>
            k === 'audio' ? (
              <AudioSlot
                key={k}
                file={c.audio}
                onChange={(file) => set('audio', file)}
                onUpload={(file) => upload('audio', file)}
                onBusy={(d) => setUploading((n) => n + d)}
                onError={fail}
              />
            ) : c[k] ? (
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
      {occlusion && (
        <section className="occl-section" aria-label={t('browse.editor.types.occlusion')}>
          <fieldset className="occl-mode">
            <legend>{t('browse.editor.occlusion.mode')}</legend>
            {(['one', 'all'] as const).map((m) => (
              <label key={m} className="row">
                <input
                  type="radio"
                  name={`${uid}-mode`}
                  value={m}
                  checked={(c.occlusionMode === 'all' ? 'all' : 'one') === m}
                  onChange={() => set('occlusionMode', m)}
                />
                {t(`browse.editor.occlusion.modes.${m}`)}
              </label>
            ))}
          </fieldset>
          {c.image ? (
            <OcclusionEditor
              image={c.image}
              alt={c.imageAlt}
              shapes={shapes}
              own={ownBox}
              selected={selected}
              onSelect={setSelected}
              onChange={(next) => {
                setMsg('');
                setShapes(next);
              }}
            />
          ) : (
            <p className="small muted">{t('browse.editor.occlusion.needsImage')}</p>
          )}
        </section>
      )}
      <CardPreview preview={preview} lang={deck.language} />
      {!!preview?.hints.length && (
        // Suggestions only: the card saves and studies the same with or without them.
        <section className="editor-hints small" role="status" aria-label={t('browse.editor.hints.title')}>
          <span className="lbl" aria-hidden="true">
            {t('browse.editor.hints.title')}
          </span>
          <ul>
            {preview.hints.map((h) => (
              <li key={h}>{t(`browse.editor.hints.${h}`, { words: ANSWER_WORDS_MAX })}</li>
            ))}
          </ul>
        </section>
      )}
      <details className="editor-more" open={hasMore(card)}>
        <summary>{t('browse.editor.moreFields')}</summary>
        {c.type === 'basic' && f('alt', t('browse.editor.alt'), t('browse.editor.altPlaceholder'))}
        {f('explanation', t('browse.editor.explanation'), t('browse.editor.explanationPlaceholder'), true)}
        {f('requires', t('browse.editor.requires'), t('browse.editor.requiresPlaceholder'))}
        {c.type === 'basic' && f('example', t('browse.editor.example'), t('browse.editor.examplePlaceholder'))}
        {c.type === 'basic' && f('exampleTranslation', t('browse.editor.exampleTranslation'))}
        {f('mnemonic', t('browse.editor.mnemonic'), t('browse.editor.mnemonicPlaceholder'))}
        <p className="small muted editor-format">{t('browse.editor.mnemonicHint')}</p>
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
          disabled={!c.front.trim() || uploading > 0 || !ready}
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
    case 'myth':
      question = (
        <>
          <div className="blocktitle">{t('ex.myth.title')}</div>
          {media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
        </>
      );
      answer = (
        <>
          {t('ex.myth.because')}
          <div className="ans">
            <Rich html={view.answer} />
          </div>
        </>
      );
      break;
    case 'explain':
      question = (
        <>
          <div className="blocktitle">{t('ex.explain.title')}</div>
          {media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
        </>
      );
      answer = (
        <>
          {view.answer && (
            <div className="ans">
              <Rich html={view.answer} />
            </div>
          )}
          <ul className="explain-points">
            {view.points.map((p, i) => (
              <li key={i}>
                <Rich html={p} />
              </li>
            ))}
          </ul>
        </>
      );
      break;
    case 'worked':
      question = (
        <>
          <div className="blocktitle">{t('ex.worked.title.study')}</div>
          {media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
        </>
      );
      answer = (
        <>
          <ol className="worked-steps">
            {view.steps.map((s, i) => (
              <li key={i} className="worked-step">
                {s.label && (
                  <div className="worked-label">
                    <Rich html={s.label} />
                  </div>
                )}
                <div className="worked-result">
                  <Rich html={s.result} />
                </div>
              </li>
            ))}
          </ol>
          <div className="ans">
            <Rich html={view.answer} />
          </div>
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
    case 'code': {
      const { task } = view;
      question = (
        <>
          <div className="blocktitle">
            {task.mode === 'fill'
              ? t('ex.code.fillTitle')
              : task.mode === 'output'
                ? t('ex.code.outputTitle')
                : t('ex.code.orderTitle')}
          </div>
          {media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
          {task.mode === 'order' ? (
            <div className="small muted">{t('browse.editor.previewShuffled')}</div>
          ) : (
            <CodeBlock code={task.code} lang={task.lang} gap={<span className="editor-gap">…</span>} />
          )}
        </>
      );
      answer =
        task.mode === 'order' ? (
          <CodeBlock code={task.lines.join('\n')} lang={task.lang} />
        ) : (
          <div className="code-answer">
            <div className="ans">{task.answer}</div>
          </div>
        );
      break;
    }
    case 'occlusion':
      question = (
        <>
          <div className="blocktitle">{t('ex.occlusion.title')}</div>
          {media}
          <div className="prompt">
            <Rich html={view.prompt} />
          </div>
          <div className="typed editor-fake-input" aria-hidden="true">
            {t('ex.typed.placeholder')}
          </div>
        </>
      );
      answer = <div className="ans">{view.answer}</div>;
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
        <div className="editor-preview-side">
          <CaseFor item={preview.item} />
          {question}
        </div>
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

/** Other ways to ask the card's question, each with its level: add, edit and remove them. */
function VariantsField({ variants, onChange }: { variants: Variant[]; onChange: (v: Variant[]) => void }) {
  const { t } = useTranslation();
  const uid = useId();
  // The row just added takes the focus, so a keyboard user can type at once.
  const [added, setAdded] = useState(-1);
  return (
    <fieldset className="editor-variants" aria-describedby={`${uid}-help`}>
      <legend>{t('browse.editor.variants.title')}</legend>
      <p id={`${uid}-help`} className="small muted">
        {t('browse.editor.variants.help')}
      </p>
      {variants.map((v, i) => {
        const n = i + 1;
        return (
          <div className="editor-variant" key={i}>
            <label className="sr-only" htmlFor={`${uid}-q${i}`}>
              {t('browse.editor.variants.question', { n })}
            </label>
            <textarea
              id={`${uid}-q${i}`}
              rows={2}
              className="input"
              value={v.prompt}
              autoFocus={i === added}
              placeholder={t(`browse.editor.variants.placeholder.${v.level}`)}
              onChange={(e) => onChange(editVariant(variants, i, { prompt: e.target.value }))}
            />
            <label className="sr-only" htmlFor={`${uid}-l${i}`}>
              {t('browse.editor.variants.level', { n })}
            </label>
            <select
              id={`${uid}-l${i}`}
              className="input"
              value={v.level}
              onChange={(e) => onChange(editVariant(variants, i, { level: e.target.value as Variant['level'] }))}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`levels.${l}`)}
                </option>
              ))}
            </select>
            <button
              className="btn ghost"
              onClick={() => onChange(removeVariant(variants, i))}
              aria-label={t('browse.editor.variants.remove', { n })}
            >
              ✕
            </button>
          </div>
        );
      })}
      {canAddVariant(variants) ? (
        <button
          className="btn ghost"
          onClick={() => {
            setAdded(variants.length);
            onChange(addVariant(variants));
          }}
        >
          {t('browse.editor.variants.add')}
        </button>
      ) : (
        <p className="small muted">{t('browse.editor.variants.full', { count: VARIANTS_MAX })}</p>
      )}
    </fieldset>
  );
}

/** An explain card's 2–5 key points: the ones a good explanation covers, ticked by the learner after explaining. */
function KeyPointsField({ points, onChange }: { points: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  const uid = useId();
  const rows = keyPointRows(points);
  const [added, setAdded] = useState(-1);
  return (
    <fieldset className="editor-variants editor-keypoints" aria-describedby={`${uid}-help`}>
      <legend>{t('browse.editor.keyPoints.title')}</legend>
      <p id={`${uid}-help`} className="small muted">
        {t('browse.editor.keyPoints.help')}
      </p>
      {rows.map((p, i) => {
        const n = i + 1;
        return (
          <div className="editor-keypoint" key={i}>
            <label className="sr-only" htmlFor={`${uid}-p${i}`}>
              {t('browse.editor.keyPoints.point', { n })}
            </label>
            <input
              id={`${uid}-p${i}`}
              className="input"
              maxLength={KEY_POINT_MAX_LENGTH}
              value={p}
              autoFocus={i === added}
              placeholder={t('browse.editor.keyPoints.placeholder')}
              onChange={(e) => onChange(rows.map((x, k) => (k === i ? e.target.value : x)))}
            />
            {rows.length > KEY_POINTS_MIN && (
              <button
                className="btn ghost"
                onClick={() => onChange(rows.filter((_, k) => k !== i))}
                aria-label={t('browse.editor.keyPoints.remove', { n })}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      {rows.length < KEY_POINTS_MAX ? (
        <button
          className="btn ghost"
          onClick={() => {
            setAdded(rows.length);
            onChange([...rows, '']);
          }}
        >
          {t('browse.editor.keyPoints.add')}
        </button>
      ) : (
        <p className="small muted">{t('browse.editor.keyPoints.full', { count: KEY_POINTS_MAX })}</p>
      )}
    </fieldset>
  );
}

/** A worked example's 2–8 solution steps: what you do (optional) and its result, which learners type. */
function WorkedStepsField({ steps, onChange }: { steps: WorkedStep[]; onChange: (v: WorkedStep[]) => void }) {
  const { t } = useTranslation();
  const uid = useId();
  const rows = workedRows(steps);
  const [added, setAdded] = useState(-1);
  const edit = (i: number, change: Partial<WorkedStep>) =>
    onChange(rows.map((x, k) => (k === i ? { ...x, ...change } : x)));
  return (
    <fieldset className="editor-variants editor-worked" aria-describedby={`${uid}-help`}>
      <legend>{t('browse.editor.worked.title')}</legend>
      <p id={`${uid}-help`} className="small muted">
        {t('browse.editor.worked.help')}
      </p>
      {rows.map((s, i) => {
        const n = i + 1;
        return (
          <div className="editor-worked-step" key={i}>
            <label className="sr-only" htmlFor={`${uid}-l${i}`}>
              {t('browse.editor.worked.label', { n })}
            </label>
            <input
              id={`${uid}-l${i}`}
              className="input"
              maxLength={WORKED_LABEL_MAX_LENGTH}
              value={s.label}
              autoFocus={i === added}
              placeholder={t('browse.editor.worked.labelPlaceholder')}
              onChange={(e) => edit(i, { label: e.target.value })}
            />
            <label className="sr-only" htmlFor={`${uid}-r${i}`}>
              {t('browse.editor.worked.result', { n })}
            </label>
            <input
              id={`${uid}-r${i}`}
              className="input"
              maxLength={WORKED_RESULT_MAX_LENGTH}
              value={s.result}
              placeholder={t('browse.editor.worked.resultPlaceholder')}
              onChange={(e) => edit(i, { result: e.target.value })}
            />
            {rows.length > WORKED_STEPS_MIN && (
              <button
                className="btn ghost"
                onClick={() => onChange(rows.filter((_, k) => k !== i))}
                aria-label={t('browse.editor.worked.remove', { n })}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      {rows.length < WORKED_STEPS_MAX ? (
        <button
          className="btn ghost"
          onClick={() => {
            setAdded(rows.length);
            onChange([...rows, { label: '', result: '' }]);
          }}
        >
          {t('browse.editor.worked.add')}
        </button>
      ) : (
        <p className="small muted">{t('browse.editor.worked.full', { count: WORKED_STEPS_MAX })}</p>
      )}
    </fieldset>
  );
}

/** A short correction for each wrong choice, shown when a learner picks it ("Many people think X. In fact Y."). */
function CorrectionsField({ form, onChange }: { form: Form; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  const uid = useId();
  const wrong = choiceRows(form)
    .map((row, i) => ({ ...row, i }))
    .filter((row) => !row.correct);
  if (!wrong.length) return null;
  return (
    <fieldset className="editor-variants editor-corrections" aria-describedby={`${uid}-help`}>
      <legend>{t('browse.editor.corrections.title')}</legend>
      <p id={`${uid}-help`} className="small muted">
        {t('browse.editor.corrections.help')}
      </p>
      {wrong.map(({ choice, i }) => (
        <div className="editor-correction" key={i}>
          <label className="lbl" htmlFor={`${uid}-c${i}`}>
            {t('browse.editor.corrections.choice', { choice })}
          </label>
          <textarea
            id={`${uid}-c${i}`}
            rows={2}
            maxLength={CORRECTION_MAX_LENGTH}
            className="input"
            value={form.corrections[i] ?? ''}
            placeholder={t('browse.editor.corrections.placeholder')}
            onChange={(e) => onChange(editCorrection(form.corrections, i, e.target.value))}
          />
        </div>
      ))}
    </fieldset>
  );
}
