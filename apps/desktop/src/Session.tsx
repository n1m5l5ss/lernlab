import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Block, Exercise, Item, SessionPlan, Sketch } from '@lernlab/core/types';
import { BONUS, dayKey, xpFor } from '@lernlab/core/game';
import { mnemonicOf, nextRun } from '@lernlab/core/mnemonic';
import type { Confidence } from '@lernlab/core/confidence';
import { teacherFor, type Line } from '@lernlab/core/teacher';
import { api, sendAttempt, sendConfidence, sendOverride } from './api';
import { hasVoice, onNoVoice, say, setSound, setSpeechPrefs, sfx } from './audio';
import { formatLanguage } from './i18n';
import { useKeys, type AnswerInput, type BlockResult, type Ctx } from './ctx';
import {
  Choice,
  Cloze,
  Dictation,
  Flip,
  Intro,
  Lesson,
  Mcq,
  Myth,
  Order,
  Speak,
  TrueFalse,
  Typed,
  Unscramble,
} from './modes/Exercises';
import { Explain } from './modes/Explain';
import { Twin } from './modes/Twin';
import { Worked } from './modes/Worked';
import { CaseFor } from './case-view';
import { Boss, GenderSprint, MatchPairs, WordRain } from './modes/Games';
import { GuessBlock } from './modes/Guess';
import { mcFor, recallFor } from './plan';
import { addReward, floatReason, newRewardTally, type RewardTally } from './reward-logic';
import { canSwap, swapBlock } from './swap-logic';
import { agendaText, bubbleFor, textTeacher, type Bubble } from './lines';
import {
  Relearn,
  answerKind,
  asRepeat,
  asksConfidence,
  asksConfidenceHere,
  blockKey,
  isConfidentMiss,
  needsRescue,
  plannedRecalls,
  playableOnly,
} from './session-logic';
import { Button, ProgressBar } from './components';

/** Where the learner is inside the current block, for the progress bar and "5 of 12". */
type Step = { done: number; total: number } | null;

export type SessionResult = {
  sessionId: string;
  length: string;
  seconds: number;
  answers: number;
  correct: number;
  xp: number;
  bossWon: boolean | null;
  bestGenderCombo: number;
  perfectBlocks: number;
  startedAt: string;
  missed: number[];
  practice: boolean;
  /** New cards met in this session. */
  introduced: number;
  /** Their ids, for "Will you know this tomorrow?" on the summary (#205). */
  newCards: number[];
  /** What the answers earned, by reason, so the summary can say what the XP was for (#216). */
  rewards: RewardTally;
};

/** How long the number that floats up after an answer stays (the floatup animation in styles.css). */
const FLOAT_MS = 900;

/** Blocks of single exercises can bring cards back; games and blitz rounds can't. */
const hostsRepeats = (b: Block) => 'exercises' in b && b.kind !== 'blitz';

/*
 * A block of single exercises. Missed cards and new cards come back a few exercises later (successive
 * relearning, see Relearn), as practice, until they meet their target.
 */
