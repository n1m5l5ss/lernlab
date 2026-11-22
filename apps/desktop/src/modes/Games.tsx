import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block, Item } from '@lernlab/core/types';
import { shuffle, splitArticle, normalize, stripHtml } from '@lernlab/core/text';
import { qa } from '@lernlab/core/cards';
import { say, sfx } from '../audio';
import { useKeys, type Ctx, type BlockResult } from '../ctx';
import { Cloze, Flip, Myth, Order, TypedEngine } from './Exercises';
import { Explain } from './Explain';
import { Twin } from './Twin';
import { Worked } from './Worked';
import { CodeBlock } from '../code-block';
import { Media, Rich } from '../rich';
import { recallFor } from '../plan';
import { Feedback } from '../components';

type G<K extends Block['kind']> = { block: Extract<Block, { kind: K }>; ctx: Ctx; onDone: (r: BlockResult) => void };
const now = () => performance.now();

/** A thin bar and a text count for a round's clock (nothing when the round is untimed). */
function RoundClock({ left, total }: { left: number; total: number }) {
  const { t } = useTranslation();
  if (!total) return null;
  return (
    <div className="round-clock">
      <div className="round-clock-bar" aria-hidden="true">
        <i style={{ width: `${(left / total) * 100}%` }} />
      </div>
      <span className="pill">{t('games.secondsLeft', { count: left })}</span>
    </div>
  );
}

