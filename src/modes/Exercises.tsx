import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Item } from '../../shared/types';
import { checkAnswer, similarity, splitBold, normalize, type CheckResult } from '../../shared/text';
import { T } from '../../shared/teacher';
import { playMedia, say, recognizer, sfx } from '../audio';
import { useKeys, type Ctx } from '../ctx';

type P<E> = { ex: E; ctx: Ctx; onNext: (r: { correct: boolean }) => void };
const now = () => performance.now();

function Sentence({ html }: { html: string }) {
  return <span className="sentence" dangerouslySetInnerHTML={{ __html: html.replace(/<(?!\/?b>)[^>]+>/g, '') }} />;
}

function Article({ item }: { item: Item }) {
  if (!item.article) return <>{item.target}</>;
  return <><span className={`art-${item.article}`}>{item.article}</span> {item.word}</>;
}

/* ───────────── Meet a new word (with a "guess the article first" pretest for nouns) ───────────── */
export function Intro({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'intro' }>>) {
  const item = ctx.item(ex.itemId);
  const [phase, setPhase] = useState<'guess' | 'card'>(item.kind === 'noun' && item.article ? 'guess' : 'card');
  const [guess, setGuess] = useState<string | null>(null);
  const shown = useRef(now());
  const recorded = useRef(false);

  useEffect(() => {
    if (phase !== 'card' || recorded.current) return;
    recorded.current = true;
    ctx.answer({ itemId: item.id, format: 'intro', correct: true, shownAt: shown.current, silent: true });
    say(item.target);
    const t = setTimeout(() => playMedia(item.audio), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  const pick = (a: string) => {
    if (guess) return;
    setGuess(a);
    const ok = a === item.article;
    ok ? sfx.right(1) : sfx.wrong();
    ctx.answer({ itemId: item.id, format: 'gender', genderOnly: true, correct: ok, shownAt: shown.current, silent: true });
    setTimeout(() => setPhase('card'), ok ? 600 : 1100);
  };

  useKeys((e) => {
    if (phase === 'guess' && ['1', '2', '3'].includes(e.key)) pick(['der', 'die', 'das'][Number(e.key) - 1]);
    else if (phase === 'card' && e.key === 'Enter') onNext({ correct: true });
    else if (phase === 'card' && e.key === ' ') { e.preventDefault(); playMedia(item.audio); }
  });

  if (phase === 'guess') {
    return (
      <div>
        <div className="blocktitle">Neues Wort · rate den Artikel</div>
        <div className="prompt de">___ {item.word}</div>
        <div className="sub" style={{ marginBottom: 18 }}>{item.meaning} · just guess, you'll learn either way</div>
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
      <div className="blocktitle">Neues Wort</div>
      <div className="word"><Article item={item} /></div>
      <div className="prompt" style={{ fontSize: 24, margin: '6px 0 16px' }}>{item.meaning}</div>
      <div style={{ fontSize: 22 }}><Sentence html={item.sentenceHtml} /></div>
      <div className="muted" style={{ marginTop: 4 }}>{item.sentenceMeaning}</div>
      {item.notes && <div className="small muted" style={{ marginTop: 12 }}>{item.notes}</div>}
      <div className="actions" style={{ justifyContent: 'center' }}>
        <button className="audio" onClick={() => say(item.target)}>🔊 Wort</button>
        {item.audio && <button className="audio" onClick={() => playMedia(item.audio)}>🔊 Satz <span className="kbd">Space</span></button>}
        <button className="btn primary" onClick={() => onNext({ correct: true })}>Weiter <span className="kbd">Enter</span></button>
      </div>
    </div>
  );
}

/* ───────────── Multiple choice (also used for listening) ───────────── */
export function Choice({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'mc' | 'listen' }>>) {
  const item = ctx.item(ex.itemId);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = useRef(now());
  const listen = ex.type === 'listen';

  useEffect(() => {
    if (listen) playMedia(item.audio);
    else if (ex.type === 'mc' && ex.direction === 'de2en') say(item.target);
  }, []);

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === ex.answerIndex;
    ctx.answer({ itemId: item.id, format: listen ? 'listen' : 'mc', correct: ok, shownAt: shown.current, given: ex.options[i] });
    if (ok) setTimeout(() => onNext({ correct: true }), 650);
    else if (ex.type === 'mc' && ex.direction === 'en2de') say(item.target);
  };
  useKeys((e) => {
    if (picked === null && ['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1);
    else if (picked !== null && e.key === 'Enter') onNext({ correct: picked === ex.answerIndex });
    else if (listen && e.key === ' ') { e.preventDefault(); playMedia(item.audio); }
  });

  return (
    <div>
      {listen ? (
        <>
          <div className="blocktitle">Hör zu</div>
          <div className="row" style={{ margin: '10px 0 22px' }}>
            <button className="mic" style={{ width: 80, height: 80, fontSize: 32 }} onClick={() => playMedia(item.audio)}>🔊</button>
            <span className="muted">What does it mean? <span className="kbd">Space</span> replays</span>
          </div>
          {picked !== null && <div className="prompt" style={{ fontSize: 22 }}>{item.sentence}</div>}
        </>
      ) : (
        <>
          <div className="blocktitle">{ex.direction === 'de2en' ? 'Was bedeutet…' : 'Wie sagt man…'}</div>
          <div className={`prompt ${ex.direction === 'de2en' ? 'de' : ''}`}>{ex.direction === 'de2en' ? <Article item={item} /> : ex.prompt}</div>
        </>
      )}
      <div className="options">
        {ex.options.map((o, i) => (
          <button key={i} className={`opt ${picked !== null && i === ex.answerIndex ? 'right' : ''} ${picked === i && i !== ex.answerIndex ? 'wrong' : ''}`} onClick={() => choose(i)}>
            <span className="k">{i + 1}</span>{o}
          </button>
        ))}
      </div>
      {picked !== null && picked !== ex.answerIndex && (
        <div className="actions"><button className="btn" onClick={() => onNext({ correct: false })}>Weiter <span className="kbd">Enter</span></button></div>
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

function Umlauts({ onAdd }: { onAdd: (c: string) => void }) {
  return (
    <div className="umlauts">
      {['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map((c) => (
        <button key={c} tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); onAdd(c); }}>{c}</button>
      ))}
    </div>
  );
}

export function TypedEngine({ ctx, itemId, format, accepted, requireArticle, hint, render, onNext, revealAudio }: TypedProps) {
  const item = ctx.item(itemId);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'answer' | 'retry' | 'copy' | 'done'>('answer');
  const [res, setRes] = useState<CheckResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [msg, setMsg] = useState<string>('');
  const shown = useRef(now());
  const input = useRef<HTMLInputElement>(null);
  const finalCorrect = useRef(false);

  useEffect(() => { input.current?.focus(); }, [phase]);

  const finish = (correct: boolean, delay: number) => {
    finalCorrect.current = correct;
    setPhase('done');
    say(accepted[0]);
    if (delay > 0) setTimeout(() => onNext({ correct }), delay);
  };

  const submit = () => {
    if (phase === 'done') return onNext({ correct: finalCorrect.current });
    if (!value.trim()) return;
    if (phase === 'copy') {
      const r = checkAnswer(value, accepted, { requireArticle });
      if (r.correct && !r.nearMiss) { sfx.tap(); finish(false, 400); }
      else { sfx.wrong(); setValue(''); }
      return;
    }
    const r = checkAnswer(value, accepted, { requireArticle });
    setRes(r);
    const first = phase === 'answer';
    const usedHint = hintLevel > 0;
    if (r.correct) {
      ctx.answer({ itemId, format, correct: true, nearMiss: r.nearMiss, usedHint, firstTry: first, given: value, shownAt: shown.current });
      setMsg(r.nearMiss ? `${T.near()} ${r.note ?? ''}` : requireArticle ? T.rightArticle() : T.right(ctx.combo + 1));
      finish(first, r.nearMiss ? 1500 : 750);
      return;
    }
    ctx.answer({ itemId, format, correct: false, articleError: r.articleError, usedHint, firstTry: first, given: value, shownAt: shown.current });
    ctx.missed.add(itemId);
    if (first) {
      setPhase('retry');
      setMsg(r.articleError ? `${r.note}. ${T.retry()}` : T.retry());
      if (r.articleError) { /* keep the noun, let them fix the article */ } else setValue('');
    } else {
      setPhase('copy');
      setMsg(T.reveal());
      setValue('');
      if (revealAudio) playMedia(item.audio); else say(accepted[0]);
    }
  };

  const giveHint = () => {
    if (phase === 'done' || phase === 'copy') return;
    if (hintLevel === 0) { setHintLevel(1); setMsg(`Tipp: ${hint}`); }
    else {
      ctx.answer({ itemId, format, correct: false, usedHint: true, firstTry: phase === 'answer', given: '(hint)', shownAt: shown.current });
      ctx.missed.add(itemId);
      setPhase('copy'); setMsg(T.reveal()); setValue(''); say(accepted[0]);
    }
  };

  const cls = phase === 'done' ? (res?.nearMiss ? 'near' : finalCorrect.current ? 'right' : '') : phase === 'retry' ? 'wrong' : '';
  const field = (
    <input
      ref={input}
      className={format === 'cloze' ? '' : `typed ${cls}`}
      value={value}
      autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      placeholder={phase === 'copy' ? accepted[0] : format === 'cloze' ? '…' : 'auf Deutsch…'}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        if (e.key === 'Tab') { e.preventDefault(); giveHint(); }
      }}
    />
  );

  return (
    <div>
      {render(field)}
      <Umlauts onAdd={(c) => { setValue((v) => v + c); input.current?.focus(); }} />
      {msg && (
        <div className={`feedback ${phase === 'done' ? (res?.nearMiss ? 'near' : finalCorrect.current ? 'right' : 'wrong') : phase === 'copy' ? 'wrong' : phase === 'retry' ? 'wrong' : 'near'}`}>
          {msg}
          {(phase === 'copy' || (phase === 'done' && !finalCorrect.current) || res?.nearMiss) && (
            <div className="ans">{requireArticle && item.article ? <Article item={item} /> : accepted[0]}</div>
          )}
          {phase === 'copy' && <div className="small">Type it exactly to continue (writing it fixes it in memory).</div>}
        </div>
      )}
      <div className="actions">
        {phase !== 'done' && <button className="btn primary" onClick={submit}>{phase === 'copy' ? 'Abschreiben' : 'Prüfen'} <span className="kbd">Enter</span></button>}
        {(phase === 'answer' || phase === 'retry') && <button className="btn ghost" onClick={giveHint}>{hintLevel ? 'Lösung zeigen' : 'Tipp'} <span className="kbd">Tab</span></button>}
        {phase === 'done' && <button className="btn" onClick={() => onNext({ correct: finalCorrect.current })}>Weiter <span className="kbd">Enter</span></button>}
      </div>
    </div>
  );
}

export function Typed({ ex, ctx, onNext, boss }: P<Extract<Exercise, { type: 'typed' }>> & { boss?: boolean }) {
  return (
    <TypedEngine ctx={ctx} itemId={ex.itemId} format={boss ? 'boss' : 'typed'} accepted={ex.accepted} requireArticle={ex.requireArticle}
      hint={ex.hint} onNext={onNext}
      render={(input) => (
        <>
          <div className="blocktitle">Auf Deutsch</div>
          <div className="prompt">{ex.prompt}</div>
          {input}
        </>
      )} />
  );
}

export function Cloze({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'cloze' }>>) {
  const item = ctx.item(ex.itemId);
  return (
    <TypedEngine ctx={ctx} itemId={ex.itemId} format="cloze" accepted={ex.accepted} requireArticle={false} hint={ex.hint}
      onNext={onNext} revealAudio
      render={(input) => (
        <>
          <div className="blocktitle">Lückentext</div>
          <div className="cloze">{ex.before} {input} {ex.after}</div>
          <div className="muted" style={{ marginTop: 10 }}>{ex.translation}</div>
          {item.kind !== 'grammar' && <div className="small muted">({item.meaning})</div>}
        </>
      )} />
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
      <div className="blocktitle">Satz bauen</div>
      <div className="prompt" style={{ fontSize: 24 }}>{ex.translation}</div>
      <div className="tiles" style={{ borderColor: result === null ? undefined : result ? 'var(--good)' : 'var(--bad)' }}>
        {order.map((i, k) => <button key={k} className="tile" onClick={() => result === null && setOrder(order.filter((x) => x !== i))}>{ex.tiles[i]}</button>)}
      </div>
      <div className="tiles" style={{ border: 'none', marginTop: 10 }}>
        {(() => { let k = 0; return ex.tiles.map((t, i) => {
          const used = order.includes(i);
          const label = used ? null : ++k;
          return <button key={i} className={`tile ${used ? 'used' : ''}`} onClick={() => add(i)}>{t}{label && label < 10 ? <span className="kbd" style={{ marginLeft: 6 }}>{label}</span> : null}</button>;
        }); })()}
      </div>
      {result !== null && (
        <div className={`feedback ${result ? 'right' : 'wrong'}`}>
          {result ? T.right(ctx.combo) : 'So ist es richtig:'}
          {!result && <div className="ans">{ex.answer.join(' ')}</div>}
        </div>
      )}
      <div className="actions">
        {result === null && <span className="small muted">Click tiles or press numbers · Backspace undoes</span>}
        {result === false && <button className="btn" onClick={() => onNext({ correct: false })}>Weiter <span className="kbd">Enter</span></button>}
      </div>
    </div>
  );
}

/* ───────────── Dictation: hear a sentence, type it ───────────── */
export function Dictation({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'dictation' }>>) {
  const item = ctx.item(ex.itemId);
  const [value, setValue] = useState('');
  const [res, setRes] = useState<'right' | 'near' | 'wrong' | null>(null);
  const shown = useRef(now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { playMedia(item.audio); input.current?.focus(); }, []);
  const submit = () => {
    if (res) return onNext({ correct: res !== 'wrong' });
    if (!value.trim()) return;
    const s = similarity(value, ex.sentence);
    const r = s === 1 ? 'right' : s >= 0.85 ? 'near' : 'wrong';
    setRes(r);
    ctx.answer({ itemId: item.id, format: 'dictation', correct: r !== 'wrong', nearMiss: r === 'near', shownAt: shown.current, given: value });
    if (r === 'wrong') ctx.missed.add(item.id);
    if (r === 'right') setTimeout(() => onNext({ correct: true }), 900);
  };
  return (
    <div>
      <div className="blocktitle">Diktat</div>
      <div className="row" style={{ margin: '10px 0 18px' }}>
        <button className="mic" style={{ width: 72, height: 72, fontSize: 30 }} onClick={() => playMedia(item.audio)}>🔊</button>
        <span className="muted">Type exactly what you hear.</span>
      </div>
      <input ref={input} className={`typed ${res ?? ''}`} value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} autoComplete="off"
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="…" />
      <Umlauts onAdd={(c) => setValue((v) => v + c)} />
      {res && <div className={`feedback ${res}`}>{res === 'right' ? T.right(ctx.combo) : res === 'near' ? T.near() : 'Richtig wäre:'}<div className="ans">{ex.sentence}</div><div className="small">{ex.translation}</div></div>}
      <div className="actions"><button className="btn primary" onClick={submit}>{res ? 'Weiter' : 'Prüfen'} <span className="kbd">Enter</span></button></div>
    </div>
  );
}

/* ───────────── Speak: say it out loud (speech recognition, or self-check) ───────────── */
export function Speak({ ex, ctx, onNext }: P<Extract<Exercise, { type: 'speak' }>>) {
  const item = ctx.item(ex.itemId);
  const rec = useMemo(() => recognizer(), []);
  const [phase, setPhase] = useState<'ready' | 'listening' | 'heard' | 'reveal' | 'done'>('ready');
  const [heard, setHeard] = useState('');
  const [tries, setTries] = useState(0);
  const [ok, setOk] = useState<boolean | null>(null);
  const shown = useRef(now());

  const playModel = () => (ex.expected === item.sentence && item.audio ? playMedia(item.audio) : Promise.resolve(say(ex.expected)));

  const settle = (correct: boolean, near = false) => {
    setOk(correct);
    setPhase('done');
    ctx.answer({ itemId: item.id, format: 'speak', correct, nearMiss: near, firstTry: tries === 0, shownAt: shown.current, given: heard });
    if (!correct) ctx.missed.add(item.id);
    playModel();
  };

  const listen = () => {
    if (!rec) return setPhase('reveal');
    setPhase('listening');
    rec.onresult = (e: any) => {
      const alts: string[] = Array.from(e.results[0]).map((r: any) => r.transcript);
      const best = alts.reduce((b, a) => (similarity(a, ex.expected) > similarity(b, ex.expected) ? a : b), alts[0] ?? '');
      const s = similarity(best, ex.expected);
      setHeard(best);
      if (s >= 0.8) settle(true, s < 0.95);
      else if (tries === 0) { setTries(1); setPhase('heard'); sfx.near(); }
      else settle(false);
    };
    rec.onerror = (e: any) => {
      // No mic permission, no network or no recogniser: fall back to "say it, then check yourself".
      if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e?.error)) setPhase('reveal');
      else setPhase('heard');
    };
    rec.onend = () => setPhase((p) => (p === 'listening' ? 'heard' : p));
    try { rec.start(); } catch { /* already started */ }
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
      <div className="blocktitle">Sag es laut</div>
      <div className="prompt">{ex.prompt}</div>
      {phase !== 'reveal' && phase !== 'done' && (
        <div className="col" style={{ alignItems: 'center', marginTop: 10 }}>
          <button className={`mic ${phase === 'listening' ? 'on' : ''}`} onClick={listen}>🎤</button>
          <div className="muted">{phase === 'listening' ? 'Ich höre zu…' : rec ? 'Press Space and speak German' : 'Say it out loud, then press Space'}</div>
          {phase === 'heard' && <div className="feedback near">Ich habe gehört: „{heard || '…'}“ – {T.retry()}</div>}
          {rec && phase !== 'listening' && <button className="btn ghost" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => setPhase('reveal')}>No mic? Say it aloud and check yourself</button>}
        </div>
      )}
      {phase === 'reveal' && (
        <div className="feedback near">
          Did you say it like this?<div className="ans">{ex.expected}</div>
          <div className="actions"><button className="btn" onClick={() => settle(false)}>Nein <span className="kbd">1</span></button><button className="btn good" onClick={() => settle(true)}>Ja, richtig <span className="kbd">2</span></button><button className="audio" onClick={playModel}>🔊</button></div>
        </div>
      )}
      {phase === 'done' && (
        <div className={`feedback ${ok ? 'right' : 'wrong'}`}>
          {ok ? T.right(ctx.combo) : 'Hör zu und sprich nach:'}
          <div className="ans">{ex.expected}</div>
          {heard && <div className="small">Gehört: „{heard}“</div>}
          <div className="actions"><button className="audio" onClick={playModel}>🔊 nochmal</button><button className="btn" onClick={() => onNext({ correct: !!ok })}>Weiter <span className="kbd">Enter</span></button></div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Grammar micro-lesson: one rule in under a minute ───────────── */
export function Lesson({ ex, ctx, onNext, grammarIds }: P<Extract<Exercise, { type: 'lesson' }>> & { grammarIds: number[] }) {
  const shown = useRef(now());
  useEffect(() => {
    for (const id of grammarIds) ctx.answer({ itemId: id, format: 'intro', correct: true, shownAt: shown.current, silent: true });
  }, []);
  useKeys((e) => { if (e.key === 'Enter') onNext({ correct: true }); });
  return (
    <div className="card lesson">
      <div className="blocktitle">Grammatik · {ex.group}</div>
      <div className="prompt" style={{ fontSize: 28 }}>{ex.title}</div>
      <p style={{ fontSize: 18, lineHeight: 1.5 }}>{ex.text}</p>
      <div className="col">
        {ex.examples.map((e, i) => (
          <button key={i} className="opt" onClick={() => say(e.de)}>🔊 <span><b>{e.de}</b><br /><span className="small muted">{e.en}</span></span></button>
        ))}
      </div>
      <div className="actions"><button className="btn primary" onClick={() => onNext({ correct: true })}>Verstanden – üben! <span className="kbd">Enter</span></button></div>
    </div>
  );
}

export { Article, Sentence, splitBold };
