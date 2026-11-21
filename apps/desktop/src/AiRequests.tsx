// AI requests (#148): every change an AI assistant proposed, one card each. Nothing changes until the user
// accepts one (after editing it, if they like); declining just removes it. The list is checked again every
// few seconds, so a new proposal shows up while the screen is open.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutputOf } from '../backend/handlers';
import type { AiRequest } from '@lernlab/core/airequests';
import { api } from './api';
import { formatDate } from './i18n';
import { Button, Card, Input } from './components';
import {
  CHANGE_FIELDS,
  VALUE_FIELDS,
  VALUE_LIMITS,
  acceptedBody,
  draftOf,
  editCard,
  editChange,
  editValue,
  keptCards,
  keptIds,
  toggleCard,
  toggleId,
  type Draft,
  type ValueField,
} from './requests-logic';

type List = OutputOf<'aiRequests.list'>;
type Deck = List['decks'][number];
type Snapshot = List['cards'][number];
/** Rows shown for a merge or tidy-up; the rest are included and counted. */
const ROWS_SHOWN = 200;

/** One proposed request's title. */
function useTitle(request: AiRequest, decks: Deck[], cards: Map<number, Snapshot>, count: number) {
  const { t } = useTranslation();
  const deckName = (id: number) => decks.find((d) => d.id === id)?.name ?? `#${id}`;
  const front = (id: number) => cards.get(id)?.front ?? `#${id}`;
  switch (request.kind) {
    case 'create_deck':
      return t('requests.newDeck', { name: request.deck.name });
    case 'add_cards':
      return t('requests.addCards', { deck: deckName(request.deckId) });
    case 'edit_card':
      return t('requests.fixCard', { front: front(request.cardId) });
    case 'merge_cards':
      return t('requests.mergeCards', { front: front(request.keepId) });
    case 'set_goals':
      return t('requests.goals');
    case 'study_plan':
      return t('requests.plan', { deck: deckName(request.deckId) });
    case 'export_deck':
      return t('requests.export', { deck: deckName(request.deckId) });
    case 'organise_cards': {
      const a = request.action;
      return t(`requests.organise.${a.kind}`, {
        count,
        tag: 'tag' in a ? a.tag : '',
        deck: 'deckId' in a ? deckName(a.deckId) : '',
      });
    }
  }
}

