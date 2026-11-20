import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { Media, Rich } from './rich';

const LEVELS = ['new', 'seen', 'recognised', 'matched', 'recalled', 'inContext', 'spoken'];
/** Cloze gap markers are card syntax, not text. */
const CLOZE = { open: '{{c1::', close: '}}' };
const EMPTY = {
  front: '',
  back: '',
  example: '',
  exampleTranslation: '',
  explanation: '',
  notes: '',
  category: '',
  tags: '',
  image: '',
  audio: '',
  video: '',
  alt: '',
  type: 'basic',
  choices: '',
  correct: '',
  steps: '',
};

export function Browse({ state, refresh }: { state: any; refresh: () => void }) {
  const { t } = useTranslation();
  const deck = state.decks.find((d: any) => d.id === state.activeDeck);
  const [q, setQ] = useState('');
  const [data, setData] = useState<any>({ cards: [], total: 0 });
  const [sel, setSel] = useState<any>(null);
  const load = () => deck && api.cards(deck.id, q).then(setData);
  useEffect(() => {
    load();
  }, [deck?.id, q]);
  if (!deck) return <div className="card muted">{t('browse.noDeck')}</div>;

  const edit = (c: any) =>
    setSel({
      id: c.id,
      front: c.target,
      back: c.meaning,
      example: c.sentenceHtml,
      exampleTranslation: c.sentenceMeaning,
      explanation: c.grammar,
      notes: c.notes,
      category: c.category ?? '',
      tags: c.tags.join(' '),
      image: c.image ?? '',
      audio: c.audio ?? '',
      video: c.video ?? '',
      alt: c.extra?.alt ?? '',
      type: c.kind === 'mcq' || c.kind === 'order' || c.kind === 'cloze' ? c.kind : 'basic',
      choices: c.extra?.choices ?? '',
      correct: c.extra?.correct ?? '',
      steps: c.extra?.steps ?? '',
      suspended: c.suspended,
      starred: c.starred,
      item: c,
    });

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row">
        <h2 className="grow" style={{ margin: 0 }}>
          {deck.name} <span className="small muted">{t('browse.count', { count: data.total })}</span>
        </h2>
        <input
          className="input"
          style={{ width: 260 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('browse.search')}
          aria-label={t('browse.search')}
        />
        <button className="btn primary" onClick={() => setSel({ ...EMPTY })}>
          {t('browse.addCard')}
        </button>
      </div>
      <div className="split">
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('browse.colFront')}</th>
                <th>{t('browse.colBack')}</th>
                <th>{t('browse.colLevel')}</th>
                <th aria-label={t('browse.colMedia')}></th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c: any) => (
                <tr
                  key={c.id}
                  className={sel?.id === c.id ? 'sel' : ''}
                  onClick={() => edit(c)}
                  style={{ opacity: c.suspended ? 0.45 : 1 }}
                >
                  <td>
                    {c.starred ? '★ ' : ''}
                    {c.target.replace(/<[^>]+>/g, '').slice(0, 60)}
                  </td>
                  <td className="muted">{c.meaning.replace(/<[^>]+>/g, '').slice(0, 50)}</td>
                  <td className="small">{t(`browse.level.${c.due ? (LEVELS[c.mastery + 1] ?? 'spoken') : 'new'}`)}</td>
                  <td className="small muted">
                    {c.image && <span title={t('browse.hasImage')}>🖼</span>}
                    {c.audio && <span title={t('browse.hasAudio')}>🔊</span>}
                    {c.video && <span title={t('browse.hasVideo')}>🎬</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.total > data.cards.length && (
            <div className="small muted" style={{ padding: 10 }}>
              {t('browse.showingFirst', { count: data.cards.length })}
            </div>
          )}
        </div>
        {sel ? (
          <CardEditor
            key={sel.id ?? 'new'}
            card={sel}
            deckId={deck.id}
            onClose={() => setSel(null)}
            onSaved={() => {
              load();
              refresh();
            }}
          />
        ) : (
          <div className="card muted">{t('browse.selectHint')}</div>
        )}
      </div>
    </div>
  );
}

