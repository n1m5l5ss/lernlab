import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Item } from '@lernlab/core/types';
import { checkAnswer, similarity, normalize, type CheckResult } from '@lernlab/core/text';
import { playMedia, say, recognizer, sfx } from '../audio';
import { QuestionTimer, useKeys, type Ctx } from '../ctx';
import { Media, Rich } from '../rich';

type P<E> = { ex: E; ctx: Ctx; onNext: (r: { correct: boolean }) => void };
const now = () => performance.now();

export function Article({ item }: { item: Item }) {
  if (!item.article || item.kind !== 'noun')
    return (
      <Rich
        html={item.kind === 'cloze' ? item.target.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '<b>$1</b>') : item.target}
      />
    );
  return (
    <>
      <span className={`art-${item.article}`}>{item.article}</span> {item.word}
    </>
  );
}

/** Speak a card's front in its language (for language decks). */
const sayFront = (ctx: Ctx, item: Item) => {
  if (ctx.lang) say(item.word && item.article ? item.target : item.target, 0.95, ctx.lang);
};

/* ───────────── Meet a new card (German nouns: guess the article first) ───────────── */
export function Intro({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'intro' }>>) {
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
    const t = setTimeout(() => playMedia(item.audio), ctx.lang ? 1100 : 200);
    return () => clearTimeout(t);
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
        <div className="blocktitle">New word · guess the article</div>
        <div className="prompt de">___ {item.word}</div>
        <div className="sub" style={{ marginBottom: 18 }}>
          {item.meaning} · just guess – you learn either way
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
      <div className="blocktitle">New card</div>
      <Media item={item} size="lg" />
      <div className="word" style={{ fontSize: item.target.length > 40 ? 28 : undefined }}>
        <Article item={item} />
      </div>
      <div className="prompt" style={{ fontSize: 22, margin: '6px 0 16px' }}>
        <Rich html={item.meaning} />
      </div>
      {item.sentence && (
        <div style={{ fontSize: 20 }}>
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
            🔊 Word
          </button>
        )}
        {item.audio && (
          <button className="audio" onClick={() => playMedia(item.audio)}>
            🔊 Audio <span className="kbd">Space</span>
          </button>
        )}
        <button className="btn primary" onClick={() => onNext({ correct: true })}>
          Got it <span className="kbd">Enter</span>
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
  const item = ctx.item(ex.itemId);
  const [picked, setPicked] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const shown = useRef(now());
  const listen = ex.type === 'listen';
  const timer = seconds ?? ctx.timer;

  useEffect(() => {
    if (listen) playMedia(item.audio);
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
      playMedia(item.audio);
    }
  });

  return (
    <div>
      <QuestionTimer seconds={timer} running={picked === null} onTimeout={timeout} />
      {listen ? (
        <>
          <div className="blocktitle">Listen</div>
          <div className="row" style={{ margin: '10px 0 22px' }}>
            <button
              className="mic"
              style={{ width: 80, height: 80, fontSize: 32 }}
              onClick={() => playMedia(item.audio)}
            >
              🔊
            </button>
            <span className="muted">
              What does it mean? <span className="kbd">Space</span> replays
            </span>
          </div>
          {picked !== null && (
            <div className="prompt" style={{ fontSize: 22 }}>
              {item.sentence || item.target}
            </div>
          )}
        </>
      ) : ex.type === 'imagemc' ? (
        <>
          <div className="blocktitle">What is this?</div>
          <Media item={item} size="lg" />
        </>
      ) : (
        <>
          <div className="blocktitle">
            {ex.direction === 'de2en'
              ? ctx.lang
                ? 'What does it mean?'
                : 'Pick the answer'
              : ctx.lang
                ? 'How do you say…'
                : 'Which one matches?'}
          </div>
          {ex.direction === 'de2en' && <Media item={item} size="sm" />}
          <div
            className={`prompt ${ex.direction === 'de2en' && ctx.lang ? 'de' : ''}`}
            style={{ fontSize: ex.prompt.length > 60 ? 22 : undefined }}
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
      {timedOut && <div className="feedback wrong">{ctx.t.timeUp()}</div>}
      {picked !== null && picked !== ex.answerIndex && !seconds && (
        <div className="actions">
          <button className="btn" onClick={() => onNext({ correct: false })}>
            Continue <span className="kbd">Enter</span>
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
      <QuestionTimer seconds={timer} running={ans === null} onTimeout={() => answer(null)} />
      <div className="blocktitle">True or false?</div>
      <Media item={item} size="sm" />
      <div className="prompt" style={{ fontSize: 28 }}>
        <Rich html={ex.front} />
      </div>
      <div className="card" style={{ fontSize: 22, marginBottom: 16 }}>
        = <Rich html={ex.shown} />
      </div>
      <div className="tf">
        <button className="no" style={{ opacity: ans !== null && ex.isTrue ? 0.35 : 1 }} onClick={() => answer(false)}>
          ✗ False <span className="kbd">←</span>
        </button>
        <button className="yes" style={{ opacity: ans !== null && !ex.isTrue ? 0.35 : 1 }} onClick={() => answer(true)}>
          ✓ True <span className="kbd">→</span>
        </button>
      </div>
      {ans !== null && !ok && (
        <div className="feedback wrong">
          Correct answer:{' '}
          <div className="ans">
            <Rich html={item.meaning} />
          </div>
        </div>
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
  const item = ctx.item(ex.itemId);
  const [shownAns, setShown] = useState(false);
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
      <div className="blocktitle">Recall · think of the answer</div>
      <div className="card flipcard">
        {!ex.reverse && <Media item={item} size="md" />}
        <div className="prompt" style={{ fontSize: ex.prompt.length > 80 ? 22 : 28 }}>
          <Rich html={ex.prompt} />
        </div>
        {shownAns && (
          <div className="feedback right" style={{ textAlign: 'left' }}>
            <div className="ans">
              <Rich html={ex.answer} />
            </div>
            {ex.reverse && <Media item={item} size="sm" />}
            {(item.notes || item.grammar) && (
              <div className="small" style={{ marginTop: 6 }}>
                <Rich html={item.notes || item.grammar} />
              </div>
            )}
          </div>
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
            Show answer <span className="kbd">Space</span>
          </button>
          <span className="small muted">Say or think your answer first – that's what makes it stick.</span>
        </div>
      ) : (
        <div className="grade3">
          <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={() => rate(0)}>
            Didn't know <span className="kbd">1</span>
          </button>
          <button className="btn" style={{ background: 'var(--near)', color: '#2a1600' }} onClick={() => rate(1)}>
            Partly <span className="kbd">2</span>
          </button>
          <button className="btn good" onClick={() => rate(2)}>
            Knew it <span className="kbd">3</span>
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
  const item = ctx.item(itemId);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'answer' | 'retry' | 'copy' | 'done'>('answer');
  const [res, setRes] = useState<CheckResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [msg, setMsg] = useState('');
  const shown = useRef(now());
  const input = useRef<HTMLInputElement>(null);
  const finalCorrect = useRef(false);
  const t = ctx.t;
  useEffect(() => {
    input.current?.focus();
  }, [phase]);

  const finish = (correct: boolean, delay: number) => {
    finalCorrect.current = correct;
    setPhase('done');
    if (ctx.lang) say(accepted[0], 0.95, ctx.lang);
    if (delay > 0) setTimeout(() => onNext({ correct }), delay);
  };

  const submit = () => {
    if (phase === 'done') return onNext({ correct: finalCorrect.current });
    if (!value.trim()) return;
    const r = checkAnswer(value, accepted, { requireArticle });
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
      setMsg(r.nearMiss ? `${t.near()} ${r.note ?? ''}` : requireArticle ? t.rightArticle() : t.right(ctx.combo + 1));
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
      setMsg(r.articleError ? `${r.note}. ${t.retry()}` : t.retry());
      if (!r.articleError) setValue('');
    } else {
      setPhase('copy');
      setMsg(t.reveal());
      setValue('');
      if (revealAudio) playMedia(item.audio);
      else if (ctx.lang) say(accepted[0], 0.95, ctx.lang);
    }
  };

  const [overridden, setOverridden] = useState(false);
  const iWasRight = () => {
    setOverridden(true);
    ctx.override(itemId);
    ctx.missed.delete(itemId);
    setRes(null);
    setMsg('Okay – counted as correct.');
    finish(true, 700);
  };

  const giveHint = () => {
    if (phase === 'done' || phase === 'copy') return;
    if (hintLevel === 0) {
      setHintLevel(1);
      setMsg(`Hint: ${hint}`);
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
    setMsg(t.reveal());
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
      placeholder={phase === 'copy' ? accepted[0] : format === 'cloze' ? '…' : 'Type your answer…'}
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
        <div
          className={`feedback ${phase === 'done' ? (res?.nearMiss ? 'near' : finalCorrect.current ? 'right' : 'wrong') : phase === 'answer' ? 'near' : 'wrong'}`}
        >
          {msg}
          {(phase === 'copy' || (phase === 'done' && !finalCorrect.current) || res?.nearMiss) && (
            <div className="ans">{requireArticle && item.article ? <Article item={item} /> : accepted[0]}</div>
          )}
          {phase === 'copy' && (
            <div className="small">Type it exactly to continue – writing it fixes it in memory.</div>
          )}
        </div>
      )}
      <div className="actions">
        {phase !== 'done' && (
          <button className="btn primary" onClick={submit}>
            {phase === 'copy' ? 'Copy it' : 'Check'} <span className="kbd">Enter</span>
          </button>
        )}
        {(phase === 'answer' || phase === 'retry') && (
          <button className="btn ghost" onClick={giveHint}>
            {hintLevel ? 'Show answer' : 'Hint'} <span className="kbd">Tab</span>
          </button>
        )}
        {phase === 'done' && (
          <button className="btn" onClick={() => onNext({ correct: finalCorrect.current })}>
            Continue <span className="kbd">Enter</span>
          </button>
        )}
        {(phase === 'retry' || phase === 'copy' || (phase === 'done' && !finalCorrect.current)) && !overridden && (
          <button className="btn ghost" title="The checker was too strict – count it as correct" onClick={iWasRight}>
            I was right
          </button>
        )}
      </div>
    </div>
  );
}

export function Typed({ ex, ctx, onNext, boss }: P<Extract<Exercise, { type: 'typed' }>> & { boss?: boolean }) {
  const item = ctx.item(ex.itemId);
  return (
    <TypedEngine
      ctx={ctx}
      itemId={ex.itemId}
      format={boss ? 'boss' : 'typed'}
      accepted={ex.accepted}
      requireArticle={ex.requireArticle}
      hint={ex.hint}
      onNext={onNext}
      render={(input) => (
        <>
          <div className="blocktitle">{ctx.lang ? 'Type it in the language' : 'Type the answer'}</div>
          {ex.prompt === item.target && <Media item={item} size="sm" />}
          <div className="prompt" style={{ fontSize: ex.prompt.length > 70 ? 22 : undefined }}>
            <Rich html={ex.prompt} />
          </div>
          {input}
        </>
      )}
    />
  );
}

export function Cloze({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'cloze' }>>) {
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
          <div className="blocktitle">Fill the gap</div>
          <Media item={item} size="sm" />
          <div className="cloze">
            {ex.before} {input} {ex.after}
          </div>
          {ex.translation && (
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
      <div className="blocktitle">Build the sentence</div>
      <div className="prompt" style={{ fontSize: 24 }}>
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
                  <span className="kbd" style={{ marginLeft: 6 }}>
                    {label}
                  </span>
                ) : null}
              </button>
            );
          });
        })()}
      </div>
      {result !== null && (
        <div className={`feedback ${result ? 'right' : 'wrong'}`}>
          {result ? ctx.t.right(ctx.combo) : 'Correct order:'}
          {!result && <div className="ans">{ex.answer.join(' ')}</div>}
        </div>
      )}
      <div className="actions">
        {result === null && <span className="small muted">Click tiles or press numbers · Backspace undoes</span>}
        {result === false && (
          <button className="btn" onClick={() => onNext({ correct: false })}>
            Continue <span className="kbd">Enter</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────── Dictation ───────────── */
export function Dictation({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'dictation' }>>) {
  const item = ctx.item(ex.itemId);
  const [value, setValue] = useState('');
  const [res, setRes] = useState<'right' | 'near' | 'wrong' | null>(null);
  const shown = useRef(now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    playMedia(item.audio);
    input.current?.focus();
  }, []);
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
      <div className="blocktitle">Dictation</div>
      <div className="row" style={{ margin: '10px 0 18px' }}>
        <button className="mic" style={{ width: 72, height: 72, fontSize: 30 }} onClick={() => playMedia(item.audio)}>
          🔊
        </button>
        <span className="muted">Type exactly what you hear.</span>
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
        placeholder="…"
      />
      <Umlauts lang={ctx.lang} onAdd={(c) => setValue((v) => v + c)} />
      {res && (
        <div className={`feedback ${res}`}>
          {res === 'right' ? ctx.t.right(ctx.combo) : res === 'near' ? ctx.t.near() : 'Correct:'}
          <div className="ans">{ex.sentence}</div>
          <div className="small">{ex.translation}</div>
        </div>
      )}
      <div className="actions">
        <button className="btn primary" onClick={submit}>
          {res ? 'Continue' : 'Check'} <span className="kbd">Enter</span>
        </button>
      </div>
    </div>
  );
}

/* ───────────── Speak it aloud (speech recognition, or self-check) ───────────── */
export function Speak({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'speak' }>>) {
  const item = ctx.item(ex.itemId);
  const rec = useMemo(() => recognizer(ctx.lang ?? 'de'), []);
  const [phase, setPhase] = useState<'ready' | 'listening' | 'heard' | 'reveal' | 'done'>('ready');
  const [heard, setHeard] = useState('');
  const [tries, setTries] = useState(0);
  const [ok, setOk] = useState<boolean | null>(null);
  const shown = useRef(now());
  const playModel = () =>
    ex.expected === item.sentence && item.audio
      ? playMedia(item.audio)
      : Promise.resolve(say(ex.expected, 0.95, ctx.lang ?? 'de'));
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
      <div className="blocktitle">Say it out loud</div>
      <div className="prompt">{ex.prompt}</div>
      {phase !== 'reveal' && phase !== 'done' && (
        <div className="col" style={{ alignItems: 'center', marginTop: 10 }}>
          <button className={`mic ${phase === 'listening' ? 'on' : ''}`} onClick={listen}>
            🎤
          </button>
          <div className="muted">
            {phase === 'listening' ? 'Listening…' : rec ? 'Press Space and speak' : 'Say it out loud, then press Space'}
          </div>
          {phase === 'heard' && (
            <div className="feedback near">
              I heard: “{heard || '…'}” – {ctx.t.retry()}
            </div>
          )}
          {rec && phase !== 'listening' && (
            <button
              className="btn ghost"
              style={{ fontSize: 13, padding: '6px 12px' }}
              onClick={() => setPhase('reveal')}
            >
              No mic? Say it aloud and check yourself
            </button>
          )}
        </div>
      )}
      {phase === 'reveal' && (
        <div className="feedback near">
          Did you say it like this?<div className="ans">{ex.expected}</div>
          <div className="actions">
            <button className="btn" onClick={() => settle(false)}>
              No <span className="kbd">1</span>
            </button>
            <button className="btn good" onClick={() => settle(true)}>
              Yes <span className="kbd">2</span>
            </button>
            <button className="audio" onClick={playModel}>
              🔊
            </button>
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div className={`feedback ${ok ? 'right' : 'wrong'}`}>
          {ok ? ctx.t.right(ctx.combo) : 'Listen and repeat:'}
          <div className="ans">{ex.expected}</div>
          {heard && <div className="small">Heard: “{heard}”</div>}
          <div className="actions">
            <button className="audio" onClick={playModel}>
              🔊 again
            </button>
            <button className="btn" onClick={() => onNext({ correct: !!ok })}>
              Continue <span className="kbd">Enter</span>
            </button>
          </div>
        </div>
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
      <div className="blocktitle">Lesson · {ex.group}</div>
      <div className="prompt" style={{ fontSize: 28 }}>
        {ex.title}
      </div>
      <p style={{ fontSize: 18, lineHeight: 1.5 }}>{ex.text}</p>
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
          Got it – practise! <span className="kbd">Enter</span>
        </button>
      </div>
    </div>
  );
}

/* ───────────── Multiple choice / multi-select question (certification style) ───────────── */
export function Mcq({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'mcq' }>>) {
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
      <div className="blocktitle">{multi ? `Question · choose ${ex.correct.length}` : 'Question'}</div>
      <Media item={item} size="sm" />
      <div className="prompt" style={{ fontSize: ex.stem.length > 120 ? 19 : 24, lineHeight: 1.4 }}>
        <Rich html={ex.stem} />
      </div>
      <div className="col">
        {ex.choices.map((c, i) => {
          const isCorrect = ex.correct.includes(i);
          const cls =
            done === null ? (sel.includes(i) ? 'right' : '') : isCorrect ? 'right' : sel.includes(i) ? 'wrong' : '';
          return (
            <button
              key={i}
              className={`opt ${cls}`}
              style={{
                borderColor: done === null && sel.includes(i) ? 'var(--accent)' : undefined,
                background: done === null && sel.includes(i) ? '#ffb5471a' : undefined,
              }}
              onClick={() => toggle(i)}
            >
              <span className="k">{multi ? (sel.includes(i) ? '☑' : '☐') : i + 1}</span>
              <Rich html={c} />
            </button>
          );
        })}
      </div>
      {done !== null && (
        <div className={`feedback ${done ? 'right' : 'wrong'}`}>
          {done ? ctx.t.right(ctx.combo) : `Correct: ${ex.correct.map((i) => ex.choices[i]).join(' + ')}`}
          {ex.explanation && (
            <div className="small" style={{ marginTop: 6, fontWeight: 500 }}>
              <Rich html={ex.explanation} />
            </div>
          )}
        </div>
      )}
      <div className="actions">
        {done === null && multi && (
          <button className="btn primary" disabled={!sel.length} onClick={() => submit()}>
            Check <span className="kbd">Enter</span>
          </button>
        )}
        {done !== null && (!done || ex.explanation) && (
          <button className="btn" onClick={() => onNext({ correct: !!done })}>
            Continue <span className="kbd">Enter</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────── Put the steps in order (processes, timelines, code lines) ───────────── */
export function Order({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'order' }>>) {
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const shown = useRef(now());
  const add = (stepIdx: number) => {
    if (result !== null || placed.includes(stepIdx)) return;
    sfx.tap();
    const p = [...placed, stepIdx];
    setPlaced(p);
    if (p.length === ex.steps.length) {
      const ok = p.every((v, i) => v === i);
      setResult(ok);
      ctx.answer({
        itemId: ex.itemId,
        format: 'order',
        correct: ok,
        shownAt: shown.current,
        given: p.map((i) => ex.steps[i]).join(' → '),
      });
      if (!ok) ctx.missed.add(ex.itemId);
      if (ok) setTimeout(() => onNext({ correct: true }), 1000);
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
      <div className="blocktitle">Put in order</div>
      <div className="prompt" style={{ fontSize: 24 }}>
        <Rich html={ex.prompt} />
      </div>
      <ol className="col" style={{ paddingLeft: 22, minHeight: 40 }}>
        {placed.map((s, k) => (
          <li key={k}>
            <button
              className="opt"
              style={{
                width: '100%',
                borderColor: result === null ? undefined : s === k ? 'var(--good)' : 'var(--bad)',
              }}
              onClick={() => result === null && setPlaced(placed.filter((x) => x !== s))}
            >
              <Rich html={ex.steps[s]} />
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
              <Rich html={ex.steps[i]} />
            </button>
          ))}
      </div>
      {result === false && (
        <div className="feedback wrong">
          Correct order:
          <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {ex.steps.map((s, i) => (
              <li key={i}>
                <Rich html={s} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {result === true && <div className="feedback right">{ctx.t.right(ctx.combo)}</div>}
      <div className="actions">
        {result === null && (
          <span className="small muted">Click steps in order or press numbers · Backspace undoes</span>
        )}
        {result === false && (
          <button className="btn" onClick={() => onNext({ correct: false })}>
            Continue <span className="kbd">Enter</span>
          </button>
        )}
      </div>
    </div>
  );
}
