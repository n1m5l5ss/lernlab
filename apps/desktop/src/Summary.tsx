// The end of a session: what you recalled, what you earned, and the cards that come back tomorrow.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motionReduced } from './display';
import { useTranslation } from 'react-i18next';
import type { Item } from '@lernlab/core/types';
import type { OutputOf } from '../backend/handlers';
import { sfx } from './audio';
import { useKeys } from './ctx';
import { controlOwnsKey } from './keys-logic';
import { formatNumber } from './i18n';
import { Rich } from './rich';
import type { SessionResult } from './Session';
import { dayDate, MotivationIcon, MAX_FREEZES, type MotivationIconKind } from './Motivation';
import { celebrates, summaryFacts, summaryMoments, tomorrowCards, tomorrowReport, type Moment } from './summary-logic';
import { rewardLines } from './reward-logic';
import { qa } from '@lernlab/core/cards';
import type { TomorrowAnswer } from '@lernlab/core/tomorrow';
import { api } from './api';
import { SegmentedControl, SideBySide } from './components';

export function Summary({
  result,
  server,
  items,
  lang,
  calm = false,
  onAgain,
  onHome,
  onStudyTag,
}: {
  result: SessionResult;
  server: OutputOf<'session.finish'> | null;
  items: Record<number, Item>;
  lang: string | null;
  /** Calm mode (#216): no XP, level, badge news, confetti or level-up sound; everything else stays. */
  calm?: boolean;
  onAgain: () => void;
  onHome: () => void;
  /** Starts a session on one tag: the next step for misses that sit in that tag (#213). */
  onStudyTag?: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const f = useMemo(() => summaryFacts(result, server, items), [result, server, items]);
  const moments = useMemo(() => summaryMoments(f, server, calm), [f, server, calm]);
  // What the XP was for (#216): the lines add up to the number in the tile.
  const rewards = useMemo(
    () =>
      calm
        ? []
        : rewardLines(
            result.rewards,
            server && {
              perfectBlocks: result.perfectBlocks,
              goalMetNow: !!server.goalMetNow,
              bossWon: !!result.bossWon,
            },
          ),
    [result, server, calm],
  );
  const tomorrow = useMemo(() => tomorrowCards(result, items, qa), [result, items]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus(); // screen readers announce the result first
    if (f.levelUp && !calm) sfx.levelUp();
    else sfx.win();
    // A celebration only at the end, only for a real milestone, and never in calm mode.
    if (celebrates(f, server, calm) && !motionReduced())
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
  }, []);
  useKeys((e) => {
    if (controlOwnsKey(e.key, e.target as Element | null)) return; // Space on "Done" means Done
    if (e.key === 'Enter') {
      e.preventDefault();
      onHome();
    }
    if (e.key === ' ') {
      e.preventDefault();
      onAgain();
    }
  });
  /** The icon, headline and line of text for one moment. */
  const momentText = (m: Moment): [MotivationIconKind, string, string] => {
    const st = server?.streak;
    switch (m.kind) {
      case 'level':
        return ['level', t('summary.moments.levelTitle', { level: m.level }), t('summary.moments.levelBody')];
      case 'badge':
        return [
          'badge',
          t('summary.moments.badgeTitle', { title: t(`badges.${m.key}.title`) }),
          t(`badges.${m.key}.desc`),
        ];
      case 'freeze':
        return [
          'freeze',
          t('summary.moments.freezeTitle'),
          t('summary.moments.freezeBody', { count: st?.freezes ?? 1, max: MAX_FREEZES }),
        ];
      case 'repaired':
        return [
          'repair',
          t('summary.moments.repairedTitle'),
          t('summary.moments.repairedBody', { count: st?.current ?? 0 }),
        ];
      case 'repairProgress':
        return [
          'repair',
          t('summary.moments.repairTitle', { done: m.done }),
          st?.repair
            ? t('summary.moments.repairBody', { count: st.repair.value, deadline: dayDate(st.repair.deadline) })
            : '',
        ];
    }
  };
  return (
    <main className="summary">
      <p className="summary-kicker">
        {t(result.practice ? 'summary.kickerPractice' : 'summary.kicker', { count: f.minutes })}
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {f.total ? t('summary.recalled', { count: f.recalled, total: f.total }) : t('summary.noAnswers')}
      </h1>
      {result.practice && <p className="summary-note">{t('summary.practice')}</p>}
      {server?.tomorrowCheck && <TomorrowReport report={server.tomorrowCheck} />}
      <div className={calm ? 'summary-tiles summary-tiles-calm' : 'summary-tiles'}>
        <section className="panel summary-tile">
          <b>{formatNumber(f.introduced)}</b>
          <span>{t('summary.introduced', { count: f.introduced })}</span>
        </section>
        {!calm && (
          <section className="panel summary-tile">
            <b>{t('summary.xp', { xp: f.xp })}</b>
            {f.level && (
              <>
                <div className="meter" aria-hidden="true">
                  <i style={{ width: `${f.level.percent}%` }} />
                </div>
                <span className="small">{t('summary.toLevel', { xp: f.level.toNext, level: f.level.next })}</span>
              </>
            )}
          </section>
        )}
        <section className="panel summary-tile">
          <b>{f.daysThisWeek === null ? '–' : t('summary.daysOf', { count: f.daysThisWeek })}</b>
          <span>{t('summary.daysThisWeek')}</span>
        </section>
      </div>
      {rewards.length > 0 && (
        <section className="panel summary-rewards" aria-labelledby="summary-rewards">
          <h2 id="summary-rewards">{t('summary.rewardsTitle')}</h2>
          <ul>
            {rewards.map((r) => (
              <li key={r.reason}>
                <b>{t('summary.rewardXp', { xp: r.xp })}</b>
                <span>{t(`summary.rewards.${r.reason}`, { count: r.count })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(moments.length > 0 || server?.goalMetNow || result.bossWon) && (
        <section className="panel summary-moments" aria-labelledby="summary-moments">
          <h2 id="summary-moments" className="sr-only">
            {t('summary.momentsTitle')}
          </h2>
          <ul>
            {moments.map((m) => {
              const [kind, title, body] = momentText(m);
              return (
                <li key={m.kind === 'badge' ? `badge-${m.key}` : m.kind} className={`moment moment-${m.kind}`}>
                  <MotivationIcon kind={kind} />
                  <div>
                    <b>{title}</b>
                    {body && <span className="muted">{body}</span>}
                  </div>
                </li>
              );
            })}
            {server?.goalMetNow && (
              <li className="moment">
                <MotivationIcon kind="goal" />
                <b>{t('summary.goalReached')}</b>
              </li>
            )}
            {result.bossWon && (
              <li className="moment">
                <MotivationIcon kind="boss" />
                <b>{t('summary.bossDefeated')}</b>
              </li>
            )}
          </ul>
        </section>
      )}
      {server?.patterns && <Patterns patterns={server.patterns} onStudyTag={onStudyTag} />}
      {f.missed.length > 0 && (
        <section className="panel summary-missed" aria-labelledby="summary-missed">
          <h2 id="summary-missed">
            {t(result.practice ? 'summary.missedPractice' : 'summary.missed', { count: result.missed.length })}
          </h2>
          <ul>
            {f.missed.map((it) => (
              <li key={it.id}>
                <b lang={lang ?? undefined}>
                  <Rich html={it.target} />
                </b>
                <span className="muted">
                  <Rich html={it.meaning} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {server?.twinOffer && <TwinOffer offer={server.twinOffer} lang={lang} />}
      <TomorrowCheck cards={tomorrow} lang={lang} />
      <div className="summary-actions">
        <button className="btn" onClick={onAgain}>
          {t('summary.again')} <span className="kbd">{t('summary.againKey')}</span>
        </button>
        <button className="btn primary" onClick={onHome}>
          {t('summary.done')} <span className="kbd">{t('summary.doneKey')}</span>
        </button>
      </div>
    </main>
  );
}

/**
 * "Will you know this tomorrow?" (#205): today's new cards, question only, each with yes, not sure or no. Every
 * answer is saved at once; nothing here is required, marked or changes when a card is next due.
 */
function TomorrowCheck({ cards, lang }: { cards: { id: number; prompt: string }[]; lang: string | null }) {
  const { t } = useTranslation();
  const id = useId();
  const [answers, setAnswers] = useState<Record<number, TomorrowAnswer>>({});
  if (!cards.length) return null;
  const choose = (itemId: number, answer: TomorrowAnswer) => {
    setAnswers((a) => ({ ...a, [itemId]: answer }));
    void api.saveTomorrow([{ itemId, answer }]).catch(() => {});
  };
  const options = (['yes', 'unsure', 'no'] as const).map((value) => ({ value, label: t(`summary.tomorrow.${value}`) }));
  return (
    <section className="panel tomorrow" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('summary.tomorrow.title')}</h2>
      <p className="muted">{t('summary.tomorrow.lead')}</p>
      <ul>
        {cards.map((c) => (
          <li key={c.id}>
            <span id={`${id}-${c.id}`} className="tomorrow-q" lang={lang ?? undefined}>
              <Rich html={c.prompt} />
            </span>
            <SegmentedControl
              value={answers[c.id] ?? null}
              options={options}
              onChange={(a) => choose(c.id, a)}
              labelledBy={`${id}-${c.id}`}
              className="tomorrow-choice"
            />
          </li>
        ))}
      </ul>
      <p className="small muted" role="status">
        {Object.keys(answers).length > 0 && t('summary.tomorrow.saved')}
      </p>
    </section>
  );
}

/** How the last "Will you know this tomorrow?" held up, now that its cards came back (#205). */
function TomorrowReport({ report }: { report: NonNullable<OutputOf<'session.finish'>['tomorrowCheck']> }) {
  const { t } = useTranslation();
  const lines = tomorrowReport(report.groups);
  if (!lines.length) return null;
  return (
    <section className="panel tomorrow-report" aria-labelledby="tomorrow-report">
      <h2 id="tomorrow-report">{t('summary.tomorrow.reportTitle', { date: dayDate(report.day) })}</h2>
      <ul>
        {lines.map((l) => (
          <li key={l.answer}>{t(`summary.tomorrow.report.${l.answer}`, { count: l.reviewed, right: l.right })}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Two cards that keep getting mixed up (#200): both side by side, with an offer to add a compare card. The
 * learner may write what they share and the key difference first; it becomes the card's answer. Optional, and
 * "Not now" is remembered: a pair is offered once.
 */
function TwinOffer({
  offer,
  lang,
}: {
  offer: NonNullable<OutputOf<'session.finish'>['twinOffer']>;
  lang: string | null;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<'open' | 'added' | 'failed' | 'closed'>('open');
  const pair = { a: offer.a.id, b: offer.b.id };
  const add = () =>
    void api
      .makeTwin({ ...pair, answer })
      .then(() => setState('added'))
      .catch(() => setState('failed'));
  const dismiss = () => {
    setState('closed');
    void api.dismissTwin(pair).catch(() => {});
  };
  const sideOf = (c: { front: string; back: string }) => (
    <>
      <b>{c.front}</b>
      <span>{c.back}</span>
    </>
  );
  if (state === 'closed') return null;
  return (
    <section className="panel twin-offer" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('summary.twin.title', { count: offer.count })}</h2>
      <SideBySide label={t('ex.twin.sides')} lang={lang ?? undefined} left={sideOf(offer.a)} right={sideOf(offer.b)} />
      {state === 'added' ? (
        <p role="status">{t('summary.twin.added')}</p>
      ) : (
        <>
          <p className="muted">{t('summary.twin.lead')}</p>
          <label className="lbl" htmlFor={`${id}-answer`}>
            {t('ex.twin.question')}
          </label>
          <textarea
            id={`${id}-answer`}
            className="input twin-answer"
            value={answer}
            maxLength={2000}
            placeholder={t('summary.twin.placeholder')}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="actions">
            <button className="btn" onClick={add}>
              {t('summary.twin.add')}
            </button>
            <button className="btn ghost" onClick={dismiss}>
              {t('summary.twin.notNow')}
            </button>
          </div>
          {state === 'failed' && <p role="alert">{t('errors.failed')}</p>}
        </>
      )}
    </section>
  );
}

/**
 * How the session went (#213): up to three lines from the session's own answers, about the cards and the
 * strategy and never about the learner, with one suggested next step. Plain information: no XP and no
 * celebration, so it is the same in calm mode.
 */
function Patterns({
  patterns,
  onStudyTag,
}: {
  patterns: NonNullable<OutputOf<'session.finish'>['patterns']>;
  onStudyTag?: (tag: string) => void;
}) {
  const { t } = useTranslation();
  if (!patterns.lines.length) return null;
  const tag = patterns.lines.find((l) => l.kind === 'tag');
  const line = (l: (typeof patterns.lines)[number]) => {
    switch (l.kind) {
      case 'tag':
        return t('summary.patterns.tag', { count: l.missed, tag: l.tag });
      case 'hints':
        return t('summary.patterns.hints', { count: l.answers, used: l.used });
      default:
        return t(`summary.patterns.${l.kind}`, { count: l.count });
    }
  };
  return (
    <section className="panel summary-patterns" aria-labelledby="summary-patterns">
      <h2 id="summary-patterns">{t('summary.patterns.title')}</h2>
      <ul>
        {patterns.lines.map((l) => (
          <li key={l.kind}>{line(l)}</li>
        ))}
      </ul>
      {patterns.next && (
        <p className="summary-patterns-next">
          <b>{t('summary.patterns.nextLabel')}</b> {t(`summary.patterns.next.${patterns.next}`)}
          {patterns.next === 'tag' && tag?.kind === 'tag' && onStudyTag && (
            <button className="btn" onClick={() => onStudyTag(tag.tag)}>
              {t('summary.patterns.studyTag', { tag: tag.tag })}
            </button>
          )}
        </p>
      )}
    </section>
  );
}