/** Seconds left on a round's clock. 0 seconds means no clock; the clock stops while `paused`. */
function useCountdown(seconds: number, onEnd: () => void, paused: boolean) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;
  const hold = useRef(paused);
  hold.current = paused;
  useEffect(() => {
    if (!seconds) return;
    const t = setInterval(
      () =>
        !hold.current &&
        setLeft((l) => {
          if (l <= 1) {
            clearInterval(t);
            setTimeout(() => end.current(), 0);
            return 0;
          }
          if (l <= 6) sfx.tick();
          return l - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, []);
  return left;
}

/* ───────────── Category sprint: der/die/das, or any card categories ───────────── */
export function GenderSprint({ block, ctx, onDone }: G<'gender'>) {
  const { t } = useTranslation();
  const items = useMemo(() => shuffle(block.itemIds.map(ctx.item).filter((i) => i.category)), []);
  const cats = useMemo(() => {
    const set = [...new Set(items.map((i) => i.category!))];
    const order = ['der', 'die', 'das'];
    return set.every((c) => order.includes(c)) ? order.filter((c) => set.includes(c)) : set.slice(0, 4);
  }, []);
  const isArticles = cats.every((c) => ['der', 'die', 'das'].includes(c));
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; cat: string } | null>(null);
  const stats = useRef({ correct: 0, total: 0, combo: 0, best: 0 });
  const shown = useRef(now());
  const done = useRef(false);
  const pbKey = `pb-sprint-${ctx.plan.deckId}`;
  const best = Number(localStorage.getItem(pbKey) ?? 0);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    if (stats.current.correct > best) localStorage.setItem(pbKey, String(stats.current.correct));
    onDone({ correct: stats.current.correct, total: stats.current.total, bestCombo: stats.current.best });
  };
  const left = useCountdown(block.seconds, finish, ctx.paused);
  const item = items[idx % items.length];
  const pick = (c: string) => {
    if (flash || done.current) return;
    const ok = c === item.category;
    const st = stats.current;
    st.total++;
    if (ok) {
      st.correct++;
      st.combo++;
      st.best = Math.max(st.best, st.combo);
    } else st.combo = 0;
    ctx.answer({ itemId: item.id, format: 'gender', genderOnly: true, correct: ok, shownAt: shown.current });
    setFlash({ ok, cat: item.category! });
    setTimeout(
      () => {
        // Without a clock the sprint is one pass through the cards.
        if (!block.seconds && st.total >= items.length) return finish();
        setFlash(null);
        setIdx((i) => i + 1);
        shown.current = now();
      },
      ok ? 220 : 900,
    );
  };
  useKeys((e) => {
    const keys: Record<string, number> = {
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      ArrowLeft: 0,
      ArrowDown: 1,
      ArrowRight: 2,
      j: 0,
      k: 1,
      l: 2,
    };
    if (e.key in keys && cats[keys[e.key]]) {
      e.preventDefault();
      pick(cats[keys[e.key]]);
    }
  });
  // Never show the article being asked for, even when a card's word field still carries it.
  const label = isArticles ? splitArticle(stripHtml(item.word)).word : stripHtml(item.target);
  return (
    <div>
      <div className="round-head">
        <div className="blocktitle grow">{isArticles ? t('games.sprintArticles') : t('games.sprint')}</div>
        <span className="pill">{t('games.hits', { count: stats.current.correct })}</span>
        {best > 0 && <span className="pill">{t('games.best', { count: best })}</span>}
      </div>
      <RoundClock left={left} total={block.seconds} />
      <div className="round-prompt">
        <div className="prompt" lang={ctx.lang ?? undefined} aria-live="polite">
          {label}
        </div>
        {isArticles && <div className="muted">{item.meaning}</div>}
        {flash && (
          <Feedback tone={flash.ok ? 'right' : 'wrong'}>
            {flash.ok ? t('games.sorted', { category: flash.cat }) : t('games.itWas', { category: flash.cat })}
          </Feedback>
        )}
      </div>
      <div className="sprint-options" style={{ gridTemplateColumns: `repeat(${cats.length}, 1fr)` }}>
        {cats.map((c, i) => (
          <button
            key={c}
            className={`opt ${flash && c === flash.cat ? 'right' : ''}`}
            aria-disabled={!!flash || undefined /* not disabled: that would drop keyboard focus */}
            onClick={() => pick(c)}
          >
            <span className="k">{i + 1}</span> {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Match pairs on the clock ───────────── */
export function MatchPairs({ block, ctx, onDone }: G<'match'>) {
  const { t } = useTranslation();
  const items = useMemo(() => block.itemIds.map(ctx.item), []);
  const left = useMemo(() => shuffle(items), []);
  const right = useMemo(() => shuffle(items), []);
  const [sel, setSel] = useState<number | null>(null);
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<string | null>(null);
  const missedOnce = useRef(new Set<number>());
  const board = useRef<HTMLDivElement>(null);
  const start = useRef(now());
  const [elapsed, setElapsed] = useState(0);
  const timed = (ctx.settings.blitzSeconds ?? 8) > 0; // the stopwatch is hidden when timers are off
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((now() - start.current) / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  const pickRight = (it: Item) => {
    if (sel === null) return;
    if (it.id === sel) {
      ctx.answer({ itemId: it.id, format: 'match', correct: !missedOnce.current.has(it.id), shownAt: start.current });
      if (ctx.lang) say(it.target, 0.95, ctx.lang, it.deckId);
      const g = new Set(gone).add(it.id);
      setGone(g);
      setSel(null);
      // The matched pair disappears; keyboard focus moves on to the next word instead of getting lost.
      requestAnimationFrame(() => board.current?.querySelector<HTMLButtonElement>('.col .opt:not(:disabled)')?.focus());
      if (g.size === items.length) {
        const correct = items.length - missedOnce.current.size;
        setTimeout(() => onDone({ correct, total: items.length }), 500);
      }
    } else {
      sfx.wrong();
      missedOnce.current.add(sel);
      setBad(`r${it.id}`);
      setTimeout(() => setBad(null), 300);
    }
  };

  return (
    <div>
      <div className="round-head">
        <div className="blocktitle grow">{t('games.match')}</div>
        <span className="pill">{t('games.pairsLeft', { count: items.length - gone.size })}</span>
        {timed && <span className="pill">{t('games.elapsed', { count: elapsed })}</span>}
      </div>
      <div className="match" ref={board}>
        <div className="col">
          {left.map((it) => (
            <button
              key={it.id}
              className={`opt ${gone.has(it.id) ? 'gone' : ''}`}
              aria-pressed={sel === it.id}
              disabled={gone.has(it.id)}
              onClick={() => {
                sfx.tap();
                setSel(it.id);
              }}
            >
              {stripHtml(it.target)}
            </button>
          ))}
        </div>
        <div className="col">
          {right.map((it) => (
            <button
              key={it.id}
              className={`opt ${gone.has(it.id) ? 'gone' : ''} ${bad === `r${it.id}` ? 'wrong' : ''}`}
              disabled={gone.has(it.id)}
              onClick={() => pickRight(it)}
            >
              {stripHtml(it.meaning)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Word rain: type the German before the English word lands ───────────── */
type Drop = { key: number; item: Item; x: number; y: number; speed: number; hit?: boolean };
export function WordRain({ block, ctx, onDone }: G<'rain'>) {
  const { t } = useTranslation();
  const items = useMemo(() => shuffle(block.itemIds.map(ctx.item)), []);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [value, setValue] = useState('');
  const [score, setScore] = useState({ hit: 0, miss: 0 });
  const next = useRef(0);
  const keyN = useRef(0);
  const done = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const finish = () => {
    if (!done.current) {
      done.current = true;
      onDone({ correct: score.hit, total: score.hit + score.miss });
    }
  };
  const left = useCountdown(block.seconds, finish, ctx.paused);
  const elapsed = block.seconds - left;
  // Drops fall at a pace that matches the timer setting (a 90 s relaxed round falls slower than a 45 s one).
  const pace = 60 / block.seconds;
  const hold = useRef(ctx.paused);
  hold.current = ctx.paused;

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    let raf = 0;
    let last = now();
    let spawnIn = 0;
    const loop = () => {
      const t = now();
      const dt = hold.current ? 0 : (t - last) / 1000;
      last = t;
      spawnIn -= dt;
      setDrops((ds) => {
        let out = ds.map((d) => (d.hit ? d : { ...d, y: d.y + d.speed * dt }));
        const landed = out.filter((d) => !d.hit && d.y > 350);
        if (landed.length) {
          sfx.wrong();
          landed.forEach((d) =>
            ctx.answer({ itemId: d.item.id, format: 'rain', correct: false, shownAt: t, silent: true }),
          );
          setScore((s) => ({ ...s, miss: s.miss + landed.length }));
          out = out.filter((d) => !landed.includes(d));
        }
        if (spawnIn <= 0 && out.filter((d) => !d.hit).length < 4 && !done.current) {
          const item = items[next.current++ % items.length];
          out = [
            ...out,
            {
              key: keyN.current++,
              item,
              x: 15 + Math.random() * 70,
              y: 0,
              speed: (26 + Math.min(40, next.current * 2.2)) * pace,
            },
          ];
          spawnIn = Math.max(1.1, 2.6 - next.current * 0.08) / pace;
        }
        return out;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tryType = (v: string) => {
    setValue(v);
    const target = drops.find(
      (d) =>
        !d.hit &&
        qa(d.item).accepted.some((a) => {
          const bare = splitArticle(a).word;
          return normalize(v) === normalize(a) || normalize(v) === normalize(bare);
        }),
    );
    if (target) {
      ctx.answer({ itemId: target.item.id, format: 'rain', correct: true, shownAt: now() - 3000 });
      setScore((s) => ({ ...s, hit: s.hit + 1 }));
      setDrops((ds) => ds.map((d) => (d.key === target.key ? { ...d, hit: true } : d)));
      setTimeout(() => setDrops((ds) => ds.filter((d) => d.key !== target.key)), 350);
      setValue('');
    }
  };

  const latest = drops.find((d) => d.key === keyN.current - 1 && !d.hit);
  return (
    <div>
      <div className="round-head">
        <div className="blocktitle grow">{t('games.rain')}</div>
        <span className="pill">{t('games.rainHit', { count: score.hit })}</span>
        <span className="pill">{t('games.rainMiss', { count: score.miss })}</span>
      </div>
      <RoundClock left={left} total={block.seconds} />
      {/* The rain is drawn for the eyes; screen readers hear each new word as it starts to fall. */}
      <p className="sr-only" aria-live="polite">
        {latest ? stripHtml(qa(latest.item).prompt) : ''}
      </p>
      <div className="rain" aria-hidden="true">
        {drops.map((d) => (
          <div
            key={d.key}
            className={`drop ${d.hit ? 'hit' : ''}`}
            lang={d.hit ? (ctx.lang ?? undefined) : undefined}
            style={{ left: `${d.x}%` /* rtl-ignore: a random spot, centred */, top: d.y }}
          >
            {d.hit ? qa(d.item).answer : stripHtml(qa(d.item).prompt)}
          </div>
        ))}
        <div className="ground" />
      </div>
      <input
        ref={input}
        className="typed rain-input"
        aria-label={t('games.rainPlaceholder')}
        value={value}
        onChange={(e) => tryType(e.target.value)}
        placeholder={t('games.rainPlaceholder')}
        spellCheck={false}
        autoComplete="off"
      />
      <div className="small muted round-note">
        {ctx.lang === 'de' ? `${t('games.articleOptional')} ` : ''}
        {t('games.rainSpeed', { seconds: elapsed })}
      </div>
    </div>
  );
}

/* ───────────── Boss battle: today's mistakes and your hardest words; three lives ───────────── */
export function Boss({ block, ctx, onDone }: G<'boss'>) {
  const { t } = useTranslation();
  const ids = useMemo(
    () => [...new Set([...ctx.missed, ...block.itemIds])].filter((id) => ctx.item(id)?.kind !== 'grammar').slice(0, 8),
    [],
  );
  const [i, setI] = useState(0);
  const [hp, setHp] = useState(ids.length);
  const [lives, setLives] = useState(block.lives);
  const [hit, setHit] = useState(false);
  const [over, setOver] = useState<null | boolean>(null);
  const correct = useRef(0);
  // One exercise per round, kept across renders (an order-the-lines round must not reshuffle).
  const rounds = useRef(new Map<number, ReturnType<typeof recallFor>>());

  useEffect(() => {
    if (!ids.length) onDone({ correct: 0, total: 0, bossWon: null });
  }, []);
  useKeys((e) => {
    if (over !== null && e.key === 'Enter') onDone({ correct: correct.current, total: i, bossWon: over });
  });
  if (!ids.length) return null;

  const after = (r: { correct: boolean }) => {
    const h = r.correct ? hp - 1 : hp;
    const l = r.correct ? lives : lives - 1;
    if (r.correct) {
      correct.current++;
      sfx.hit();
      setHit(true);
      setTimeout(() => setHit(false), 300);
    }
    setHp(h);
    setLives(l);
    if (h <= 0) {
      setOver(true);
      sfx.win();
      ctx.teacher(ctx.t.bossWin());
      return;
    }
    if (l <= 0) {
      setOver(false);
      ctx.teacher(ctx.t.bossLose());
      return;
    }
    setI((x) => x + 1);
  };

  const item = ctx.item(ids[i % ids.length]);
  if (!rounds.current.has(i)) rounds.current.set(i, recallFor(item));
  const ex = rounds.current.get(i)!;
  return (
    <div>
      <div className="round-head">
        <div className="blocktitle grow">{t('games.boss')}</div>
        <span className="pill">{t('games.lives', { count: Math.max(0, lives), total: block.lives })}</span>
      </div>
      <div
        className={`boss-bar ${hit ? 'hit' : ''}`}
        role="meter"
        aria-label={t('games.bossLeft')}
        aria-valuemin={0}
        aria-valuemax={ids.length}
        aria-valuenow={hp}
      >
        <i style={{ width: `${(hp / ids.length) * 100}%` }} />
      </div>
      {over === null ? (
        ex.type === 'typed' ? (
          <TypedEngine
            key={i}
            ctx={ctx}
            itemId={item.id}
            format="boss"
            accepted={ex.accepted}
            requireArticle={ex.requireArticle}
            hint={ex.hint}
            onNext={after}
            render={(input) => (
              <>
                <Media item={item} size="sm" />
                <div className="prompt">
                  <Rich html={ex.prompt} />
                </div>
                {ex.code !== undefined && <CodeBlock code={ex.code} lang={ex.codeLang ?? ''} />}
                {input}
              </>
            )}
          />
        ) : ex.type === 'flip' ? (
          <Flip key={i} ex={ex} ctx={ctx} onNext={after} format="boss" />
        ) : ex.type === 'myth' ? (
          <Myth key={i} ex={ex} ctx={ctx} onNext={after} format="boss" />
        ) : ex.type === 'explain' ? (
          <Explain key={i} ex={ex} ctx={ctx} onNext={after} format="boss" />
        ) : ex.type === 'twin' ? (
          <Twin key={i} ex={ex} ctx={ctx} onNext={after} format="boss" />
        ) : ex.type === 'worked' ? (
          <Worked key={i} ex={ex} ctx={ctx} onNext={after} />
        ) : ex.type === 'cloze' ? (
          <Cloze key={i} ex={ex} ctx={ctx} onNext={after} />
        ) : ex.type === 'order' ? (
          <Order key={i} ex={ex} ctx={ctx} onNext={after} />
        ) : null
      ) : (
        <div className="round-end">
          <h2>{over ? t('games.won') : t('games.lost')}</h2>
          <p className="muted">{over ? t('games.wonText', { xp: 30, count: correct.current }) : t('games.lostText')}</p>
          <button
            className="btn primary"
            onClick={() => onDone({ correct: correct.current, total: i + 1, bossWon: over })}
          >
            {t('common.continue')} <span className="kbd">{t('keys.enter')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
