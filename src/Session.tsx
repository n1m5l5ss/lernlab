import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Block, Exercise, Item, SessionPlan } from '../shared/types';
import { xpFor } from '../shared/game';
import { T } from '../shared/teacher';
import { sendAttempt } from './api';
import { say, sfx } from './audio';
import { useKeys, type AnswerInput, type BlockResult, type Ctx } from './ctx';
import { Choice, Cloze, Dictation, Intro, Lesson, Speak, Typed, Unscramble } from './modes/Exercises';
import { Boss, GenderSprint, MatchPairs, WordRain } from './modes/Games';
import { mcFor, typedFor } from './plan';

export type SessionResult = {
  sessionId: string; length: string; seconds: number; answers: number; correct: number; xp: number;
  bossWon: boolean | null; bestGenderCombo: number; perfectBlocks: number; startedAt: string; missed: number[];
};

const RECALL = new Set(['typed', 'cloze']);

/* A block of single exercises with re-queueing: a missed recall item comes back 3 exercises later. */
function ExerciseBlock({ block, ctx, onDone }: { block: Extract<Block, { exercises: Exercise[] }>; ctx: Ctx; onDone: (r: BlockResult) => void }) {
  const [queue, setQueue] = useState<Exercise[]>(block.exercises);
  const [i, setI] = useState(0);
  const tally = useRef({ correct: 0, total: 0, requeued: new Set<number>() });
  const grammarIds = useMemo(() => block.exercises.map((e) => ('itemId' in e ? e.itemId : 0)).filter(Boolean), []);

  const next = (r: { correct: boolean }) => {
    const ex = queue[i];
    if (ex.type !== 'intro' && ex.type !== 'lesson') {
      tally.current.total++;
      if (r.correct) tally.current.correct++;
    }
    let q = queue;
    if (!r.correct && 'itemId' in ex && RECALL.has(ex.type) && !tally.current.requeued.has(ex.itemId)) {
      tally.current.requeued.add(ex.itemId);
      q = [...queue];
      q.splice(Math.min(q.length, i + 4), 0, typedFor(ctx.item(ex.itemId)));
      setQueue(q);
    }
    if (i + 1 >= q.length) onDone({ correct: tally.current.correct, total: tally.current.total });
    else setI(i + 1);
  };

  const ex = queue[i];
  if (!ex) return null;
  const k = `${block.id}-${i}`;
  switch (ex.type) {
    case 'intro': return <Intro key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'mc': case 'listen': return <Choice key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'typed': return <Typed key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'cloze': return <Cloze key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'unscramble': return <Unscramble key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'dictation': return <Dictation key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'speak': return <Speak key={k} ex={ex} ctx={ctx} onNext={next} />;
    case 'lesson': return <Lesson key={k} ex={ex} ctx={ctx} onNext={next} grammarIds={grammarIds} />;
  }
}