/** The proposed field changes: each field as it is now, and the proposal, which the user can edit. */
function Changes({
  p,
  draft,
  setDraft,
  now,
}: {
  p: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  now?: Snapshot;
}) {
  const { t } = useTranslation();
  const fields = CHANGE_FIELDS.filter((f) => draft.changes[f] !== undefined);
  if (!fields.length) return null;
  return (
    <div className="request-fields">
      {fields.map((field) => {
        const before = now ? (field === 'tags' ? now.tags.join(' ') : now[field]) : '';
        return (
          <div key={field} className="request-field">
            <label htmlFor={`${p}-${field}`}>{t(`requests.field.${field}`)}</label>
            <p className="request-now">{before ? t('requests.now', { text: before }) : t('requests.nowEmpty')}</p>
            <input
              id={`${p}-${field}`}
              className="input"
              value={draft.changes[field]}
              onChange={(e) => setDraft(editChange(draft, field, e.target.value))}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Existing cards a merge or tidy-up touches, each with a checkbox to leave it out. */
function CardChecklist({
  draft,
  setDraft,
  cards,
  label,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  cards: Map<number, Snapshot>;
  label: string;
}) {
  const { t } = useTranslation();
  const more = draft.ids.length - ROWS_SHOWN;
  return (
    <>
      <ul className="request-checklist" aria-label={label}>
        {draft.ids.slice(0, ROWS_SHOWN).map((id, i) => {
          const c = cards.get(id);
          return (
            <li key={id} className={draft.keepIds[i] ? undefined : 'off'}>
              <input
                type="checkbox"
                id={`req-card-${id}-${i}`}
                checked={draft.keepIds[i]}
                onChange={() => setDraft(toggleId(draft, i))}
              />
              <label htmlFor={`req-card-${id}-${i}`}>
                {c ? (
                  <>
                    <b>{c.front}</b> <span>{c.back}</span>
                  </>
                ) : (
                  t('requests.missingCard', { id })
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {more > 0 && <p className="settings-hint">{t('requests.more', { count: more })}</p>}
    </>
  );
}

/** Goals, a study plan or an export format: each value as it is now, and the proposal, which the user can edit. */
function Values({
  p,
  draft,
  setDraft,
  now,
}: {
  p: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  now: Partial<Record<ValueField, string | number>>;
}) {
  const { t } = useTranslation();
  const fields = VALUE_FIELDS.filter((f) => draft.values[f] !== undefined);
  return (
    <div className="request-fields">
      {fields.map((field) => {
        const before = now[field];
        const id = `${p}-${field}`;
        const set = (text: string) => setDraft(editValue(draft, field, text));
        return (
          <div key={field} className="request-field">
            <label htmlFor={id}>{t(`requests.value.${field}`)}</label>
            {field !== 'format' && (
              <p className="request-now">
                {before === undefined || before === '' ? t('requests.nowEmpty') : t('requests.now', { text: before })}
              </p>
            )}
            {field === 'format' ? (
              <select id={id} className="input" value={draft.values.format} onChange={(e) => set(e.target.value)}>
                <option value="lernpack">{t('requests.format.lernpack')}</option>
                <option value="csv">{t('requests.format.csv')}</option>
              </select>
            ) : (
              <input
                id={id}
                className="input"
                type={field === 'examDate' ? 'date' : field === 'goalLabel' ? 'text' : 'number'}
                inputMode={field === 'examDate' || field === 'goalLabel' ? undefined : 'numeric'}
                min={field === 'dailyGoalSessions' ? VALUE_LIMITS.dailyGoalSessions[0] : undefined}
                value={draft.values[field]}
                onChange={(e) => set(e.target.value)}
              />
            )}
          </div>
        );
      })}
      {draft.values.format !== undefined && <p className="settings-hint">{t('requests.exportHint')}</p>}
    </div>
  );
}

function RequestCard({
  request,
  list,
  cards,
  done,
}: {
  request: AiRequest;
  list: List;
  cards: Map<number, Snapshot>;
  done: (msg: string) => void;
}) {
  const decks = list.decks;
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => draftOf(request));
  const [busy, setBusy] = useState(false);
  const body = acceptedBody(request, draft);
  const chosen = keptIds(draft).length;
  const title = useTitle(request, decks, cards, request.kind === 'organise_cards' ? chosen : 0);
  const p = `req-${request.id}`;
  const adds = request.kind === 'create_deck' || request.kind === 'add_cards';

  const act = async (accept: boolean) => {
    setBusy(true);
    try {
      if (accept && body && request.kind === 'export_deck') {
        // The file is saved where the user chooses; then the request is done.
        await api.exportDeck(request.deckId, body.format === 'csv' ? 'csv' : 'lernpack');
        await api.acceptAiRequest(request.id, body);
        done(t('requests.exported'));
      } else if (accept && body) {
        const r = await api.acceptAiRequest(request.id, body);
        done(
          adds
            ? t('requests.accepted', { count: r.added })
            : request.kind === 'set_goals' || request.kind === 'study_plan'
              ? t('requests.saved')
              : t('requests.changed', { count: r.updated }),
        );
      } else {
        await api.declineAiRequest(request.id);
        done(t('requests.declined'));
      }
    } catch (err) {
      setBusy(false);
      done((err as Error).message);
    }
  };

  const plan = request.kind === 'study_plan' ? decks.find((d) => d.id === request.deckId)?.plan : undefined;
  const now: Partial<Record<ValueField, string | number>> =
    request.kind === 'set_goals'
      ? list.goals
      : {
          examDate: plan?.examDate ?? '',
          goalLabel: plan?.goal?.label ?? '',
          goalWords: plan?.goal?.words ?? '',
          newPerDay: plan?.newPerDay ?? '',
        };
  const acceptLabel = {
    create_deck: () => t('requests.accept', { count: keptCards(draft).length }),
    add_cards: () => t('requests.accept', { count: keptCards(draft).length }),
    edit_card: () => t('requests.acceptFix'),
    merge_cards: () => t('requests.acceptMerge', { count: chosen }),
    organise_cards: () => t('requests.acceptOrganise', { count: chosen }),
    set_goals: () => t('requests.acceptGoals'),
    study_plan: () => t('requests.acceptPlan'),
    export_deck: () => t('requests.acceptExport'),
  }[request.kind]();

  return (
    <Card as="section" className="request" aria-labelledby={`${p}-title`}>
      <div className="request-head">
        <h2 id={`${p}-title`}>{title}</h2>
        <span className="request-when">
          {formatDate(request.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
      {request.note && (
        <p className="request-note">
          <b>{t('requests.note')}</b> {request.note}
        </p>
      )}
      {request.kind === 'create_deck' && (
        <Input
          id={`${p}-deck`}
          label={t('requests.deckName')}
          className="field request-deck"
          value={draft.deckName}
          onChange={(e) => setDraft({ ...draft, deckName: e.target.value })}
        />
      )}
      {adds && (
        <ol className="request-cards" aria-label={t('requests.cards', { count: draft.cards.length })}>
          {draft.cards.map((c, i) => (
            <li key={i} className={draft.keep[i] ? undefined : 'off'}>
              <input
                type="checkbox"
                checked={draft.keep[i]}
                aria-label={t('requests.keep', { front: c.front })}
                onChange={() => setDraft(toggleCard(draft, i))}
              />
              <input
                className="input"
                value={c.front}
                aria-label={t('requests.front', { n: i + 1 })}
                onChange={(e) => setDraft(editCard(draft, i, { front: e.target.value }))}
              />
              <input
                className="input"
                value={c.back}
                aria-label={t('requests.back', { n: i + 1 })}
                onChange={(e) => setDraft(editCard(draft, i, { back: e.target.value }))}
              />
            </li>
          ))}
        </ol>
      )}
      {request.kind === 'edit_card' && (
        <Changes p={p} draft={draft} setDraft={setDraft} now={cards.get(request.cardId)} />
      )}
      {request.kind === 'merge_cards' && (
        <>
          <h3 className="request-sub">{t('requests.keepCard')}</h3>
          <p className="request-kept">
            <b>{cards.get(request.keepId)?.front ?? `#${request.keepId}`}</b>{' '}
            <span>{cards.get(request.keepId)?.back}</span>
          </p>
          <Changes p={p} draft={draft} setDraft={setDraft} now={cards.get(request.keepId)} />
          <h3 className="request-sub">{t('requests.duplicates')}</h3>
          <CardChecklist draft={draft} setDraft={setDraft} cards={cards} label={t('requests.duplicates')} />
        </>
      )}
      {request.kind === 'organise_cards' && (
        <CardChecklist
          draft={draft}
          setDraft={setDraft}
          cards={cards}
          label={t('requests.cards', { count: draft.ids.length })}
        />
      )}
      {(request.kind === 'set_goals' || request.kind === 'study_plan' || request.kind === 'export_deck') && (
        <Values p={p} draft={draft} setDraft={setDraft} now={now} />
      )}
      <div className="request-actions">
        <Button onClick={() => act(false)} disabled={busy}>
          {t('requests.decline')}
        </Button>
        <Button variant="primary" onClick={() => act(true)} disabled={busy || !body}>
          {acceptLabel}
        </Button>
      </div>
    </Card>
  );
}

export function AiRequests({ assistantOn, refresh }: { assistantOn: boolean; refresh: () => void }) {
  const { t } = useTranslation();
  const [list, setList] = useState<List | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api.aiRequests().then(setList, (err: Error) => setMsg(err.message));
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(id);
  }, [msg]);
  const done = (text: string) => {
    setMsg(text);
    load();
    refresh();
  };
  const cards = new Map((list?.cards ?? []).map((c) => [c.id, c]));

  return (
    <div className="requests">
      <p className="requests-lead">{t('requests.lead')}</p>
      <div role="status" aria-live="polite">
        {msg && <span className="toast">{msg}</span>}
      </div>
      {list && !list.requests.length && (
        <Card className="requests-empty">
          <p>{t('requests.empty')}</p>
          {!assistantOn && <p className="settings-hint">{t('requests.off')}</p>}
        </Card>
      )}
      {list?.requests.map((r) => (
        <RequestCard key={r.id} request={r} list={list} cards={cards} done={done} />
      ))}
    </div>
  );
}
