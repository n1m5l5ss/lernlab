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
import { acceptedBody, draftOf, editCard, keptCards, toggleCard } from './requests-logic';

type List = OutputOf<'aiRequests.list'>;
type Deck = List['decks'][number];

function RequestCard({ request, decks, done }: { request: AiRequest; decks: Deck[]; done: (msg: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => draftOf(request));
  const [busy, setBusy] = useState(false);
  const body = acceptedBody(request, draft);
  const deckName =
    request.kind === 'add_cards' ? (decks.find((d) => d.id === request.deckId)?.name ?? `#${request.deckId}`) : '';
  const p = `req-${request.id}`;

  const act = async (accept: boolean) => {
    setBusy(true);
    try {
      if (accept && body) {
        const r = await api.acceptAiRequest(request.id, body);
        done(t('requests.accepted', { count: r.added }));
      } else {
        await api.declineAiRequest(request.id);
        done(t('requests.declined'));
      }
    } catch (err) {
      setBusy(false);
      done((err as Error).message);
    }
  };

  return (
    <Card as="section" className="request" aria-labelledby={`${p}-title`}>
      <div className="request-head">
        <h2 id={`${p}-title`}>
          {request.kind === 'create_deck'
            ? t('requests.newDeck', { name: request.deck.name })
            : t('requests.addCards', { deck: deckName })}
        </h2>
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
      <div className="request-actions">
        <Button onClick={() => act(false)} disabled={busy}>
          {t('requests.decline')}
        </Button>
        <Button variant="primary" onClick={() => act(true)} disabled={busy || !body}>
          {t('requests.accept', { count: keptCards(draft).length })}
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
        <RequestCard key={r.id} request={r} decks={list.decks} done={done} />
      ))}
    </div>
  );
}