function CardEditor({
  card,
  deckId,
  onClose,
  onSaved,
}: {
  card: any;
  deckId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [c, setC] = useState(card);
  const [msg, setMsg] = useState('');
  const set = (k: string, v: any) => setC({ ...c, [k]: v });
  const upload = async (k: 'image' | 'audio' | 'video', f?: File) => {
    if (!f) return;
    try {
      const r = await api.uploadMedia(f);
      set(k, r.file);
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  const save = async () => {
    try {
      if (c.id) await api.saveCard(c.id, c);
      else await api.addCard(deckId, c);
      setMsg(t('common.saved'));
      onSaved();
      if (!c.id) setC({ ...EMPTY, type: c.type });
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  const toggle = async (k: 'suspended' | 'starred') => {
    await api.saveCard(c.id, { [k]: !c[k] });
    set(k, !c[k]);
    onSaved();
  };
  const del = async () => {
    if (!confirm(t('browse.editor.confirmDelete'))) return;
    await api.deleteCard(c.id);
    onSaved();
    onClose();
  };
  const f = (k: string, label: string, ph = '', area = false) => (
    <>
      <label className="lbl">{label}</label>
      {area ? (
        <textarea className="input" value={c[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
      ) : (
        <input className="input" value={c[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
      )}
    </>
  );
  const preview = { ...(card.item ?? {}), image: c.image || null, video: c.video || null } as any;
  return (
    <div className="card" style={{ position: 'sticky', top: 12 }}>
      <div className="row">
        <b className="grow">{c.id ? t('browse.editor.editTitle') : t('browse.editor.newTitle')}</b>
        <button className="btn ghost" onClick={onClose} aria-label={t('browse.editor.closeLabel')}>
          ✕
        </button>
      </div>
      <label className="lbl">{t('browse.editor.type')}</label>
      <select className="input" value={c.type} onChange={(e) => set('type', e.target.value)}>
        <option value="basic">{t('browse.editor.types.basic')}</option>
        <option value="cloze">{t('browse.editor.types.cloze', CLOZE)}</option>
        <option value="mcq">{t('browse.editor.types.mcq')}</option>
        <option value="order">{t('browse.editor.types.order')}</option>
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
      {c.type === 'basic' && f('alt', t('browse.editor.alt'), t('browse.editor.altPlaceholder'))}
      {f('explanation', t('browse.editor.explanation'), t('browse.editor.explanationPlaceholder'), true)}
      {c.type === 'basic' && f('example', t('browse.editor.example'), t('browse.editor.examplePlaceholder'))}
      {c.type === 'basic' && f('exampleTranslation', t('browse.editor.exampleTranslation'))}
      <div className="row" style={{ gap: 10 }}>
        <div className="grow">{f('category', t('browse.editor.category'), t('browse.editor.categoryPlaceholder'))}</div>
        <div className="grow">{f('tags', t('browse.editor.tags'), t('browse.editor.tagsPlaceholder'))}</div>
      </div>
      <label className="lbl">{t('browse.editor.media')}</label>
      <Media item={preview} size="sm" />
      <div className="row small" style={{ flexWrap: 'wrap', gap: 8 }}>
        {(['image', 'audio', 'video'] as const).map((k) => (
          <label key={k} className="btn ghost" style={{ padding: '6px 10px' }}>
            {c[k] ? t(`browse.editor.mediaSet.${k}`) : t(`browse.editor.mediaAdd.${k}`)}
            <input
              type="file"
              hidden
              accept={k === 'image' ? 'image/*' : k === 'audio' ? 'audio/*' : 'video/*,image/gif'}
              onChange={(e) => upload(k, e.target.files?.[0])}
            />
          </label>
        ))}
        {(c.image || c.audio || c.video) && (
          <button
            className="btn ghost"
            style={{ padding: '6px 10px' }}
            onClick={() => setC({ ...c, image: '', audio: '', video: '' })}
          >
            {t('browse.editor.removeMedia')}
          </button>
        )}
      </div>
      {c.front && c.type === 'basic' && (
        <div className="small muted" style={{ marginTop: 10 }}>
          {t('browse.editor.preview')} <Rich html={c.front} /> → <Rich html={c.back} />
        </div>
      )}
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={save} disabled={!c.front?.trim()}>
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
          <button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={del}>
            {t('common.delete')}
          </button>
        )}
        {msg && <span className="small">{msg}</span>}
      </div>
    </div>
  );
}
