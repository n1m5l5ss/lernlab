// Study together (#224): two people on one computer take turns on a deck. Each round is asked from, and
// saved to, the progress of the person whose turn it is. There are no scores side by side and no winner.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionPlan } from '@lernlab/core/types';
import type { OutputOf } from '../backend/handlers';
import { api, attemptsSaved, setActingLearner } from './api';
import { Button, Input, Select } from './components';
import { Session, type SessionResult } from './Session';
import { addTurn, turnsOf, type FinishBody } from './together-logic';

type AppState = OutputOf<'state.get'>;
type Learner = AppState['learners'][number];
export type TogetherPlans = { partner: Learner; mine: SessionPlan; theirs: SessionPlan };

/** On Home, once someone else has been added: pick who and which deck, then start. */
export function TogetherStart({ state, onStart }: { state: AppState; onStart: (p: TogetherPlans) => void }) {
  const { t } = useTranslation();
  const [who, setWho] = useState(state.learners[0]?.id ?? '');
  const firstDeck = state.source.kind === 'deck' ? state.source.deckId : state.decks[0]?.id;
  const [deckId, setDeckId] = useState(firstDeck ?? 0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const partner = state.learners.find((l) => l.id === who) ?? state.learners[0];
  if (!partner || !state.decks.length) return null;
  const start = async () => {
    setBusy(true);
    setMsg('');
    try {
      const [mine, theirs] = [await api.sessionFor(null, deckId), await api.sessionFor(partner.id, deckId)];
      if (!turnsOf(mine, theirs, partner.id).length) setMsg(t('together.nothing'));
      else onStart({ partner, mine, theirs });
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <section className="panel together-start" aria-labelledby="together-title">
      <h2 id="together-title">{t('together.title')}</h2>
      <p className="muted">{t('together.lead')}</p>
      <div className="home-choices">
        {state.learners.length > 1 && (
          <Select
            id="together-who"
            label={t('together.with')}
            className="home-field"
            value={partner.id}
            onChange={(e) => setWho(e.target.value)}
          >
            {state.learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          id="together-deck"
          label={t('together.deck')}
          className="home-field"
          value={deckId}
          onChange={(e) => setDeckId(Number(e.target.value))}
        >
          {state.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Button onClick={start} disabled={busy}>
          {t('together.start', { name: partner.name })}
        </Button>
      </div>
      <p role="status" className="muted">
        {msg}
      </p>
    </section>
  );
}

/** The session itself: a hand-over screen before each turn, the round, and a quiet end. */
export function Together({
  plans,
  ownerName,
  settings,
  onDone,
}: {
  plans: TogetherPlans;
  ownerName: string;
  settings: AppState['settings'];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [turns] = useState(() => turnsOf(plans.mine, plans.theirs, plans.partner.id));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'pass' | 'play' | 'saving' | 'done'>('pass');
  const totals = useRef(new Map<string | null, FinishBody>());
  const heading = useRef<HTMLHeadingElement>(null);
  // Whatever happens to this screen, answers go back to the first learner afterwards.
  useEffect(() => () => setActingLearner(null), []);
  useEffect(() => heading.current?.focus(), [i, phase]);
  const nameOf = (learner: string | null) => (learner ? plans.partner.name : ownerName || t('together.firstLearner'));

  const end = async () => {
    setActingLearner(null);
    setPhase('saving');
    await attemptsSaved();
    // Each person's turns are recorded as one session of their own (streak, minutes, XP).
    for (const [who, body] of totals.current) await api.finishFor(who, body).catch(() => null);
    setPhase('done');
  };
  const turnDone = (r: SessionResult) => {
    const who = turns[i].learner;
    totals.current.set(who, addTurn(totals.current.get(who), r));
    setActingLearner(null);
    if (r.left || i + 1 >= turns.length) return void end();
    setI(i + 1);
    setPhase('pass');
  };

  const turn = turns[i];
  if (phase === 'play' && turn)
    return (
      <Session
        key={i}
        plan={turn.plan}
        settings={settings}
        onFinish={turnDone}
        onQuit={() => void end()} // left before answering anything this turn
      />
    );
  if (phase === 'saving') return <div className="wrap muted">{t('app.loading')}</div>;
  if (phase === 'done' || !turn)
    return (
      <main className="summary together-end">
        <h1 ref={heading} tabIndex={-1}>
          {t('together.doneTitle')}
        </h1>
        <p>{t('together.doneBody', { a: nameOf(null), b: plans.partner.name })}</p>
        <div className="summary-actions">
          <Button variant="primary" onClick={onDone}>
            {t('together.doneAction')}
          </Button>
        </div>
      </main>
    );
  return (
    <main className="summary together-pass">
      <p className="summary-kicker">{t('together.turn', { n: i + 1, total: turns.length })}</p>
      <h1 ref={heading} tabIndex={-1}>
        {t('together.turnOf', { name: nameOf(turn.learner) })}
      </h1>
      <p className="muted">{t('together.passHint', { name: nameOf(turn.learner) })}</p>
      <div className="summary-actions">
        <Button onClick={() => void end()}>{t('together.stop')}</Button>
        <Button
          variant="primary"
          autoFocus
          onClick={() => {
            setActingLearner(turn.learner);
            setPhase('play');
          }}
        >
          {t('together.go')}
        </Button>
      </div>
    </main>
  );
}

/** Settings: the people who study on this computer. Names only: no accounts, no passwords, nothing online. */
export function LearnersSettings({ state, onSaved }: { state: AppState; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [mine, setMine] = useState(state.settings.learnerName);
  const [msg, setMsg] = useState('');
  const [removing, setRemoving] = useState<Learner | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const run = (work: Promise<unknown>, done: string) =>
    work.then(
      () => {
        setMsg(done);
        onSaved();
      },
      (e: Error) => setMsg(e.message),
    );
  return (
    <>
      <p className="settings-hint">{t('learners.lead')}</p>
      <Input
        id="learner-me"
        label={t('learners.myName')}
        hint={t('learners.myNameHint')}
        className="field settings-row"
        maxLength={40}
        value={mine}
        onChange={(e) => setMine(e.target.value)}
        onBlur={() => mine !== state.settings.learnerName && void run(api.saveSettings({ learnerName: mine }), '')}
      />
      {state.learners.length > 0 && (
        <ul className="learners" aria-label={t('learners.others')}>
          {state.learners.map((l) => (
            <li key={l.id}>
              <span>{l.name}</span>
              <Button
                onClick={() => {
                  setRemoving(l);
                  dialog.current?.showModal();
                  keep.current?.focus();
                }}
              >
                {t('learners.remove', { name: l.name })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="learners-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            void run(api.addLearner(name), t('learners.added', { name: name.trim() })).then(() => setName(''));
        }}
      >
        <Input
          id="learner-new"
          label={t('learners.add')}
          hint={t('learners.addHint')}
          className="field"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={!name.trim()}>
          {t('learners.addAction')}
        </Button>
      </form>
      <p className="settings-hint">{t('learners.dataHint')}</p>
      <p role="status" className="muted">
        {msg}
      </p>
      <dialog ref={dialog} className="panel session-dialog" aria-labelledby="learner-remove-title">
        <h2 id="learner-remove-title">{t('learners.removeTitle', { name: removing?.name })}</h2>
        <p className="muted">{t('learners.removeBody', { name: removing?.name })}</p>
        <div className="session-dialog-actions">
          <button
            className="btn"
            onClick={() => {
              dialog.current?.close();
              if (removing) void run(api.removeLearner(removing.id), t('learners.removed', { name: removing.name }));
            }}
          >
            {t('learners.removeConfirm')}
          </button>
          <button ref={keep} className="btn primary" onClick={() => dialog.current?.close()}>
            {t('learners.keep')}
          </button>
        </div>
      </dialog>
    </>
  );
}
