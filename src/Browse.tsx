import { useEffect, useState } from 'react';
import { api } from './api';
import { Media, Rich } from './rich';

const LEVELS = ['new', 'seen', 'recognised', 'matched', 'recalled', 'in context', 'spoken'];
const EMPTY = { front: '', back: '', example: '', exampleTranslation: '', explanation: '', notes: '', category: '', tags: '', image: '', audio: '', video: '', alt: '', type: 'basic', choices: '', correct: '', steps: '' };

export function Browse({ state, refresh }: { state: any; refresh: () => void }) {
  const deck = state.decks.find((d: any) => d.id === state.activeDeck);
  const [q, setQ] = useState('');
  const [data, setData] = useState<any>({ cards: [], total: 0 });
  const [sel, setSel] = useState<any>(null);
  const load = () => deck && api.cards(deck.id, q).then(setData);
  useEffect(() => { load(); }, [deck?.id, q]);
  if (!deck) return <div className="card muted">Pick or import a deck first.</div>;

  const edit = (c: any) => setSel({
    id: c.id, front: c.target, back: c.meaning, example: c.sentenceHtml, exampleTranslation: c.sentenceMeaning, explanation: c.grammar, notes: c.notes,
    category: c.category ?? '', tags: c.tags.join(' '), image: c.image ?? '', audio: c.audio ?? '', video: c.video ?? '',
    alt: c.extra?.alt ?? '', type: c.kind === 'mcq' || c.kind === 'order' || c.kind === 'cloze' ? c.kind : 'basic',
    choices: c.extra?.choices ?? '', correct: c.extra?.correct ?? '', steps: c.extra?.steps ?? '', suspended: c.suspended, starred: c.starred, item: c,
  });

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row">
        <h2 className="grow" style={{ margin: 0 }}>{deck.name} <span className="small muted">· {data.total} cards</span></h2>
        <input className="input" style={{ width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards…" />
        <button className="btn primary" onClick={() => setSel({ ...EMPTY })}>+ Add card</button>
      </div>
      <div className="split">
        <div className="table-wrap">
          <table className="t"><thead><tr><th>Front</th><th>Back</th><th>Level</th><th></th></tr></thead><tbody>
            {data.cards.map((c: any) => (
              <tr key={c.id} className={sel?.id === c.id ? 'sel' : ''} onClick={() => edit(c)} style={{ opacity: c.suspended ? 0.45 : 1 }}>
                <td>{c.starred ? '★ ' : ''}{c.target.replace(/<[^>]+>/g, '').slice(0, 60)}</td>
                <td className="muted">{c.meaning.replace(/<[^>]+>/g, '').slice(0, 50)}</td>
                <td className="small">{c.due ? LEVELS[c.mastery + 1] ?? 'spoken' : 'new'}</td>
                <td className="small muted">{c.image ? '🖼' : ''}{c.audio ? '🔊' : ''}{c.video ? '🎬' : ''}</td>
              </tr>
            ))}
          </tbody></table>
          {data.total > data.cards.length && <div className="small muted" style={{ padding: 10 }}>Showing first {data.cards.length}. Search to narrow down.</div>}
        </div>
        {sel ? <CardEditor key={sel.id ?? 'new'} card={sel} deckId={deck.id} onClose={() => setSel(null)} onSaved={() => { load(); refresh(); }} /> : <div className="card muted">Select a card to edit it, or add a new one. Cards can hold text, images, audio and video/GIFs.</div>}
      </div>
    </div>
  );
}

function CardEditor({ card, deckId, onClose, onSaved }: { card: any; deckId: number; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState(card);
  const [msg, setMsg] = useState('');
  const set = (k: string, v: any) => setC({ ...c, [k]: v });
  const upload = async (k: 'image' | 'audio' | 'video', f?: File) => {
    if (!f) return;
    try { const r = await api.uploadMedia(f); set(k, r.file); } catch (e: any) { setMsg(e.message); }
  };
  const save = async () => {
    try {
      if (c.id) await api.saveCard(c.id, c); else await api.addCard(deckId, c);
      setMsg('Saved ✓');
      onSaved();
      if (!c.id) setC({ ...EMPTY, type: c.type });
    } catch (e: any) { setMsg(e.message); }
  };
  const toggle = async (k: 'suspended' | 'starred') => { await api.saveCard(c.id, { [k]: !c[k] }); set(k, !c[k]); onSaved(); };
  const del = async () => { if (!confirm('Delete this card and its progress?')) return; await api.deleteCard(c.id); onSaved(); onClose(); };
  const f = (k: string, label: string, ph = '', area = false) => (
    <>
      <label className="lbl">{label}</label>
      {area ? <textarea className="input" value={c[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
        : <input className="input" value={c[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />}
    </>
  );
  const preview = { ...(card.item ?? {}), image: c.image || null, video: c.video || null } as any;
  return (
    <div className="card" style={{ position: 'sticky', top: 12 }}>
      <div className="row"><b className="grow">{c.id ? 'Edit card' : 'New card'}</b><button className="btn ghost" onClick={onClose}>✕</button></div>
      <label className="lbl">Card type</label>
      <select className="input" value={c.type} onChange={(e) => set('type', e.target.value)}>
        <option value="basic">Basic (front / back)</option>
        <option value="cloze">Cloze ({'{{c1::gap}}'} in the front)</option>
        <option value="mcq">Multiple choice / multi-select question</option>
        <option value="order">Put steps in order</option>
      </select>
      {f('front', c.type === 'mcq' ? 'Question' : c.type === 'order' ? 'Prompt' : 'Front', c.type === 'cloze' ? 'The {{c1::mitochondria}} is the powerhouse of the cell' : 'Term or question', true)}
      {c.type === 'mcq' ? (<>{f('choices', 'Choices (separate with |)', 'Amazon EC2|AWS Lambda|AWS Fargate|Amazon RDS')}{f('correct', 'Correct (numbers or texts, | separated)', '2|3')}</>)
        : c.type === 'order' ? f('steps', 'Steps in the right order (separate with |)', 'SYN|SYN-ACK|ACK')
        : f('back', c.type === 'cloze' ? 'Extra (shown after)' : 'Back', 'Definition or answer', true)}
      {c.type === 'basic' && f('alt', 'Also accept (separate with |)', 'colour|color')}
      {f('explanation', 'Explanation', 'Why it is right – shown after answering', true)}
      {c.type === 'basic' && f('example', 'Example sentence (mark the word with <b>…</b> for fill-the-gap)', 'Ich bin <b>müde</b>.')}
      {c.type === 'basic' && f('exampleTranslation', 'Example translation')}
      <div className="row" style={{ gap: 10 }}>
        <div className="grow">{f('category', 'Category (for sorting games)', 'e.g. der / Storage / Cardio')}</div>
        <div className="grow">{f('tags', 'Tags', 'space separated')}</div>
      </div>
      <label className="lbl">Media</label>
      <Media item={preview} size="sm" />
      <div className="row small" style={{ flexWrap: 'wrap', gap: 8 }}>
        {(['image', 'audio', 'video'] as const).map((k) => (
          <label key={k} className="btn ghost" style={{ padding: '6px 10px' }}>
            {c[k] ? `✓ ${k}` : `+ ${k === 'video' ? 'video/GIF' : k}`}
            <input type="file" hidden accept={k === 'image' ? 'image/*' : k === 'audio' ? 'audio/*' : 'video/*,image/gif'} onChange={(e) => upload(k, e.target.files?.[0])} />
          </label>
        ))}
        {(c.image || c.audio || c.video) && <button className="btn ghost" style={{ padding: '6px 10px' }} onClick={() => setC({ ...c, image: '', audio: '', video: '' })}>Remove media</button>}
      </div>
      {c.front && c.type === 'basic' && <div className="small muted" style={{ marginTop: 10 }}>Preview: <Rich html={c.front} /> → <Rich html={c.back} /></div>}
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={save} disabled={!c.front?.trim()}>{c.id ? 'Save' : 'Add card'}</button>
        {c.id && <button className="btn ghost" onClick={() => toggle('starred')}>{c.starred ? '★ Starred' : '☆ Star'}</button>}
        {c.id && <button className="btn ghost" onClick={() => toggle('suspended')}>{c.suspended ? 'Unsuspend' : 'Suspend'}</button>}
        {c.id && <button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={del}>Delete</button>}
        {msg && <span className="small">{msg}</span>}
      </div>
    </div>
  );
}