export function Session({ plan, settings, onFinish, onQuit }: {
  plan: SessionPlan; settings: { sound: boolean; teacherVoice: boolean };
  onFinish: (r: SessionResult) => void; onQuit: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(plan.blocks);
  const [bi, setBi] = useState(0);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bubble, setBubble] = useState<{ de: string; en?: string }>({ de: plan.agenda, en: plan.agendaEn });
  const [floats, setFloats] = useState<{ id: number; xp: number }[]>([]);
  const started = useRef({ at: Date.now(), iso: new Date().toISOString() });
  const totals = useRef({ answers: 0, correct: 0, perfectBlocks: 0, bestGender: 0, bossWon: null as boolean | null });
  const missed = useRef(new Set<number>());
  const responseTimes = useRef<number[]>([]);
  const slowStreak = useRef(0);
  const kickPending = useRef(false);
  const lastActivity = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const comboRef = useRef(0);

  const pool: Item[] = useMemo(() => [...Object.values(plan.items), ...Object.values(plan.extras)], [plan]);
  const item = useCallback((id: number) => plan.items[id] ?? plan.extras[id], [plan]);

  const teacher = useCallback((de: string, en?: string) => {
    setBubble({ de, en });
    if (settings.teacherVoice) say(de, 1);
  }, [settings.teacherVoice]);

  useEffect(() => { if (settings.teacherVoice) say(plan.agenda, 1); }, []);

  // Attention: nudge after 20 s idle; a long tab switch or several slow answers triggers an action round.
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastActivity.current > 20000) { lastActivity.current = Date.now(); setBubble({ de: T.idle(), en: 'Still there? Keep going!' }); sfx.tick(); }
    }, 2000);
    const vis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 15000) kickPending.current = true;
    };
    const act = () => { lastActivity.current = Date.now(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('keydown', act);
    window.addEventListener('pointerdown', act);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', act); window.removeEventListener('pointerdown', act); };
  }, []);

  const answer = useCallback((a: AnswerInput): number => {
    const ms = performance.now() - a.shownAt;
    const counts = a.format !== 'intro';
    let gained = 0;
    if (counts && !a.silent) {
      const ok = a.correct && !a.articleError;
      comboRef.current = ok ? comboRef.current + 1 : 0;
      setCombo(comboRef.current);
      gained = xpFor(a.format, ok, comboRef.current);
      setXp((x) => x + gained);
      totals.current.answers++;
      if (ok) totals.current.correct++;
      if (ok) { a.nearMiss ? sfx.near() : sfx.right(comboRef.current); } else sfx.wrong();
      if (gained > 1) {
        const id = Math.random();
        setFloats((f) => [...f, { id, xp: gained }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
      }
      // slow-answer detector (ignores timed games)
      if (!['gender', 'rain', 'match'].includes(a.format)) {
        const rt = responseTimes.current;
        const median = rt.length ? [...rt].sort((x, y) => x - y)[Math.floor(rt.length / 2)] : ms;
        slowStreak.current = rt.length >= 5 && ms > 2 * median && ms > 7000 ? slowStreak.current + 1 : 0;
        rt.push(ms);
        if (slowStreak.current >= 3) { kickPending.current = true; slowStreak.current = 0; }
      }
    }
    if (!a.correct && counts && !a.genderOnly) missed.current.add(a.itemId);
    sendAttempt({
      sessionId: plan.id, itemId: a.itemId, format: a.format, correct: a.correct, nearMiss: a.nearMiss,
      articleError: a.articleError, usedHint: a.usedHint, firstTry: a.firstTry, responseMs: ms, given: a.given,
      xp: gained, genderOnly: a.genderOnly,
    });
    return gained;
  }, [plan.id]);

  const ctx: Ctx = { plan, item, pool, answer, combo, missed: missed.current, teacher, settings };

  const blockDone = (r: BlockResult) => {
    const b = blocks[bi];
    if (r.total >= 3 && r.correct === r.total) { totals.current.perfectBlocks++; setFloats((f) => [...f, { id: Math.random(), xp: 20 }]); }
    if (b.kind === 'gender' && r.bestCombo) totals.current.bestGender = Math.max(totals.current.bestGender, r.bestCombo);
    if (b.kind === 'boss') totals.current.bossWon = r.bossWon ?? null;

    let rest = blocks.slice(bi + 1);
    // Struggling (under 60%)? Insert a quick recognition rescue round on the missed words.
    if (b.kind === 'drill' && r.total >= 3 && r.correct / r.total < 0.6) {
      const ids = [...missed.current].slice(-5);
      if (ids.length >= 2) rest = [{ id: `rescue-${bi}`, kind: 'drill', format: 'mc', title: 'Rettung', teacher: 'Kurz zurück zu den schweren Wörtern.', exercises: ids.map((id) => mcFor(item(id), pool)) }, ...rest];
    }
    // Attention dipped? Insert a 25-second action round.
    if (kickPending.current && b.kind !== 'gender' && rest[0]?.kind !== 'gender') {
      kickPending.current = false;
      const nouns = pool.filter((p) => p.article).map((p) => p.id).slice(0, 30);
      if (nouns.length >= 4) {
        const [de, en] = T.kick();
        rest = [{ id: `kick-${bi}`, kind: 'gender', title: 'Action-Runde', teacher: de, itemIds: nouns, seconds: 25 }, ...rest];
        setBubble({ de, en });
      }
    }
    const nb = [...blocks.slice(0, bi + 1), ...rest];
    setBlocks(nb);
    if (bi + 1 >= nb.length) return finish();
    const n = nb[bi + 1];
    teacher(n.teacher);
    setBi(bi + 1);
  };

  const finish = () => {
    onFinish({
      sessionId: plan.id, length: plan.length, seconds: Math.round((Date.now() - started.current.at) / 1000),
      answers: totals.current.answers, correct: totals.current.correct, xp, bossWon: totals.current.bossWon,
      bestGenderCombo: totals.current.bestGender, perfectBlocks: totals.current.perfectBlocks, startedAt: started.current.iso,
      missed: [...missed.current],
    });
  };

  useKeys((e) => { if (e.key === 'Escape') onQuit(); });

  const b = blocks[bi];
  return (
    <div className="wrap">
      <div className="topbar">
        <button className="x" onClick={onQuit} title="Stop (Esc)">✕</button>
        <div className="segs">{blocks.map((x, i) => <i key={x.id} className={i < bi ? 'done' : i === bi ? 'now' : ''} />)}</div>
        <span className={`pill combo ${combo >= 3 ? 'hot' : ''}`} key={combo}>🔥 {combo}</span>
        <span className="pill">⭐ {xp}</span>
      </div>
      <div className="teacher" style={{ marginBottom: 18 }}>
        <div className="avatar">L</div>
        <div className="bubble"><div>{bubble.de}</div>{bubble.en && <div className="en">{bubble.en}</div>}</div>
      </div>
      <div className="stage" key={b.id}>
        {b.kind === 'gender' ? <GenderSprint block={b} ctx={ctx} onDone={blockDone} />
          : b.kind === 'match' ? <MatchPairs block={b} ctx={ctx} onDone={blockDone} />
          : b.kind === 'rain' ? <WordRain block={b} ctx={ctx} onDone={blockDone} />
          : b.kind === 'boss' ? <Boss block={b} ctx={ctx} onDone={blockDone} />
          : <ExerciseBlock block={b} ctx={ctx} onDone={blockDone} />}
      </div>
      {floats.map((f) => <div key={f.id} className="xpfloat" style={{ right: 'max(24px, calc(50vw - 420px))', top: 64 }}>+{f.xp}</div>)}
    </div>
  );
}
