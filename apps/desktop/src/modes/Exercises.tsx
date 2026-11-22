import { Trans, useTranslation } from 'react-i18next';
import type React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Exercise, Item } from '@lernlab/core/types';
import { similarity, normalize, stripHtml, type CheckResult } from '@lernlab/core/text';
import { hasMath } from '@lernlab/core/math';
import { GAP } from '@lernlab/core/code';
import { replaceClozes } from '@lernlab/core/cards';
import { hear, playMedia, say, recognizer, sfx } from '../audio';
import { QuestionTimer, useKeys, type Ctx } from '../ctx';
import { Media, Rich } from '../rich';
import { markDiff } from '../diff';
import { textPx } from '../display';
import { ConfidenceRow, Feedback, LevelTag, Misconception, type ConfidencePick } from '../components';
import { pickedCorrections } from '@lernlab/core/misconceptions';
import { CONFIDENCE_LEVELS, type Confidence } from '@lernlab/core/confidence';
import type { Level } from '@lernlab/core/variants';
import { markAnswer } from '@lernlab/core/keyterms';
import { mnemonicHtml, mnemonicOf, showsMnemonic } from '@lernlab/core/mnemonic';
import { checkTyped, plainAnswer } from '../typed-logic';
import { CodeBlock, CodeLine } from '../code-block';

type P<E> = { ex: E; ctx: Ctx; onNext: (r: { correct: boolean }) => void };

/** A question asked with one of the card's variants: every answer to it carries the variant's level. */
const withLevel = (ctx: Ctx, level: Level | undefined): Ctx =>
  level ? { ...ctx, answer: (a) => ctx.answer({ ...a, level }) } : ctx;

/** The level of a variant question, next to the block title. */
function QuestionLevel({ level }: { level?: Level }) {
  const { t } = useTranslation();
  return level ? (
    <>
      {' '}
      <LevelTag level={level}>{t(`levels.${level}`)}</LevelTag>
    </>
  ) : null;
}
const now = () => performance.now();

/**
 * "How sure were you?" under a checked recall answer (#205), when the session asks it (ctx.confidence).
 * Optional: Continue never waits for it. `keys`: the keys 1 to 5 rate too (only where nothing else uses them).
 */
