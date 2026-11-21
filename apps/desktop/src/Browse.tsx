// Card browser: search and filter every card, select many, and change them together.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_STATES, type BulkAction, type CardState } from '@lernlab/core/browse';
import type { OutputOf } from '../backend/handlers';
import { api } from './api';
import { selectClick, visibleRange } from './browse-logic';
import { formatNumber } from './i18n';
import { EMPTY, formFor, type Form } from './card-editor-logic';
import { CardEditor } from './CardEditor';

type AppState = OutputOf<'state.get'>;
type Found = OutputOf<'cards.find'>;
type Filter = { deckId: number | null; q: string; tag: string; state: CardState | '' };
/** Row height in px; the list draws only the rows in view, so 10,000 cards scroll smoothly. */
const ROW = 44;

export function Browse({ state, refresh }: { state: AppState; refresh: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>({ deckId: state.activeDeck ?? null, q: '', tag: '', state: '' });
  const [found, setFound] = useState<Found>({ total: 0, rows: [], limit: 0 });
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Form | null>(null);
  const [notice, setNotice] = useState('');
  const deckName = useMemo(() => new Map(state.decks.map((d) => [d.id, d.name])), [state.decks]);

  const load = () =>
    api
      .findCards({
        deckId: filter.deckId,
        q: filter.q || undefined,
        tag: filter.tag || undefined,
        state: filter.state || undefined,
      })
      .then((f) => {
        setFound(f);
        const shown = new Set(f.rows.map((r) => r.id));
        setSel((s) => new Set([...s].filter((id) => shown.has(id))));
      });
  useEffect(() => {
    const timer = setTimeout(load, filter.q ? 150 : 0);
    return () => clearTimeout(timer);
  }, [filter]);

  if (state.decks.length === 0) return <div className="card muted">{t('browse.noDeck')}</div>;

  const set = <K extends keyof Filter>(k: K, value: Filter[K]) => setFilter((f) => ({ ...f, [k]: value }));
  const open = (id: number) => api.getCard(id).then((c) => setEditing(formFor(c)));
  const afterChange = async (message = '') => {
    setNotice(message);
    await load();
    await refresh();
  };
  const apply = async (ids: number[], action: BulkAction) => {
    const r = await api.bulkCards(ids, action);
    if (action.kind === 'delete') {
      setSel(new Set());
      if (editing?.id && ids.includes(editing.id)) setEditing(null);
    }
    await afterChange(t(action.kind === 'delete' ? 'browse.bulk.deleted' : 'browse.bulk.changed', { count: r.count }));
  };

  return (
    <div className="col browse" style={{ gap: 'var(--space-3)' }}>
      <div className="browse-head">
        <p className="muted">{t('browse.count', { count: found.total, n: formatNumber(found.total) })}</p>
        <button className="btn primary" onClick={() => setEditing({ ...EMPTY })}>
          {t('browse.addCard')}
        </button>
      </div>
      <div className="browse-filters" role="search">
        <input
          className="input"
          type="search"
          value={filter.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder={t('browse.search')}
          aria-label={t('browse.search')}
        />
        <select
          className="input"
          aria-label={t('browse.filterDeck')}
          value={filter.deckId ?? ''}
          onChange={(e) => set('deckId', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t('browse.allDecks')}</option>
          {state.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label={t('browse.filterTag')}
          value={filter.tag}
          onChange={(e) => set('tag', e.target.value)}
        >
          <option value="">{t('browse.anyTag')}</option>
          {state.tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label={t('browse.filterState')}
          value={filter.state}
          onChange={(e) => set('state', e.target.value as CardState | '')}
        >
          <option value="">{t('browse.anyState')}</option>
          {CARD_STATES.map((s) => (
            <option key={s} value={s}>
              {t(`browse.state.${s}`)}
            </option>
          ))}
        </select>
      </div>
      {sel.size > 0 && (
        <BulkBar
          count={sel.size}
          decks={state.decks}
          tags={state.tags}
          onApply={(action) => apply([...sel], action)}
          onClear={() => setSel(new Set())}
        />
      )}
      {notice && (
        <p className="small muted browse-notice" role="status">
          {notice}
        </p>
      )}
      <div className="split">
        <CardList
          found={found}
          sel={sel}
          setSel={setSel}
          openId={editing?.id}
          showDeck={filter.deckId === null}
          deckName={deckName}
          onOpen={open}
        />
        {editing ? (
          <CardEditor
            key={editing.id ?? 'new'}
            card={editing}
            deckId={filter.deckId ?? state.activeDeck ?? state.decks[0].id}
            decks={state.decks}
            onClose={() => setEditing(null)}
            onSaved={() => afterChange()}
            onDelete={(id) => apply([id], { kind: 'delete' })}
          />
        ) : (
          <div className="card muted">{t('browse.selectHint')}</div>
        )}
      </div>
    </div>
  );
}

function CardList({
  found,
  sel,
  setSel,
  openId,
  showDeck,
  deckName,
  onOpen,
}: {
  found: Found;
  sel: Set<number>;
  setSel: (s: Set<number>) => void;
  openId?: number;
  showDeck: boolean;
  deckName: Map<number, string>;
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<number | null>(null);
  const [view, setView] = useState({ top: 0, height: 600 });
  const ids = useMemo(() => found.rows.map((r) => r.id), [found.rows]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setView({ top: el.scrollTop, height: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
    anchor.current = null;
  }, [found]);
  const { start, end } = visibleRange(view.top, view.height, ROW, found.rows.length);
  const allOn = ids.length > 0 && ids.every((id) => sel.has(id));

  return (
    <div className={`browse-list${showDeck ? '' : ' one-deck'}`}>
      <div className="browse-row browse-row-head">
        <input
          type="checkbox"
          checked={allOn}
          disabled={ids.length === 0}
          onChange={() => setSel(allOn ? new Set() : new Set(ids))}
          aria-label={t('browse.selectAll', { count: ids.length })}
        />
        <span>{t('browse.colFront')}</span>
        <span>{t('browse.colBack')}</span>
        {showDeck && <span>{t('browse.colDeck')}</span>}
        <span>{t('browse.colState')}</span>
      </div>
      <div
        ref={box}
        className="browse-scroll"
        role="list"
        aria-label={t('browse.title')}
        onScroll={(e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
      >
        {found.rows.length === 0 && <p className="muted browse-empty">{t('browse.noMatch')}</p>}
        <div style={{ height: found.rows.length * ROW, position: 'relative' }}>
          {found.rows.slice(start, end).map((r, k) => {
            const i = start + k;
            return (
              <div
                key={r.id}
                role="listitem"
                className={`browse-row${openId === r.id ? ' open' : ''}${sel.has(r.id) ? ' sel' : ''}${r.suspended ? ' suspended' : ''}`}
                style={{ top: i * ROW }}
              >
                <input
                  type="checkbox"
                  checked={sel.has(r.id)}
                  onClick={(e) => {
                    setSel(selectClick(sel, ids, i, anchor.current, e.shiftKey));
                    anchor.current = i;
                  }}
                  onChange={() => {}}
                  aria-label={t('browse.selectCard', { front: r.front })}
                />
                <button className="browse-open" onClick={() => onOpen(r.id)}>
                  {r.starred && <span aria-label={t('browse.state.starred')}>★ </span>}
                  {r.front}
                </button>
                <span className="muted">{r.back}</span>
                {showDeck && <span className="small muted">{deckName.get(r.deckId)}</span>}
                <span className="small">
                  <span className={`browse-state ${r.state}`}>{t(`browse.state.${r.state}`)}</span>
                  {r.suspended && <span className="browse-state">{t('browse.state.suspended')}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {found.total > found.rows.length && (
        <p className="small muted browse-empty">{t('browse.showingFirst', { count: found.rows.length })}</p>
      )}
    </div>
  );
}

type Pending = 'tag' | 'untag' | 'move' | 'delete' | null;

function BulkBar({
  count,
  decks,
  tags,
  onApply,
  onClear,
}: {
  count: number;
  decks: AppState['decks'];
  tags: string[];
  onApply: (action: BulkAction) => Promise<void>;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Pending>(null);
  const [tag, setTag] = useState('');
  const [deckId, setDeckId] = useState(decks[0]?.id ?? 0);
  const confirm = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (pending === 'delete') confirm.current?.showModal?.();
  }, [pending]);
  const run = async (action: BulkAction) => {
    setPending(null);
    setTag('');
    await onApply(action);
  };
  const cleanTag = tag.trim().replace(/\s+/g, '-');

  return (
    <div className="panel browse-bulk" role="toolbar" aria-label={t('browse.bulk.label')}>
      <b>{t('browse.bulk.selected', { count })}</b>
      <button className="btn ghost" onClick={() => setPending('tag')} aria-pressed={pending === 'tag'}>
        {t('browse.bulk.tag')}
      </button>
      <button className="btn ghost" onClick={() => setPending('untag')} aria-pressed={pending === 'untag'}>
        {t('browse.bulk.untag')}
      </button>
      <button className="btn ghost" onClick={() => setPending('move')} aria-pressed={pending === 'move'}>
        {t('browse.bulk.move')}
      </button>
      <button className="btn ghost" onClick={() => run({ kind: 'suspend' })}>
        {t('browse.bulk.suspend')}
      </button>
      <button className="btn ghost" onClick={() => run({ kind: 'unsuspend' })}>
        {t('browse.bulk.unsuspend')}
      </button>
      <button className="btn danger" onClick={() => setPending('delete')}>
        {t('common.delete')}
      </button>
      <button className="btn ghost" onClick={onClear}>
        {t('browse.bulk.clear')}
      </button>
      {(pending === 'tag' || pending === 'untag') && (
        <form
          className="browse-bulk-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanTag) run({ kind: pending, tag: cleanTag });
          }}
        >
          <input
            className="input"
            list="browse-tags"
            autoFocus
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            aria-label={t('browse.bulk.tagName')}
            placeholder={t('browse.bulk.tagName')}
          />
          <datalist id="browse-tags">
            {tags.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <button className="btn primary" disabled={!cleanTag}>
            {t('browse.bulk.apply')}
          </button>
        </form>
      )}
      {pending === 'move' && (
        <form
          className="browse-bulk-form"
          onSubmit={(e) => {
            e.preventDefault();
            run({ kind: 'move', deckId });
          }}
        >
          <select
            className="input"
            autoFocus
            value={deckId}
            onChange={(e) => setDeckId(Number(e.target.value))}
            aria-label={t('browse.bulk.moveTo')}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button className="btn primary">{t('browse.bulk.apply')}</button>
        </form>
      )}
      <dialog
        ref={confirm}
        className="panel session-dialog"
        aria-labelledby="bulk-delete-title"
        onClose={() => setPending((p) => (p === 'delete' ? null : p))}
      >
        <h2 id="bulk-delete-title">{t('browse.bulk.deleteTitle', { count })}</h2>
        <p>{t('browse.bulk.deleteBody', { count })}</p>
        <div className="session-dialog-actions">
          <button className="btn danger" onClick={() => run({ kind: 'delete' })}>
            {t('common.delete')}
          </button>
          <button className="btn primary" autoFocus onClick={() => confirm.current?.close()}>
            {t('browse.bulk.keep', { count })}
          </button>
        </div>
      </dialog>
    </div>
  );
}