function ExerciseBlock({
  block,
  ctx: ctxIn,
  relearn,
  plannedLater,
  last,
  confidence,
  onDone,
  onStep,
}: {
  block: Extract<Block, { exercises: Exercise[] }>;
  ctx: Ctx;
  relearn: Relearn;
  /** Saves "How sure were you?" when this block asks it (#205); undefined when it doesn't. */
  confidence?: Ctx['confidence'];
  /** Recalls of each card planned in later blocks. */
  plannedLater: Map<number, number>;
  /** No later block can bring cards back: a card still missed gets its last tries here. */
  last: boolean;
  onDone: (r: BlockResult) => void;
  onStep: (s: Step) => void;
}) {
  let ctx = ctxIn;
  const [queue, setQueue] = useState<Exercise[]>(block.exercises);
  const [i, setI] = useState(0);
  const tally = useRef({ correct: 0, total: 0 });
  const repeats = useRef(new WeakSet<Exercise>());
  const grammarIds = useMemo(() => block.exercises.map((e) => ('itemId' in e ? e.itemId : 0)).filter(Boolean), []);
  const { t: tr } = useTranslation();
  // How sure the learner was of each card's real answer in this block (#205): a confident miss comes back once.
  const sure = useRef(new Map<number, Confidence>());
  const today = useMemo(() => dayKey(), []);
  const rate = useMemo(
    () =>
      confidence &&
      ((itemId: number, value: Confidence) => {
        sure.current.set(itemId, value);
        confidence(itemId, value);
      }),
    [confidence],
  );

  const next = (r: { correct: boolean }) => {
    const ex = queue[i];
    if (ex.type !== 'intro' && ex.type !== 'lesson') {
      tally.current.total++;
      if (r.correct) tally.current.correct++;
    }
    const id = 'itemId' in ex ? ex.itemId : 0;
    // Only a real answer can be a confident miss: a card brought back is never rated.
    const surprise = !!id && !repeats.current.has(ex) && isConfidentMiss(r.correct, sure.current.get(id));
    if (id) relearn.answered(id, answerKind(ex.type), r.correct, { fresh: block.kind === 'learn', surprise });
    else relearn.skip(1);
    if (surprise) ctx.teacher(tr('session.confidentMiss'));
    let q = queue;
    const ahead = plannedRecalls(queue.slice(i + 1));
    const back = relearn.due((itemId) => (ahead.get(itemId) ?? 0) + (plannedLater.get(itemId) ?? 0), {
      ending: last && i + 1 >= queue.length,
      last: id,
    });
    const item = back === null ? undefined : ctx.item(back);
    if (back !== null && item) {
      if (relearn.isSurprise(back) && back !== id) ctx.teacher(tr('session.confidentMissBack'));
      relearn.shown(back);
      const again = recallFor(item);
      repeats.current.add(again);
      q = [...queue.slice(0, i + 1), again, ...queue.slice(i + 1)];
      setQueue(q);
    }
    if (i + 1 >= q.length) onDone({ correct: tally.current.correct, total: tally.current.total });
    else setI(i + 1);
  };

  useEffect(() => onStep({ done: i, total: queue.length }), [i, queue.length]);

  const ex = queue[i];
  if (!ex) return null;
  const k = `${block.id}-${i}`;
  // Timers only on review blocks: time pressure while first learning a card hurts memory.
  if (block.kind !== 'drill') ctx = { ...ctx, timer: 0 };
  // About 1 in 4 recall answers ask how sure you were; the others move on exactly as before.
  if (rate && 'itemId' in ex && asksConfidenceHere(ex.itemId, today, i)) ctx = { ...ctx, confidence: rate };
  if (repeats.current.has(ex)) ctx = asRepeat<AnswerInput, Ctx>(ctx);
  // A question of a case chain shows its case above it, whatever the exercise.
  return (
    <>
      <CaseFor item={'itemId' in ex ? ctx.item(ex.itemId) : null} />
      {exercise()}
    </>
  );

  function exercise() {
    switch (ex.type) {
      case 'intro':
        return <Intro key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'mc':
      case 'listen':
      case 'imagemc':
        return <Choice key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'truefalse':
        return <TrueFalse key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'flip':
        return <Flip key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'myth':
        return <Myth key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'explain':
        return <Explain key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'twin':
        return <Twin key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'worked':
        return <Worked key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'mcq':
        return <Mcq key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'order':
        return <Order key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'typed':
        return <Typed key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'cloze':
        return <Cloze key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'unscramble':
        return <Unscramble key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'dictation':
        return <Dictation key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'speak':
        return <Speak key={k} ex={ex} ctx={ctx} onNext={next} />;
      case 'lesson':
        return <Lesson key={k} ex={ex} ctx={ctx} onNext={next} grammarIds={grammarIds} />;
    }
  }
}