function Sure({
  ctx,
  value,
  onPick,
  keys,
}: {
  ctx: Ctx;
  value: Confidence | null;
  onPick: (value: Confidence, how: ConfidencePick) => void;
  keys: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  if (!ctx.confidence) return null;
  return (
    <ConfidenceRow
      id={id}
      label={t('ex.confidence.label')}
      low={t('ex.confidence.low')}
      high={t('ex.confidence.high')}
      names={CONFIDENCE_LEVELS.map((n) => t(`ex.confidence.level${n}`))}
      value={value}
      onPick={onPick}
      keys={keys}
    />
  );
}

/** Speaker and microphone icons (outline, like the sidebar's), coloured by the button. */
const SpeakerIcon = () => (
  <svg
    aria-hidden="true"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" />
  </svg>
);
const MicIcon = () => (
  <svg
    aria-hidden="true"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" />
  </svg>
);

export function Article({ item }: { item: Item }) {
  if (!item.article || item.kind !== 'noun')
    return (
      <Rich html={item.kind === 'cloze' ? replaceClozes(item.target, (c) => `<b>${c.answer}</b>`) : item.target} />
    );
  return (
    <>
      <span className={`art-${item.article}`}>{item.article}</span> {item.word}
    </>
  );
}

/** Speak a card's front in its language (for language decks). */
const sayFront = (ctx: Ctx, item: Item) => {
  if (ctx.lang) say(item.target, 0.95, ctx.lang, item.deckId);
};

/* ───────────── Meet a new card (German nouns: guess the article first) ───────────── */
export function Intro({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'intro' }>>) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const guessable = ctx.lang === 'de' && item.kind === 'noun' && !!item.article;
  const [phase, setPhase] = useState<'guess' | 'card'>(guessable ? 'guess' : 'card');
  const [guess, setGuess] = useState<string | null>(null);
  const shown = useRef(now());
  const recorded = useRef(false);

  useEffect(() => {
    if (phase !== 'card' || recorded.current) return;
    recorded.current = true;
    ctx.answer({ itemId: item.id, format: 'intro', correct: true, shownAt: shown.current, silent: true });
    sayFront(ctx, item);
    const timer = setTimeout(() => playMedia(item.audio), ctx.lang ? 1100 : 200);
    return () => clearTimeout(timer);
  }, [phase]);

  const pick = (a: string) => {
    if (guess) return;
    setGuess(a);
    const ok = a === item.article;
    ok ? sfx.right(1) : sfx.wrong();
    ctx.answer({
      itemId: item.id,
      format: 'gender',
      genderOnly: true,
      correct: ok,
      shownAt: shown.current,
      silent: true,
    });
    setTimeout(() => setPhase('card'), ok ? 600 : 1100);
  };

  useKeys((e) => {
    if (phase === 'guess' && ['1', '2', '3'].includes(e.key)) pick(['der', 'die', 'das'][Number(e.key) - 1]);
    else if (phase === 'card' && e.key === 'Enter') onNext({ correct: true });
    else if (phase === 'card' && e.key === ' ') {
      e.preventDefault();
      playMedia(item.audio);
    }
  });

  if (phase === 'guess') {
    return (
      <div>
        <div className="blocktitle">{t('ex.intro.guessTitle')}</div>
        <div className="prompt de">___ {item.word}</div>
        <div className="sub" style={{ marginBottom: 18 }}>
          {t('ex.intro.guessHint', { meaning: item.meaning })}
        </div>
        <div className="gender3">
          {(['der', 'die', 'das'] as const).map((a, i) => (
            <button key={a} className={`gbtn ${a} ${guess && a !== item.article ? 'dim' : ''}`} onClick={() => pick(a)}>
              {a} <span className="kbd">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="card introcard">
      <div className="blocktitle">{t('ex.intro.title')}</div>
      <Media item={item} size="lg" />
      <div className="word" style={{ fontSize: item.target.length > 40 ? textPx(28) : undefined }}>
        <Article item={item} />
      </div>
      <div className="prompt" style={{ fontSize: textPx(22), margin: '6px 0 16px' }}>
        <Rich html={markAnswer(item, item.meaning)} />
      </div>
      {item.sentence && (
        <div style={{ fontSize: textPx(20) }}>
          <Rich html={item.sentenceHtml} className="sentence" />
        </div>
      )}
      {item.sentenceMeaning && (
        <div className="muted" style={{ marginTop: 4 }}>
          {item.sentenceMeaning}
        </div>
      )}
      {(item.notes || item.grammar) && (
        <div className="small muted" style={{ marginTop: 12 }}>
          <Rich html={item.notes || item.grammar} />
        </div>
      )}
      <div className="actions" style={{ justifyContent: 'center' }}>
        {ctx.lang && (
          <button className="audio" onClick={() => sayFront(ctx, item)}>
            {t('ex.intro.sayWord')}
          </button>
        )}
        {item.audio && (
          <button className="audio" onClick={() => playMedia(item.audio)}>
            {t('ex.intro.playAudio')} <span className="kbd">{t('keys.space')}</span>
          </button>
        )}
        <button className="btn primary" onClick={() => onNext({ correct: true })}>
          {t('ex.intro.gotIt')} <span className="kbd">{t('keys.enter')}</span>
        </button>
      </div>
    </div>
  );
}

/* ───────────── Multiple choice / listening / picture quiz, optionally timed ───────────── */
export function Choice({
  ex,
  ctx,
  onNext,
  seconds,
}: P<Extract<Exercise, { type: 'mc' | 'listen' | 'imagemc' }>> & { seconds?: number }) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const [picked, setPicked] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const shown = useRef(now());
  const listen = ex.type === 'listen';
  const timer = seconds ?? ctx.timer;

  useEffect(() => {
    if (listen) hear(item, item.target);
    else if (ex.type === 'mc' && ex.direction === 'de2en') sayFront(ctx, item);
  }, []);

  const format = listen ? 'listen' : seconds ? 'blitz' : 'mc';
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === ex.answerIndex;
    ctx.answer({
      itemId: item.id,
      format,
      correct: ok,
      shownAt: shown.current,
      given: i >= 0 ? ex.options[i] : '(timeout)',
    });
    if (ok) setTimeout(() => onNext({ correct: true }), seconds ? 350 : 650);
    else if (ex.type === 'mc' && ex.direction === 'en2de') sayFront(ctx, item);
    if (!ok && seconds) setTimeout(() => onNext({ correct: false }), 1300);
  };
  const timeout = () => {
    if (picked === null) {
      setTimedOut(true);
      ctx.teacher(ctx.t.timeUp());
      choose(-1);
    }
  };
  useKeys((e) => {
    if (picked === null && ['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1);
    else if (picked !== null && e.key === 'Enter') onNext({ correct: picked === ex.answerIndex });
    else if (listen && e.key === ' ') {
      e.preventDefault();
      hear(item, item.target);
    }
  });

  return (
    <div>
      <QuestionTimer seconds={timer} running={picked === null && !ctx.paused} onTimeout={timeout} />
      {listen ? (
        <>
          <div className="blocktitle">{t('ex.choice.listen')}</div>
          <div className="row" style={{ margin: '10px 0 22px' }}>
            <button className="play" onClick={() => hear(item, item.target)} aria-label={t('ex.choice.replay')}>
              <SpeakerIcon />
            </button>
            <span className="muted">
              <Trans
                i18nKey="ex.choice.listenHint"
                values={{ key: t('keys.space') }}
                components={{ kbd: <span className="kbd" /> }}
              />
            </span>
          </div>
          {picked !== null && (
            <div className="prompt" style={{ fontSize: textPx(22) }}>
              {item.sentence || item.target}
            </div>
          )}
        </>
      ) : ex.type === 'imagemc' ? (
        <>
          <div className="blocktitle">{t('ex.choice.picture')}</div>
          <Media item={item} size="lg" />
        </>
      ) : (
        <>
          <div className="blocktitle">
            {ex.direction === 'de2en'
              ? ctx.lang
                ? t('ex.choice.meaning')
                : t('ex.choice.pick')
              : ctx.lang
                ? t('ex.choice.sayIt')
                : t('ex.choice.matches')}
          </div>
          {ex.direction === 'de2en' && <Media item={item} size="sm" />}
          <div
            className={`prompt ${ex.direction === 'de2en' && ctx.lang ? 'de' : ''}`}
            style={{ fontSize: ex.prompt.length > 60 ? textPx(22) : undefined }}
          >
            {ex.direction === 'de2en' ? <Article item={item} /> : <Rich html={ex.prompt} />}
          </div>
        </>
      )}
      <div className="options">
        {ex.options.map((o, i) => (
          <button
            key={i}
            className={`opt ${picked !== null && i === ex.answerIndex ? 'right' : ''} ${picked === i && i !== ex.answerIndex ? 'wrong' : ''}`}
            onClick={() => choose(i)}
          >
            <span className="k">{i + 1}</span>
            <Rich html={o} />
          </button>
        ))}
      </div>
      {timedOut && <Feedback tone="wrong">{ctx.t.timeUp()}</Feedback>}
      {picked !== null && !timedOut && (
        // Said in words with an icon, not only by the options' colours (WCAG 1.4.1), and announced.
        <Feedback tone={picked === ex.answerIndex ? 'right' : 'wrong'}>
          {picked === ex.answerIndex
            ? t('ex.choice.right')
            : t('ex.choice.wrong', { answer: stripHtml(ex.options[ex.answerIndex]) })}
        </Feedback>
      )}
      {picked !== null && picked !== ex.answerIndex && !seconds && (
        <div className="actions">
          <button className="btn primary" onClick={() => onNext({ correct: false })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── True or false, optionally timed ───────────── */
export function TrueFalse({
  ex,
  ctx,
  onNext,
  seconds,
}: P<Extract<Exercise, { type: 'truefalse' }>> & { seconds?: number }) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const [ans, setAns] = useState<boolean | null>(null);
  const shown = useRef(now());
  const timer = seconds ?? ctx.timer;
  const answer = (v: boolean | null) => {
    if (ans !== null) return;
    const ok = v === ex.isTrue;
    setAns(v ?? !ex.isTrue);
    ctx.answer({
      itemId: item.id,
      format: seconds ? 'blitz' : 'truefalse',
      correct: ok,
      shownAt: shown.current,
      given: v === null ? '(timeout)' : String(v),
    });
    setTimeout(() => onNext({ correct: ok }), ok ? 450 : 1400);
  };
  useKeys((e) => {
    if (['ArrowLeft', 'f', '1'].includes(e.key)) answer(false);
    if (['ArrowRight', 't', '2'].includes(e.key)) answer(true);
  });
  const ok = ans !== null && ans === ex.isTrue;
  return (
    <div>
      <QuestionTimer seconds={timer} running={ans === null && !ctx.paused} onTimeout={() => answer(null)} />
      <div className="blocktitle">{t('ex.tf.title')}</div>
      <Media item={item} size="sm" />
      <div className="prompt" style={{ fontSize: textPx(28) }}>
        <Rich html={ex.front} />
      </div>
      <div className="card" style={{ fontSize: textPx(22), marginBottom: 16 }}>
        = <Rich html={ex.shown} />
      </div>
      <div className="tf">
        <button className="no" style={{ opacity: ans !== null && ex.isTrue ? 0.35 : 1 }} onClick={() => answer(false)}>
          {t('ex.tf.false')} <span className="kbd">←</span>
        </button>
        <button className="yes" style={{ opacity: ans !== null && !ex.isTrue ? 0.35 : 1 }} onClick={() => answer(true)}>
          {t('ex.tf.true')} <span className="kbd">→</span>
        </button>
      </div>
      {ans !== null && !ok && (
        <Feedback tone="wrong">
          {t('common.correctAnswer')}{' '}
          <div className="ans">
            <Rich html={item.meaning} />
          </div>
        </Feedback>
      )}
    </div>
  );
}

/* ───────────── Flip: think of the answer, reveal, rate yourself (for long answers) ───────────── */
export function Flip({
  ex,
  ctx,
  onNext,
  format = 'flip',
}: P<Extract<Exercise, { type: 'flip' }>> & { format?: 'flip' | 'boss' }) {
  const { t } = useTranslation();
  ctx = withLevel(ctx, ex.level);
  const item = ctx.item(ex.itemId);
  const [shownAns, setShown] = useState(false);
  const [sure, setSure] = useState<Confidence | null>(null);
  const shown = useRef(now());
  const rate = (r: 0 | 1 | 2) => {
    if (!shownAns) return;
    const correct = r > 0;
    ctx.answer({
      itemId: item.id,
      format,
      correct,
      nearMiss: r === 1,
      shownAt: shown.current,
      given: ['no', 'partly', 'yes'][r],
    });
    if (sure && format === 'flip') ctx.confidence?.(item.id, sure); // after the answer it belongs to
    if (!correct) ctx.missed.add(item.id);
    onNext({ correct });
  };
  useKeys((e) => {
    if (!shownAns && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setShown(true);
      playMedia(item.audio);
    } else if (shownAns && ['1', '2', '3'].includes(e.key)) rate((Number(e.key) - 1) as 0 | 1 | 2);
  });
  return (
    <div>
      <div className="blocktitle">
        {t('ex.flip.title')}
        <QuestionLevel level={ex.level} />
      </div>
      <div className="card flipcard">
        {!ex.reverse && <Media item={item} size="md" />}
        <div className="prompt" style={{ fontSize: ex.prompt.length > 80 ? textPx(22) : textPx(28) }}>
          <Rich html={ex.prompt} />
        </div>
        {shownAns && (
          <Feedback tone="right" style={{ textAlign: 'start' }}>
            <div className="ans">
              <Rich html={markAnswer(item, ex.answer)} />
            </div>
            {ex.reverse && <Media item={item} size="sm" />}
            {(item.notes || item.grammar) && (
              <div className="small" style={{ marginTop: 6 }}>
                <Rich html={item.notes || item.grammar} />
              </div>
            )}
            <MnemonicNote ctx={ctx} item={item} attempted />
          </Feedback>
        )}
      </div>
      {!shownAns ? (
        <div className="actions">
          <button
            className="btn primary"
            onClick={() => {
              setShown(true);
              playMedia(item.audio);
            }}
          >
            {t('ex.flip.show')} <span className="kbd">{t('keys.space')}</span>
          </button>
          <span className="small muted">{t('ex.flip.hint')}</span>
        </div>
      ) : (
        <>
          {/* The keys 1 to 3 rate the answer here, so how sure you were is a click (or Tab and arrows). */}
          {format === 'flip' && <Sure ctx={ctx} value={sure} onPick={setSure} keys={false} />}
          <div className="grade3">
            <button className="btn rate-no" onClick={() => rate(0)}>
              {t('ex.flip.no')} <span className="kbd">1</span>
            </button>
            <button className="btn rate-partly" onClick={() => rate(1)}>
              {t('ex.flip.partly')} <span className="kbd">2</span>
            </button>
            <button className="btn rate-yes" onClick={() => rate(2)}>
              {t('ex.flip.yes')} <span className="kbd">3</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────── Myth card: reject the myth, then say why (a real recall, #202) ───────────── */
export function Myth({
  ex,
  ctx,
  onNext,
  format = 'flip',
}: P<Extract<Exercise, { type: 'myth' }>> & { format?: 'flip' | 'boss' }) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  // ask → (picked "Myth") why → shown → rated; or ask → (picked "True") fooled.
  const [step, setStep] = useState<'ask' | 'why' | 'shown' | 'fooled'>('ask');
  const shown = useRef(now());
  const record = (correct: boolean, given: string, nearMiss = false) => {
    ctx.answer({ itemId: item.id, format, correct, nearMiss, shownAt: shown.current, given });
    if (!correct) ctx.missed.add(item.id);
  };
  const pick = (myth: boolean) => {
    if (step !== 'ask') return;
    if (myth) return setStep('why');
    record(false, 'true');
    setStep('fooled');
  };
  const rate = (r: 0 | 1 | 2) => {
    if (step !== 'shown') return;
    record(r > 0, ['no', 'partly', 'yes'][r], r === 1);
    onNext({ correct: r > 0 });
  };
  useKeys((e) => {
    if (step === 'ask' && ['1', '2'].includes(e.key)) pick(e.key === '2');
    else if (step === 'why' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setStep('shown');
    } else if (step === 'shown' && ['1', '2', '3'].includes(e.key)) rate((Number(e.key) - 1) as 0 | 1 | 2);
    else if (step === 'fooled' && e.key === 'Enter') onNext({ correct: false });
  });
  return (
    <div>
      <div className="blocktitle">{t('ex.myth.title')}</div>
      <div className="card flipcard">
        <Media item={item} size="sm" />
        <div className="prompt" style={{ fontSize: ex.statement.length > 80 ? textPx(22) : textPx(28) }}>
          <Rich html={ex.statement} />
        </div>
        {step === 'why' && <Feedback tone="right">{t('ex.myth.rejected')}</Feedback>}
        {(step === 'shown' || step === 'fooled') && (
          <Feedback tone={step === 'shown' ? 'right' : 'wrong'} style={{ textAlign: 'start' }}>
            {t(step === 'shown' ? 'ex.myth.because' : 'ex.myth.fooled')}
            <div className="ans">
              <Rich html={markAnswer(item, ex.why)} />
            </div>
          </Feedback>
        )}
      </div>
      {step === 'ask' ? (
        <div className="actions">
          <button className="btn" onClick={() => pick(false)}>
            {t('ex.myth.true')} <span className="kbd">1</span>
          </button>
          <button className="btn" onClick={() => pick(true)}>
            {t('ex.myth.myth')} <span className="kbd">2</span>
          </button>
        </div>
      ) : step === 'why' ? (
        <div className="actions">
          <button className="btn primary" onClick={() => setStep('shown')}>
            {t('ex.myth.show')} <span className="kbd">{t('keys.space')}</span>
          </button>
          <span className="small muted">{t('ex.myth.hint')}</span>
        </div>
      ) : step === 'shown' ? (
        <div className="grade3">
          <button className="btn rate-no" onClick={() => rate(0)}>
            {t('ex.flip.no')} <span className="kbd">1</span>
          </button>
          <button className="btn rate-partly" onClick={() => rate(1)}>
            {t('ex.flip.partly')} <span className="kbd">2</span>
          </button>
          <button className="btn rate-yes" onClick={() => rate(2)}>
            {t('ex.flip.yes')} <span className="kbd">3</span>
          </button>
        </div>
      ) : (
        <div className="actions">
          <button className="btn primary" onClick={() => onNext({ correct: false })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── Typed answer engine: retry once, then reveal and copy (forced repeat) ───────────── */
type TypedProps = {
  ctx: Ctx;
  itemId: number;
  format: 'typed' | 'cloze' | 'boss';
  accepted: string[];
  requireArticle: boolean;
  hint: string;
  render: (input: React.ReactElement) => React.ReactElement;
  onNext: (r: { correct: boolean }) => void;
  revealAudio?: boolean;
};

function Umlauts({ lang, onAdd }: { lang: string | null; onAdd: (c: string) => void }) {
  const chars: Record<string, string[]> = {
    de: ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'],
    fr: ['é', 'è', 'ê', 'à', 'ç', 'ô', 'û', 'ë', 'ï'],
    es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'],
    pt: ['ã', 'õ', 'á', 'é', 'ç', 'â', 'ê'],
    it: ['à', 'è', 'é', 'ì', 'ò', 'ù'],
    sv: ['å', 'ä', 'ö'],
    nl: ['é', 'ë', 'ï'],
  };
  const list = lang ? chars[lang] : null;
  if (!list) return null;
  return (
    <div className="umlauts">
      {list.map((c) => (
        <button
          key={c}
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            onAdd(c);
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** "You typed / Answer" side by side, with only the differing letters marked (mockup: Feedback-light.png). */
function Compare({ given, answer }: { given: string; answer: string }) {
  const { t } = useTranslation();
  const show = (a: string, b: string, cls: string) =>
    markDiff(a, b).map((p, i) =>
      p.same ? (
        <span key={i}>{p.text}</span>
      ) : (
        <mark key={i} className={cls}>
          {p.text}
        </mark>
      ),
    );
  return (
    <div className="compare">
      <div>
        <span className="compare-label">{t('ex.typed.youTyped')}</span>
        <span className="compare-given">{show(given, answer, 'miss')}</span>
      </div>
      <div>
        <span className="compare-label">{t('ex.typed.answer')}</span>
        <b className="compare-answer">{show(answer, given, 'fix')}</b>
      </div>
    </div>
  );
}

export function TypedEngine({
  ctx,
  itemId,
  format,
  accepted,
  requireArticle,
  hint,
  render,
  onNext,
  revealAudio,
}: TypedProps) {
  const { t } = useTranslation();
  const item = ctx.item(itemId);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'answer' | 'retry' | 'copy' | 'done'>('answer');
  const [res, setRes] = useState<CheckResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [msg, setMsg] = useState('');
  const [given, setGiven] = useState('');
  const shown = useRef(now());
  const input = useRef<HTMLInputElement>(null);
  const finalCorrect = useRef(false);
  const coach = ctx.t;
  // "How sure were you?" (#205): asked once the answer is checked. Then the card waits for a tap (1–5, which
  // also goes on) or Continue, instead of moving on by itself.
  const asksSure = !!ctx.confidence && format !== 'boss';
  const [sure, setSure] = useState<Confidence | null>(null);
  useEffect(() => {
    input.current?.focus();
  }, [phase]);

  const finish = (correct: boolean, delay: number) => {
    finalCorrect.current = correct;
    setPhase('done');
    if (ctx.lang) say(accepted[0], 0.95, ctx.lang, item.deckId);
    if (delay > 0 && !asksSure) setTimeout(() => onNext({ correct }), delay);
  };
  const rateSure = (n: Confidence, how: ConfidencePick) => {
    setSure(n);
    ctx.confidence?.(itemId, n);
    if (how === 'tap') onNext({ correct: finalCorrect.current });
  };

  const submit = () => {
    if (phase === 'done') return onNext({ correct: finalCorrect.current });
    if (!value.trim()) return;
    const r = checkTyped(item, format, value, accepted, requireArticle);
    if (phase === 'copy') {
      if (r.correct && !r.nearMiss) {
        sfx.tap();
        finish(false, 400);
      } else {
        sfx.wrong();
        setValue('');
      }
      return;
    }
    setRes(r);
    setGiven(value);
    const first = phase === 'answer';
    const usedHint = hintLevel > 0;
    if (r.correct) {
      ctx.answer({
        itemId,
        format,
        correct: true,
        nearMiss: r.nearMiss,
        usedHint,
        firstTry: first,
        given: value,
        shownAt: shown.current,
      });
      setMsg(
        r.nearMiss
          ? [coach.near(), r.note ? t(r.note.key, r.note.params ?? {}) : ''].join(' ')
          : requireArticle
            ? coach.rightArticle()
            : coach.right(ctx.combo + 1),
      );
      finish(first, r.nearMiss ? 1500 : 750);
      return;
    }
    ctx.answer({
      itemId,
      format,
      correct: false,
      articleError: r.articleError,
      usedHint,
      firstTry: first,
      given: value,
      shownAt: shown.current,
    });
    ctx.missed.add(itemId);
    if (first) {
      setPhase('retry');
      setMsg(r.articleError ? `${r.note ? t(r.note.key, r.note.params ?? {}) : ''}. ${coach.retry()}` : coach.retry());
      if (!r.articleError) setValue('');
    } else {
      setPhase('copy');
      setMsg(coach.reveal());
      setValue('');
      if (revealAudio) playMedia(item.audio);
      else if (ctx.lang) say(accepted[0], 0.95, ctx.lang, item.deckId);
    }
  };

  const [overridden, setOverridden] = useState(false);
  const iWasRight = () => {
    setOverridden(true);
    ctx.override(itemId);
    ctx.missed.delete(itemId);
    setRes(null);
    setMsg(t('ex.typed.overridden'));
    finish(true, 700);
  };

  const giveHint = () => {
    if (phase === 'done' || phase === 'copy') return;
    if (hintLevel === 0) {
      setHintLevel(1);
      setMsg(t('ex.typed.hint', { hint }));
      return;
    }
    ctx.answer({
      itemId,
      format,
      correct: false,
      usedHint: true,
      firstTry: phase === 'answer',
      given: '(hint)',
      shownAt: shown.current,
    });
    ctx.missed.add(itemId);
    setPhase('copy');
    setMsg(coach.reveal());
    setValue('');
  };

  const cls =
    phase === 'done'
      ? res?.nearMiss
        ? 'near'
        : finalCorrect.current
          ? 'right'
          : ''
      : phase === 'retry'
        ? 'wrong'
        : '';
  const field = (
    <input
      ref={input}
      className={format === 'cloze' ? '' : `typed ${cls}`}
      value={value}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={phase === 'copy' ? plainAnswer(accepted[0]) : format === 'cloze' ? '…' : t('ex.typed.placeholder')}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          giveHint();
        }
      }}
    />
  );

  return (
    <div>
      {render(field)}
      <Umlauts
        lang={ctx.lang}
        onAdd={(c) => {
          setValue((v) => v + c);
          input.current?.focus();
        }}
      />
      {msg && (
        <Feedback
          tone={
            phase === 'done'
              ? res?.nearMiss
                ? 'near'
                : finalCorrect.current
                  ? 'right'
                  : 'wrong'
              : phase === 'answer'
                ? 'near'
                : 'wrong'
          }
        >
          {msg}
          {(phase === 'copy' || (phase === 'done' && !finalCorrect.current) || res?.nearMiss) && (
            // Code answers are plain text in the code font, line breaks kept.
            <div className={item.kind === 'code' ? 'code-answer' : undefined}>
              {given && !overridden && !hasMath(accepted[0]) && !(item.kind === 'code' && res?.correct) ? (
                <Compare given={given} answer={accepted[0]} />
              ) : (
                <div className="ans">
                  {requireArticle && item.article ? (
                    <Article item={item} />
                  ) : item.kind === 'code' ? (
                    accepted[0]
                  ) : (
                    <Rich html={accepted[0]} />
                  )}
                </div>
              )}
            </div>
          )}
          <MnemonicNote ctx={ctx} item={item} attempted={phase !== 'answer'} asked={hintLevel > 0} />
          {phase === 'copy' && <div className="small">{t('ex.typed.copyHint')}</div>}
        </Feedback>
      )}
      {phase === 'done' && asksSure && <Sure ctx={ctx} value={sure} onPick={rateSure} keys />}
      <div className="actions">
        {phase !== 'done' && (
          <button className="btn primary" onClick={submit}>
            {phase === 'copy' ? t('ex.typed.copy') : t('common.check')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        )}
        {(phase === 'answer' || phase === 'retry') && (
          <button className="btn ghost" onClick={giveHint}>
            {hintLevel ? t('ex.typed.showAnswer') : t('ex.typed.hintButton')}{' '}
            <span className="kbd">{t('keys.tab')}</span>
          </button>
        )}
        {phase === 'done' && (
          <button className="btn primary" onClick={() => onNext({ correct: finalCorrect.current })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        )}
        {(phase === 'retry' || phase === 'copy' || (phase === 'done' && !finalCorrect.current)) && !overridden && (
          <button className="btn ghost" title={t('ex.typed.iWasRightTitle')} onClick={iWasRight}>
            {t('ex.typed.iWasRight')}
          </button>
        )}
      </div>
    </div>
  );
}

export function Typed({ ex, ctx, onNext, boss }: P<Extract<Exercise, { type: 'typed' }>> & { boss?: boolean }) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  return (
    <TypedEngine
      ctx={withLevel(ctx, ex.level)}
      itemId={ex.itemId}
      format={boss ? 'boss' : 'typed'}
      accepted={ex.accepted}
      requireArticle={ex.requireArticle}
      hint={ex.hint}
      onNext={onNext}
      render={(input) => (
        <>
          <div className="blocktitle">
            {ex.code !== undefined
              ? t('ex.code.outputTitle')
              : item.kind === 'occlusion'
                ? t('ex.occlusion.title')
                : ctx.lang
                  ? t('ex.typed.titleLanguage')
                  : t('ex.typed.title')}
            <QuestionLevel level={ex.level} />
          </div>
          {ex.prompt === item.target && <Media item={item} size="sm" />}
          <div className="prompt" style={{ fontSize: ex.prompt.length > 70 ? textPx(22) : undefined }}>
            <Rich html={ex.prompt} />
          </div>
          {ex.code !== undefined && <CodeBlock code={ex.code} lang={ex.codeLang ?? ''} />}
          {input}
        </>
      )}
    />
  );
}

export function Cloze({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'cloze' }>>) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  return (
    <TypedEngine
      ctx={ctx}
      itemId={ex.itemId}
      format="cloze"
      accepted={ex.accepted}
      requireArticle={false}
      hint={ex.hint}
      onNext={onNext}
      revealAudio
      render={(input) => (
        <>
          <div className="blocktitle">{ex.codeLang !== undefined ? t('ex.code.fillTitle') : t('ex.cloze.title')}</div>
          <Media item={item} size="sm" />
          {ex.codeLang !== undefined ? (
            <>
              <div className="prompt">
                <Rich html={ex.translation} />
              </div>
              <CodeBlock
                code={ex.before + GAP + ex.after}
                lang={ex.codeLang}
                gap={
                  <span className="code-gap" style={{ width: `${Math.max(4, ex.accepted[0].length + 2)}ch` }}>
                    {input}
                  </span>
                }
              />
            </>
          ) : (
            <div className="cloze">
              {ex.before} {input} {ex.after}
            </div>
          )}
          {ex.translation && ex.codeLang === undefined && (
            <div className="muted" style={{ marginTop: 10 }}>
              {ex.translation}
            </div>
          )}
          {item.lang && item.kind !== 'grammar' && <div className="small muted">({item.meaning})</div>}
        </>
      )}
    />
  );
}

/* ───────────── Sentence building from tiles ───────────── */
export function Unscramble({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'unscramble' }>>) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const shown = useRef(now());
  const item = ctx.item(ex.itemId);
  const check = (o: number[]) => {
    const built = o.map((i) => ex.tiles[i]).join(' ');
    const ok = normalize(built) === normalize(ex.answer.join(' '));
    setResult(ok);
    ctx.answer({ itemId: ex.itemId, format: 'unscramble', correct: ok, shownAt: shown.current, given: built });
    if (!ok) ctx.missed.add(ex.itemId);
    playMedia(item.audio);
    if (ok) setTimeout(() => onNext({ correct: true }), 1400);
  };
  const add = (i: number) => {
    if (result !== null || order.includes(i)) return;
    sfx.tap();
    const o = [...order, i];
    setOrder(o);
    if (o.length === ex.tiles.length) check(o);
  };
  useKeys((e) => {
    if (result !== null && e.key === 'Enter') onNext({ correct: !!result });
    if (result === null && e.key === 'Backspace') setOrder((o) => o.slice(0, -1));
    const n = Number(e.key);
    if (result === null && n >= 1 && n <= 9) {
      const free = ex.tiles.map((_, i) => i).filter((i) => !order.includes(i));
      if (free[n - 1] !== undefined) add(free[n - 1]);
    }
  });
  return (
    <div>
      <div className="blocktitle">{t('ex.unscramble.title')}</div>
      <div className="prompt" style={{ fontSize: textPx(24) }}>
        {ex.translation}
      </div>
      <div
        className="tiles"
        style={{ borderColor: result === null ? undefined : result ? 'var(--good)' : 'var(--bad)' }}
      >
        {order.map((i, k) => (
          <button key={k} className="tile" onClick={() => result === null && setOrder(order.filter((x) => x !== i))}>
            {ex.tiles[i]}
          </button>
        ))}
      </div>
      <div className="tiles" style={{ border: 'none', marginTop: 10 }}>
        {(() => {
          let k = 0;
          return ex.tiles.map((tile, i) => {
            const used = order.includes(i);
            const label = used ? null : ++k;
            return (
              <button key={i} className={`tile ${used ? 'used' : ''}`} onClick={() => add(i)}>
                {tile}
                {label && label < 10 ? (
                  <span className="kbd" style={{ marginInlineStart: 6 }}>
                    {label}
                  </span>
                ) : null}
              </button>
            );
          });
        })()}
      </div>
      {result !== null && (
        <Feedback tone={result ? 'right' : 'wrong'}>
          {result ? ctx.t.right(ctx.combo) : t('common.correctOrder')}
          {!result && <div className="ans">{ex.answer.join(' ')}</div>}
        </Feedback>
      )}
      <div className="actions">
        {result === null && <span className="small muted">{t('ex.unscramble.help')}</span>}
        {result === false && (
          <button className="btn primary" onClick={() => onNext({ correct: false })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────── Dictation ───────────── */
export function Dictation({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'dictation' }>>) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const [value, setValue] = useState('');
  const [res, setRes] = useState<'right' | 'near' | 'wrong' | null>(null);
  const shown = useRef(now());
  const input = useRef<HTMLInputElement>(null);
  const play = (rate = 1) => {
    hear(item, ex.sentence, { rate, preferVoice: true });
    input.current?.focus();
  };
  useEffect(() => play(), []);
  const submit = () => {
    if (res) return onNext({ correct: res !== 'wrong' });
    if (!value.trim()) return;
    const s = similarity(value, ex.sentence);
    const r = s === 1 ? 'right' : s >= 0.85 ? 'near' : 'wrong';
    setRes(r);
    ctx.answer({
      itemId: item.id,
      format: 'dictation',
      correct: r !== 'wrong',
      nearMiss: r === 'near',
      shownAt: shown.current,
      given: value,
    });
    if (r === 'wrong') ctx.missed.add(item.id);
    if (r === 'right') setTimeout(() => onNext({ correct: true }), 900);
  };
  return (
    <div>
      <div className="blocktitle">{t('ex.dictation.title')}</div>
      <div className="row play-row">
        <button className="play" onClick={() => play()} aria-label={t('ex.dictation.play')}>
          <SpeakerIcon />
        </button>
        <button className="btn" onClick={() => play(0.7)}>
          {t('ex.dictation.slow')}
        </button>
        <span className="muted">{t('ex.dictation.hint')}</span>
      </div>
      <input
        ref={input}
        className={`typed ${res ?? ''}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        aria-label={t('ex.dictation.hint')}
        placeholder="…"
      />
      <Umlauts lang={ctx.lang} onAdd={(c) => setValue((v) => v + c)} />
      {res && (
        <Feedback tone={res}>
          {res === 'right' ? ctx.t.right(ctx.combo) : res === 'near' ? ctx.t.near() : t('common.correctLabel')}
          <div className="ans">{ex.sentence}</div>
          <div className="small">{ex.translation}</div>
        </Feedback>
      )}
      <div className="actions">
        <button className="btn primary" onClick={submit}>
          {res ? t('common.continue') : t('common.check')} <span className="kbd">{t('keys.enter')}</span>
        </button>
      </div>
    </div>
  );
}

/* ───────────── Speak it aloud (speech recognition, or self-check) ───────────── */
export function Speak({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'speak' }>>) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const rec = useMemo(() => recognizer(ctx.lang ?? 'de'), []);
  const [phase, setPhase] = useState<'ready' | 'listening' | 'heard' | 'reveal' | 'done'>('ready');
  const [heard, setHeard] = useState('');
  const [tries, setTries] = useState(0);
  const [ok, setOk] = useState<boolean | null>(null);
  const shown = useRef(now());
  const playModel = () => hear(item, ex.expected, { preferVoice: ex.expected !== item.target });
  const settle = (correct: boolean, near = false) => {
    setOk(correct);
    setPhase('done');
    ctx.answer({
      itemId: item.id,
      format: 'speak',
      correct,
      nearMiss: near,
      firstTry: tries === 0,
      shownAt: shown.current,
      given: heard,
    });
    if (!correct) ctx.missed.add(item.id);
    playModel();
  };
  const listen = () => {
    if (!rec) return setPhase('reveal');
    setPhase('listening');
    rec.onresult = (e: any) => {
      const alts: string[] = Array.from(e.results[0]).map((r: any) => r.transcript);
      const best = alts.reduce(
        (b, a) => (similarity(a, ex.expected) > similarity(b, ex.expected) ? a : b),
        alts[0] ?? '',
      );
      const s = similarity(best, ex.expected);
      setHeard(best);
      if (s >= 0.8) settle(true, s < 0.95);
      else if (tries === 0) {
        setTries(1);
        setPhase('heard');
        sfx.near();
      } else settle(false);
    };
    rec.onerror = (e: any) => {
      if (
        ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e?.error)
      )
        setPhase('reveal');
      else setPhase('heard');
    };
    rec.onend = () => setPhase((p) => (p === 'listening' ? 'heard' : p));
    try {
      rec.start();
    } catch {
      /* already started */
    }
  };
  useKeys((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (phase === 'ready' || phase === 'heard') listen();
      else if (phase === 'done') onNext({ correct: !!ok });
    }
    if (phase === 'reveal' && (e.key === '1' || e.key === '2')) settle(e.key === '2');
  });
  return (
    <div>
      <div className="blocktitle">{t('ex.speak.title')}</div>
      <div className="prompt">{ex.prompt}</div>
      {phase !== 'reveal' && phase !== 'done' && (
        <div className="col" style={{ alignItems: 'center', marginTop: 10 }}>
          <button
            className={`mic ${phase === 'listening' ? 'on' : ''}`}
            onClick={listen}
            aria-label={t('ex.speak.mic')}
            aria-pressed={phase === 'listening'}
          >
            <MicIcon />
          </button>
          <div className="muted">
            {phase === 'listening'
              ? t('ex.speak.listening')
              : rec
                ? t('ex.speak.pressSpace')
                : t('ex.speak.sayThenSpace')}
          </div>
          {phase === 'heard' && (
            <Feedback tone="near">{t('ex.speak.heard', { heard: heard || '…', retry: ctx.t.retry() })}</Feedback>
          )}
          {rec && phase !== 'listening' && (
            <button className="btn ghost" onClick={() => setPhase('reveal')}>
              {t('ex.speak.noMic')}
            </button>
          )}
        </div>
      )}
      {phase === 'reveal' && (
        <Feedback tone="near">
          {t('ex.speak.didYouSay')}
          <div className="ans">{ex.expected}</div>
          <div className="actions">
            <button className="play play-sm" onClick={playModel} aria-label={t('ex.speak.playModel')}>
              <SpeakerIcon />
            </button>
            <button className="btn rate-no" onClick={() => settle(false)}>
              {t('ex.speak.no')} <span className="kbd">1</span>
            </button>
            <button className="btn rate-yes" onClick={() => settle(true)}>
              {t('ex.speak.yes')} <span className="kbd">2</span>
            </button>
          </div>
        </Feedback>
      )}
      {phase === 'done' && (
        <Feedback tone={ok ? 'right' : 'wrong'}>
          {ok ? ctx.t.right(ctx.combo) : t('ex.speak.repeat')}
          <div className="ans">{ex.expected}</div>
          {heard && <div className="small">{t('ex.speak.heardShort', { heard })}</div>}
          <div className="actions">
            <button className="btn" onClick={playModel}>
              {t('ex.speak.again')}
            </button>
            <button className="btn primary" onClick={() => onNext({ correct: !!ok })}>
              {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
            </button>
          </div>
        </Feedback>
      )}
    </div>
  );
}

/* ───────────── Mini-lesson ───────────── */
export function Lesson({
  ex,
  ctx,
  onNext,
  grammarIds,
}: P<Extract<Exercise, { type: 'lesson' }>> & { grammarIds: number[] }) {
  const { t } = useTranslation();
  const shown = useRef(now());
  useEffect(() => {
    for (const id of grammarIds)
      ctx.answer({ itemId: id, format: 'intro', correct: true, shownAt: shown.current, silent: true });
  }, []);
  useKeys((e) => {
    if (e.key === 'Enter') onNext({ correct: true });
  });
  return (
    <div className="card lesson">
      <div className="blocktitle">{t('ex.lesson.title', { group: ex.group })}</div>
      <div className="prompt" style={{ fontSize: textPx(28) }}>
        {ex.title}
      </div>
      <p style={{ fontSize: textPx(18), lineHeight: 1.5 }}>{ex.text}</p>
      <div className="col">
        {ex.examples.map((e, i) => (
          <button key={i} className="opt" onClick={() => ctx.lang && say(e.de, 0.95, ctx.lang)}>
            {ctx.lang ? '🔊 ' : ''}
            <span>
              <b>{e.de}</b>
              <br />
              <span className="small muted">{e.en}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="btn primary" onClick={() => onNext({ correct: true })}>
          {t('ex.lesson.gotIt')} <span className="kbd">{t('keys.enter')}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * The card's mnemonic (#221): only once an answer is given or shown, or after the learner asked for a hint,
 * and by itself only until the card was recalled twice in a row since its last miss.
 */
export function MnemonicNote({
  ctx,
  item,
  attempted,
  asked,
}: {
  ctx: Pick<Ctx, 'mnemonicRun'>;
  item: Item;
  attempted: boolean;
  asked?: boolean;
}) {
  const { t } = useTranslation();
  if (!showsMnemonic(item, ctx.mnemonicRun?.(item.id), { attempted, asked })) return null;
  return (
    <div className="mnemonic small">
      <span className="mnemonic-lead">{t('ex.mnemonic.lead')}</span> <Rich html={mnemonicHtml(mnemonicOf(item))} />
    </div>
  );
}

/**
 * A wrong multiple-choice answer: the right answer, after the author's correction for each wrong choice
 * picked (#202) when there is one. Shared with the mock exam's tutor mode.
 */
export function WrongChoice({ corrections, answer }: { corrections: string[]; answer: string }) {
  const { t } = useTranslation();
  if (!corrections.length) return <>{answer}</>;
  return (
    <Misconception lead={t('ex.mcq.mixUp')} answer={answer}>
      {corrections.map((html, i) => (
        <p key={i}>
          <Rich html={html} />
        </p>
      ))}
    </Misconception>
  );
}

/* ───────────── Multiple choice / multi-select question (certification style) ───────────── */
export function Mcq({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'mcq' }>>) {
  const { t } = useTranslation();
  const item = ctx.item(ex.itemId);
  const multi = ex.correct.length > 1;
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState<boolean | null>(null);
  const shown = useRef(now());
  const submit = (picked = sel) => {
    if (done !== null || !picked.length) return;
    const ok = picked.length === ex.correct.length && picked.every((p) => ex.correct.includes(p));
    const partial = !ok && picked.some((p) => ex.correct.includes(p));
    setDone(ok);
    ctx.answer({
      itemId: item.id,
      format: 'mcq',
      correct: ok,
      nearMiss: false,
      shownAt: shown.current,
      given: picked.map((p) => ex.choices[p]).join(' | '),
    });
    if (!ok) ctx.missed.add(item.id);
    if (ok && !ex.explanation) setTimeout(() => onNext({ correct: true }), 800);
    void partial;
  };
  const toggle = (i: number) => {
    if (done !== null) return;
    if (!multi) {
      setSel([i]);
      submit([i]);
      return;
    }
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };
  useKeys((e) => {
    const n = Number(e.key);
    if (done === null && n >= 1 && n <= ex.choices.length) toggle(n - 1);
    else if (e.key === 'Enter') {
      if (done === null) submit();
      else onNext({ correct: !!done });
    }
  });
  return (
    <div>
      <div className="blocktitle">
        {multi ? t('ex.mcq.titleMulti', { count: ex.correct.length }) : t('ex.mcq.title')}
      </div>
      <Media item={item} size="sm" />
      <div className="prompt" style={{ fontSize: ex.stem.length > 120 ? textPx(19) : textPx(24), lineHeight: 1.4 }}>
        <Rich html={ex.stem} />
      </div>
      <div className="col">
        {ex.choices.map((c, i) => {
          const isCorrect = ex.correct.includes(i);
          const cls = done === null ? '' : isCorrect ? 'right' : sel.includes(i) ? 'wrong' : '';
          return (
            <button
              key={i}
              className={`opt ${cls}`}
              aria-pressed={multi ? sel.includes(i) : undefined}
              onClick={() => toggle(i)}
            >
              <span className="k">{multi ? (sel.includes(i) ? '☑' : '☐') : i + 1}</span>
              <Rich html={c} />
            </button>
          );
        })}
      </div>
      {done !== null && (
        <Feedback tone={done ? 'right' : 'wrong'}>
          {done ? (
            ctx.t.right(ctx.combo)
          ) : (
            <WrongChoice
              corrections={pickedCorrections(ex.corrections, sel, ex.correct)}
              answer={t('common.correctIs', { answer: ex.correct.map((i) => ex.choices[i]).join(' + ') })}
            />
          )}
          {ex.explanation && (
            <div className="small" style={{ marginTop: 6, fontWeight: 500 }}>
              <Rich html={ex.explanation} />
            </div>
          )}
        </Feedback>
      )}
      <div className="actions">
        {done === null && multi && (
          <button className="btn primary" disabled={!sel.length} onClick={() => submit()}>
            {t('common.check')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        )}
        {done !== null && (!done || ex.explanation) && (
          <button className="btn primary" onClick={() => onNext({ correct: !!done })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────── Put the steps in order (processes, timelines, code lines) ───────────── */
export function Order({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'order' }>>) {
  const { t } = useTranslation();
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const [sure, setSure] = useState<Confidence | null>(null);
  const shown = useRef(now());
  const rateSure = (n: Confidence, how: ConfidencePick) => {
    setSure(n);
    ctx.confidence?.(ex.itemId, n);
    if (how === 'tap') onNext({ correct: !!result });
  };
  const step = (s: string) =>
    ex.codeLang !== undefined ? <CodeLine code={s} lang={ex.codeLang} /> : <Rich html={s} />;
  const add = (stepIdx: number) => {
    if (result !== null || placed.includes(stepIdx)) return;
    sfx.tap();
    const p = [...placed, stepIdx];
    setPlaced(p);
    if (p.length === ex.steps.length) {
      // By text: two identical lines of code (two closing braces) may go either way round.
      const ok = p.every((v, i) => ex.steps[v] === ex.steps[i]);
      setResult(ok);
      ctx.answer({
        itemId: ex.itemId,
        format: 'order',
        correct: ok,
        shownAt: shown.current,
        given: p.map((i) => ex.steps[i]).join(' → '),
      });
      if (!ok) ctx.missed.add(ex.itemId);
      if (ok && !ctx.confidence) setTimeout(() => onNext({ correct: true }), 1000);
    }
  };
  useKeys((e) => {
    if (result !== null && e.key === 'Enter') onNext({ correct: !!result });
    if (result === null && e.key === 'Backspace') setPlaced((p) => p.slice(0, -1));
    const n = Number(e.key);
    const free = ex.shuffled.filter((i) => !placed.includes(i));
    if (result === null && n >= 1 && n <= free.length) add(free[n - 1]);
  });
  return (
    <div>
      <div className="blocktitle">{ex.codeLang !== undefined ? t('ex.code.orderTitle') : t('ex.order.title')}</div>
      <div className="prompt" style={{ fontSize: textPx(24) }}>
        <Rich html={ex.prompt} />
      </div>
      <ol className="col" style={{ paddingInlineStart: 22, minHeight: 40 }}>
        {placed.map((s, k) => (
          <li key={k}>
            <button
              className={`opt ${result === null ? '' : ex.steps[s] === ex.steps[k] ? 'right' : 'wrong'}`}
              style={{ width: '100%' }}
              onClick={() => result === null && setPlaced(placed.filter((x) => x !== s))}
            >
              {step(ex.steps[s])}
            </button>
          </li>
        ))}
      </ol>
      <div className="col">
        {ex.shuffled
          .filter((i) => !placed.includes(i))
          .map((i, k) => (
            <button key={i} className="opt" onClick={() => add(i)}>
              <span className="k">{k + 1}</span>
              {step(ex.steps[i])}
            </button>
          ))}
      </div>
      {result === false && (
        <Feedback tone="wrong">
          {t('common.correctOrder')}
          <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {ex.steps.map((s, i) => (
              <li key={i}>{step(s)}</li>
            ))}
          </ol>
        </Feedback>
      )}
      {result === true && <Feedback tone="right">{ctx.t.right(ctx.combo)}</Feedback>}
      {result !== null && <Sure ctx={ctx} value={sure} onPick={rateSure} keys />}
      <div className="actions">
        {result === null && <span className="small muted">{t('ex.order.help')}</span>}
        {(result === false || (result === true && !!ctx.confidence)) && (
          <button className="btn primary" onClick={() => onNext({ correct: !!result })}>
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