/* Blitz: rapid-fire multiple choice and true/false with a per-question timer. */
function BlitzBlock({
  block,
  ctx,
  onDone,
  onStep,
}: {
  block: Extract<Block, { kind: 'blitz' }>;
  ctx: Ctx;
  onDone: (r: BlockResult) => void;
  onStep: (s: Step) => void;
}) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const tally = useRef({ correct: 0, total: 0 });
  const ex = block.exercises[i];
  useEffect(() => onStep({ done: i, total: block.exercises.length }), [i]);
  const next = (r: { correct: boolean }) => {
    tally.current.total++;
    if (r.correct) tally.current.correct++;
    if (i + 1 >= block.exercises.length) onDone(tally.current);
    else setI(i + 1);
  };
  if (!ex) return null;
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <div className="blocktitle grow">{t('session.blitz', { n: i + 1, total: block.exercises.length })}</div>
        <span className="pill">{t('session.perQuestion', { count: block.secondsPerQuestion })}</span>
      </div>
      {ex.type === 'truefalse' ? (
        <TrueFalse key={i} ex={ex} ctx={ctx} onNext={next} seconds={block.secondsPerQuestion} />
      ) : ex.type === 'mc' ? (
        <Choice key={i} ex={ex} ctx={ctx} onNext={next} seconds={block.secondsPerQuestion} />
      ) : null}
    </div>
  );
}

export function Session({
  plan,
  settings,
  onFinish,
  onQuit,
}: {
  plan: SessionPlan;
  settings: {
    sound: boolean;
    teacherVoice: boolean;
    questionTimer?: number;
    blitzSeconds?: number;
    confidence?: boolean;
    /** Calm mode (#216): no XP, combo or floating numbers on screen. XP is still counted. */
    calm?: boolean;
  };
  onFinish: (r: SessionResult) => void;
  onQuit: () => void;
}) {
  const { t: tr, i18n } = useTranslation();
  // Each deck's voice and speed, and the "no voice" note, are set up while rendering: the exercise inside
  // reads its card aloud in an effect, and a child's effects run before ours.
  // The language with no voice; false once the learner closed the note (it stays closed this session).
  const [noVoice, setNoVoice] = useState<string | false | null>(null);
  const noteNoVoice = useCallback((lang: string) => setNoVoice((v) => (v === false ? v : lang)), []);
  const speechFor = useRef<SessionPlan | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  if (speechFor.current !== plan) {
    setSpeechPrefs(plan.speech);
    speechFor.current = plan;
  }
  stopListening.current ??= onNoVoice(noteNoVoice);
  useEffect(() => {
    stopListening.current ??= onNoVoice(noteNoVoice);
    return () => {
      stopListening.current?.();
      stopListening.current = null;
    };
  }, []);
  // Listening and dictation the computer can't play (no recording, no voice for the language) are left out.
  const [blocks, setBlocks] = useState<Block[]>(() =>
    plan.blocks
      .map((b) => {
        if (!('exercises' in b)) return b;
        const it = (id: number) => plan.items[id] ?? plan.extras[id];
        const exercises = playableOnly(b.exercises, (id) => !!it(id)?.audio || hasVoice(it(id)?.lang));
        return { ...b, exercises } as Block;
      })
      .filter((b) => !('exercises' in b) || b.exercises.length > 0),
  );
  const [bi, setBi] = useState(0);
  // Nothing left to play (e.g. a listening-only plan with no voices): go back home instead of showing an empty session.
  useEffect(() => {
    if (blocks.length === 0) onQuit();
  }, [blocks.length, onQuit]);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bubble, setBubble] = useState<Bubble>(() => {
    const agenda = agendaText(plan, tr, i18n.language);
    return plan.agendaTarget ? { main: plan.agendaTarget, gloss: agenda } : { main: agenda, gloss: '' };
  });
  const [floats, setFloats] = useState<{ id: number; text: string }[]>([]);
  const calm = settings.calm === true;
  const rewards = useRef(newRewardTally());
  // Swap a round (#216): once per session, and only before the round's first answer.
  const [swapped, setSwapped] = useState(false);
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState<Step>(null);
  const [paused, setPaused] = useState(false);
  const [sound, setSoundOn] = useState(settings.sound);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const started = useRef({ at: Date.now(), iso: new Date().toISOString() });
  const totals = useRef({
    answers: 0,
    introduced: 0,
    correct: 0,
    perfectBlocks: 0,
    bestGender: 0,
    bossWon: null as boolean | null,
  });
  const missed = useRef(new Set<number>());
  const newCards = useRef(new Set<number>());
  const relearn = useRef(new Relearn());
  const responseTimes = useRef<number[]>([]);
  const slowStreak = useRef(0);
  const kickPending = useRef(false);
  const lastActivity = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const comboRef = useRef(0);

  const pool: Item[] = useMemo(() => [...Object.values(plan.items), ...Object.values(plan.extras)], [plan]);
  const item = useCallback((id: number) => plan.items[id] ?? plan.extras[id], [plan]);

  const coach = useMemo(() => teacherFor(plan.lang), [plan.lang]);
  const t = useMemo(() => textTeacher(coach, tr), [coach, tr]);
  const voice = settings.teacherVoice && !!plan.lang;
  const show = useCallback(
    (b: Bubble) => {
      setBubble(b);
      if (voice) say(b.main, 1, plan.lang ?? 'en', plan.deckId);
    },
    [voice],
  );
  const teacher = useCallback(
    (line: Line | string) => show(typeof line === 'string' ? { main: line, gloss: '' } : bubbleFor(line, tr)),
    [show, tr],
  );

  useEffect(() => {
    if (voice) say(bubble.main, 1, plan.lang ?? 'en', plan.deckId);
  }, []);

  // Attention: nudge after 20 s idle; a long tab switch or several slow answers triggers an action round.
  useEffect(() => {
    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivity.current > 20000) {
        lastActivity.current = Date.now();
        setBubble(bubbleFor(coach.idle(), tr));
        sfx.tick();
      }
    }, 2000);
    const vis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 15000) kickPending.current = true;
    };
    const act = () => {
      lastActivity.current = Date.now();
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('keydown', act);
    window.addEventListener('pointerdown', act);
    return () => {
      clearInterval(idleTimer);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('keydown', act);
      window.removeEventListener('pointerdown', act);
    };
  }, []);

  const runs = useRef(new Map<number, number | undefined>());
  const runBeforeMiss = useRef(new Map<number, number | undefined>());
  const mnemonicRun = useCallback(
    (id: number) => (runs.current.has(id) ? runs.current.get(id) : item(id)?.mnemonicRun),
    [item],
  );
  const answer = useCallback(
    (a: AnswerInput): number => {
      const ms = performance.now() - a.shownAt;
      const counts = a.format !== 'intro';
      if (!counts) {
        totals.current.introduced++;
        newCards.current.add(a.itemId);
      }
      let gained = 0;
      setTouched(true);
      if (counts && !a.silent) {
        const ok = a.correct && !a.articleError;
        comboRef.current = ok ? comboRef.current + 1 : 0;
        setCombo(comboRef.current);
        gained = xpFor(a.format, ok, comboRef.current);
        setXp((x) => x + gained);
        const earned = { format: a.format, ok, combo: comboRef.current, slipped: missed.current.has(a.itemId) };
        addReward(rewards.current, { ...earned, gained });
        totals.current.answers++;
        if (ok) totals.current.correct++;
        if (ok) {
          a.nearMiss ? sfx.near() : sfx.right(calm ? 1 : comboRef.current); // calm: the pitch doesn't climb
        } else sfx.wrong();
        if (gained > 1 && !calm) {
          const id = Math.random();
          // The number says what it is for: a card back after a slip, or answers in a row.
          const why = floatReason(earned);
          const text =
            why?.reason === 'comeback'
              ? tr('session.xpFloatComeback', { xp: gained })
              : why?.reason === 'run'
                ? tr('session.xpFloatRun', { xp: gained, count: why.count })
                : tr('session.xpFloat', { xp: gained });
          setFloats((f) => [...f, { id, text }]);
          setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_MS);
        }
        // slow-answer detector (ignores timed games)
        if (!['gender', 'rain', 'match', 'blitz', 'truefalse', 'flip'].includes(a.format)) {
          const rt = responseTimes.current;
          const median = rt.length ? [...rt].sort((x, y) => x - y)[Math.floor(rt.length / 2)] : ms;
          slowStreak.current = rt.length >= 5 && ms > 2 * median && ms > 7000 ? slowStreak.current + 1 : 0;
          rt.push(ms);
          if (slowStreak.current >= 3) {
            kickPending.current = true;
            slowStreak.current = 0;
          }
        }
      }
      if (!a.correct && counts && !a.genderOnly) missed.current.add(a.itemId);
      // Fading mnemonics (#221): keep the card's run of correct recalls up to date within the session.
      if (!a.genderOnly && mnemonicOf(item(a.itemId))) {
        const before = mnemonicRun(a.itemId);
        if (!a.correct) runBeforeMiss.current.set(a.itemId, before);
        runs.current.set(a.itemId, nextRun(before, a.format, a.correct));
      }
      sendAttempt({
        sessionId: plan.id,
        itemId: a.itemId,
        format: a.format,
        correct: a.correct,
        nearMiss: a.nearMiss,
        articleError: a.articleError,
        usedHint: a.usedHint,
        firstTry: a.firstTry,
        responseMs: ms,
        given: a.given,
        xp: gained,
        genderOnly: a.genderOnly,
        practice: plan.practice || !!a.practice,
        level: a.level,
        easy: a.easy,
      });
      return gained;
    },
    [plan.id, calm, tr],
  );

  // How sure the learner was of each card's real answer this session (#205); saved with the answer.
  const confidences = useRef(new Map<number, Confidence>());
  const rateConfidence = useCallback(
    (itemId: number, value: Confidence) => {
      confidences.current.set(itemId, value);
      sendConfidence({ sessionId: plan.id, itemId, confidence: value });
    },
    [plan.id],
  );

  const override = useCallback((itemId: number, practice?: boolean) => {
    if (!plan.practice && !practice) sendOverride(itemId); // practice never touches today's real grade
    missed.current.delete(itemId);
    // The miss is taken back: the run goes on from where it was.
    if (runBeforeMiss.current.has(itemId))
      runs.current.set(itemId, nextRun(runBeforeMiss.current.get(itemId), 'typed', true));
    totals.current.correct++;
  }, []);
  // Sketches drawn or removed in this session (#220), on top of the ones the plan came with.
  const [sketchEdits, setSketchEdits] = useState<Record<number, Sketch | null>>({});
  const sketches = useMemo<NonNullable<Ctx['sketches']>>(
    () => ({
      of: (id) => (id in sketchEdits ? (sketchEdits[id] ?? undefined) : item(id)?.sketch),
      save: async (id, picture, text) => {
        const saved = await api.saveSketch(id, picture, text);
        setSketchEdits((e) => ({ ...e, [id]: saved }));
      },
      remove: async (id) => {
        await api.removeSketch(id);
        setSketchEdits((e) => ({ ...e, [id]: null }));
      },
    }),
    [sketchEdits, item],
  );
  const ctx: Ctx = {
    plan,
    lang: plan.lang,
    t,
    timer: settings.questionTimer ?? 0,
    paused,
    item,
    pool,
    answer,
    override,
    combo: calm ? 0 : combo, // calm: the coach doesn't cheer runs
    missed: missed.current,
    mnemonicRun,
    sketches,
    teacher,
    settings,
  };

  const blockDone = (r: BlockResult) => {
    const b = blocks[bi];
    if (r.total >= 3 && r.correct === r.total) {
      totals.current.perfectBlocks++;
      if (!calm) {
        const id = Math.random();
        setFloats((f) => [...f, { id, text: tr('session.xpFloatPerfect', { xp: BONUS.perfectBlock }) }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_MS);
      }
    }
    if (b.kind === 'gender' && r.bestCombo)
      totals.current.bestGender = Math.max(totals.current.bestGender, r.bestCombo);
    if (b.kind === 'boss') totals.current.bossWon = r.bossWon ?? null;
    if (!hostsRepeats(b)) relearn.current.skip(r.total); // a game still spaces out the cards waiting to come back

    let rest = blocks.slice(bi + 1);
    // Struggling (under 60%)? Insert a quick recognition rescue round on the missed words.
    if (b.kind === 'drill' && needsRescue(r)) {
      const ids = [...missed.current].slice(-5);
      if (ids.length >= 2 && pool.length >= 4)
        rest = [
          {
            id: `rescue-${bi}`,
            kind: 'drill',
            format: 'mc',
            title: 'rescue',
            teacher: coach.block('rescue'),
            exercises: ids.map((id) => mcFor(item(id), pool)),
          },
          ...rest,
        ];
    }
    // Attention dipped? Insert a 25-second action round.
    if (kickPending.current && b.kind !== 'gender' && rest[0]?.kind !== 'gender') {
      kickPending.current = false;
      const kick = coach.kick();
      const cats = new Set(pool.filter((p) => p.category).map((p) => p.category));
      const withCat = pool
        .filter((p) => p.category)
        .map((p) => p.id)
        .slice(0, 30);
      if (withCat.length >= 4 && cats.size >= 2) {
        rest = [
          { id: `kick-${bi}`, kind: 'gender', title: 'action-round', teacher: kick, itemIds: withCat, seconds: 25 },
          ...rest,
        ];
        setBubble(bubbleFor(kick, tr));
      } else if (pool.length >= 4) {
        rest = [
          {
            id: `kick-${bi}`,
            kind: 'blitz',
            title: 'action-round',
            teacher: kick,
            secondsPerQuestion: 6,
            exercises: pool.slice(0, 6).map((p) => mcFor(p, pool)),
          },
          ...rest,
        ];
        setBubble(bubbleFor(kick, tr));
      }
    }
    const nb = [...blocks.slice(0, bi + 1), ...rest];
    setBlocks(nb);
    setStep(null);
    setTouched(false);
    if (bi + 1 >= nb.length) return finish();
    const n = nb[bi + 1];
    teacher(n.teacher);
    setBi(bi + 1);
  };

  const finish = () => {
    onFinish({
      sessionId: plan.id,
      length: plan.length,
      seconds: Math.round((Date.now() - started.current.at) / 1000),
      answers: totals.current.answers,
      correct: totals.current.correct,
      xp,
      bossWon: totals.current.bossWon,
      bestGenderCombo: totals.current.bestGender,
      perfectBlocks: totals.current.perfectBlocks,
      startedAt: started.current.iso,
      missed: [...missed.current],
      practice: plan.practice,
      introduced: totals.current.introduced,
      newCards: [...newCards.current],
      rewards: rewards.current,
    });
  };

  const swap = () => {
    const other = swapBlock(blocks[bi], item, pool);
    if (!other) return;
    setBlocks(blocks.map((x, i) => (i === bi ? other : x)));
    setSwapped(true);
    setStep(null);
    teacher(tr('session.swapped')); // announced: the coach line is a live region
  };

  // Esc asks before leaving. Every answer is already saved; leaving early still counts the session.
  const keepButton = useRef<HTMLButtonElement>(null);
  const askLeave = () => {
    leaveDialog.current?.showModal();
    setPaused(true);
    keepButton.current?.focus(); // the safe choice is the default
  };
  const leave = () => {
    leaveDialog.current?.close();
    if (totals.current.answers > 0) finish();
    else onQuit();
  };
  const toggleSound = () => {
    setSoundOn(!sound);
    setSound(!sound);
    void api.saveSettings({ sound: !sound });
  };
  useKeys((e) => {
    if (e.key === 'Escape' && !leaveDialog.current?.open) {
      e.preventDefault();
      askLeave();
    }
  });
  // Each new block names itself to screen readers, unless an exercise already put focus in its answer field.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const blockId = blocks[bi]?.id;
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) titleRef.current?.focus();
  }, [blockId]);

  const b = blocks[bi];
  const swappable = useMemo(
    () => !!b && canSwap({ used: swapped, started: touched, block: b, item, pool }),
    [b, swapped, touched, item, pool],
  );
  if (!b) return null;
  const later = blocks.slice(bi + 1);
  const plannedLater = plannedRecalls(later.flatMap((x) => ('exercises' in x ? x.exercises : [])));
  const title = tr(`session.blocks.${blockKey(b.title)}`, { defaultValue: '' });
  return (
    <div className="session">
      <ProgressBar
        variant="session"
        label={tr('session.blockProgress')}
        value={step?.done ?? 0}
        max={step?.total ?? 1}
      />
      <header className="session-head">
        <button className="session-leave" onClick={askLeave}>
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          {tr('session.end')} <kbd>{tr('keys.esc')}</kbd>
        </button>
        <h1 ref={titleRef} tabIndex={-1} className="session-title">
          {title}
        </h1>
        <div className="session-meta">
          {step && <span>{tr('session.step', { n: Math.min(step.done + 1, step.total), total: step.total })}</span>}
          {swappable && (
            <Button variant="ghost" className="session-swap" title={tr('session.swapHint')} onClick={swap}>
              {tr('session.swap')}
            </Button>
          )}
          {!calm && combo >= 2 && <span className="session-combo">{tr('session.combo', { count: combo })}</span>}
          {!calm && (
            <span className="session-xp" title={tr('session.xpLabel')}>
              {tr('session.xp', { xp })}
              {floats.map((f) => (
                <span key={f.id} className="xpfloat" aria-hidden="true">
                  {f.text}
                </span>
              ))}
            </span>
          )}
          <button
            className="session-sound"
            aria-pressed={sound}
            aria-label={tr('session.sound')}
            title={tr('session.sound')}
            onClick={toggleSound}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9v6h4l5 4V5L8 9z" />
              {sound ? <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /> : <path d="M16 9l5 6M21 9l-5 6" />}
            </svg>
          </button>
        </div>
      </header>
      <p className="session-coach" aria-live="polite">
        {bubble.main}
        {bubble.gloss && bubble.gloss !== bubble.main && <span className="muted"> · {bubble.gloss}</span>}
      </p>
      {noVoice && (
        <p className="session-novoice" role="status">
          <span>{tr('session.noVoice', { language: formatLanguage(noVoice) })}</span>
          <Button variant="ghost" onClick={() => setNoVoice(false)}>
            {tr('session.noVoiceDismiss')}
          </Button>
        </p>
      )}
      <main className="stage" key={b.id}>
        {b.kind === 'gender' || b.kind === 'match' || b.kind === 'rain' || b.kind === 'boss' ? (
          <div className="panel ex-card round">
            {b.kind === 'gender' ? (
              <GenderSprint block={b} ctx={ctx} onDone={blockDone} />
            ) : b.kind === 'match' ? (
              <MatchPairs block={b} ctx={ctx} onDone={blockDone} />
            ) : b.kind === 'rain' ? (
              <WordRain block={b} ctx={ctx} onDone={blockDone} />
            ) : (
              <Boss block={b} ctx={ctx} onDone={blockDone} />
            )}
          </div>
        ) : b.kind === 'guess' ? (
          <div className="panel ex-card">
            <GuessBlock block={b} ctx={ctx} onDone={blockDone} onStep={setStep} />
          </div>
        ) : b.kind === 'blitz' ? (
          <div className="panel ex-card" aria-live="polite">
            <BlitzBlock block={b} ctx={ctx} onDone={blockDone} onStep={setStep} />
          </div>
        ) : (
          <div className="panel ex-card" aria-live="polite">
            <ExerciseBlock
              block={b}
              ctx={ctx}
              relearn={relearn.current}
              plannedLater={plannedLater}
              last={!later.some(hostsRepeats)}
              confidence={
                asksConfidence({ on: settings.confidence, practice: plan.practice, kind: b.kind })
                  ? rateConfidence
                  : undefined
              }
              onDone={blockDone}
              onStep={setStep}
            />
          </div>
        )}
      </main>
      <dialog
        ref={leaveDialog}
        className="panel session-dialog"
        aria-labelledby="leave-title"
        onClose={() => setPaused(false)}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 id="leave-title">{tr('session.leaveTitle')}</h2>
        <p className="muted">{tr('session.leaveBody')}</p>
        <div className="session-dialog-actions">
          <Button onClick={leave}>{tr('session.leave')}</Button>
          <Button ref={keepButton} variant="primary" onClick={() => leaveDialog.current?.close()}>
            {tr('session.keepGoing')}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
