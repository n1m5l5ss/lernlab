import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block, Item } from '../../shared/types';
import { acceptedAnswers, checkAnswer, shuffle, splitArticle, normalize } from '../../shared/text';
import { T } from '../../shared/teacher';
import { say, sfx } from '../audio';
import { useKeys, type Ctx, type BlockResult } from '../ctx';
import { TypedEngine } from './Exercises';
import { typedFor } from '../plan';

type G<K extends Block['kind']> = { block: Extract<Block, { kind: K }>; ctx: Ctx; onDone: (r: BlockResult) => void };
const now = () => performance.now();

function useCountdown(seconds: number, onEnd: () => void) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) { clearInterval(t); setTimeout(() => end.current(), 0); return 0; }
      if (l <= 6) sfx.tick();
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

/* ───────────── Der/die/das sprint ───────────── */
export function GenderSprint({ block, ctx, onDone }: G<'gender'>) {
  const items = useMemo(() => shuffle(block.itemIds.map(ctx.item).filter((i) => i.article)), []);
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; art: string } | null>(null);
  const stats = useRef({ correct: 0, total: 0, combo: 0, best: 0 });
  const shown = useRef(now());
  const done = useRef(false);
  const best = Number(localStorage.getItem('pb-gender') ?? 0);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    if (stats.current.correct > best) localStorage.setItem('pb-gender', String(stats.current.correct));
    onDone({ correct: stats.current.correct, total: stats.current.total, bestCombo: stats.current.best });
  };
  const left = useCountdown(block.seconds, finish);
  const item = items[idx % items.length];

  const pick = (a: string) => {
    if (flash || done.current) return;
    const ok = a === item.article;
    const s = stats.current;
    s.total++;
    if (ok) { s.correct++; s.combo++; s.best = Math.max(s.best, s.combo); } else s.combo = 0;
    ctx.answer({ itemId: item.id, format: 'gender', genderOnly: true, correct: ok, shownAt: shown.current });
    setFlash({ ok, art: item.article! });
    setTimeout(() => { setFlash(null); setIdx((i) => i + 1); shown.current = now(); }, ok ? 220 : 900);
  };
  useKeys((e) => {
    const map: Record<string, string> = { '1': 'der', '2': 'die', '3': 'das', ArrowLeft: 'der', ArrowDown: 'die', ArrowRight: 'das', j: 'der', k: 'die', l: 'das' };
    if (map[e.key]) { e.preventDefault(); pick(map[e.key]); }
  });

  return (
    <div>
      <div className="timer"><i style={{ width: `${(left / block.seconds) * 100}%` }} /></div>
      <div className="row"><div className="blocktitle grow">Artikel-Sprint · {left}s</div><span className="pill">✓ {stats.current.correct}</span><span className="pill">Rekord {best}</span></div>
      <div className="center" style={{ margin: '28px 0' }}>
        <div className="prompt de" style={{ fontSize: 56, marginBottom: 4 }}>
          {flash ? <span className={`art-${flash.art}`}>{flash.art} </span> : null}{item.word}
        </div>
        <div className="muted">{item.meaning}</div>
      </div>
      <div className="gender3">
        {(['der', 'die', 'das'] as const).map((a, i) => (
          <button key={a} className={`gbtn ${a} ${flash && a !== flash.art ? 'dim' : ''}`} onClick={() => pick(a)}>{a} <span className="kbd">{['←', '↓', '→'][i]}</span></button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Match pairs on the clock ───────────── */
export function MatchPairs({ block, ctx, onDone }: G<'match'>) {
  const items = useMemo(() => block.itemIds.map(ctx.item), []);
  const left = useMemo(() => shuffle(items), []);
  const right = useMemo(() => shuffle(items), []);
  const [sel, setSel] = useState<number | null>(null);
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<string | null>(null);
  const missedOnce = useRef(new Set<number>());
  const start = useRef(now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const t = setInterval(() => setElapsed(Math.floor((now() - start.current) / 1000)), 250); return () => clearInterval(t); }, []);

  const pickRight = (it: Item) => {
    if (sel === null) return;
    if (it.id === sel) {
      ctx.answer({ itemId: it.id, format: 'match', correct: !missedOnce.current.has(it.id), shownAt: start.current });
      say(it.target);
      const g = new Set(gone).add(it.id);
      setGone(g);
      setSel(null);
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
      <div className="row"><div className="blocktitle grow">Paare finden</div><span className="pill">⏱ {elapsed}s</span></div>
      <div className="match" style={{ marginTop: 10 }}>
        <div className="col">
          {left.map((it) => (
            <button key={it.id} className={`${gone.has(it.id) ? 'gone' : ''} ${sel === it.id ? 'sel' : ''}`} onClick={() => { sfx.tap(); setSel(it.id); }}>{it.target}</button>
          ))}
        </div>
        <div className="col">
          {right.map((it) => (
            <button key={it.id} className={`${gone.has(it.id) ? 'gone' : ''} ${bad === `r${it.id}` ? 'bad' : ''}`} onClick={() => pickRight(it)}>{it.meaning}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Word rain: type the German before the English word lands ───────────── */
type Drop = { key: number; item: Item; x: number; y: number; speed: number; hit?: boolean };
export function WordRain({ block, ctx, onDone }: G<'rain'>) {
  const items = useMemo(() => shuffle(block.itemIds.map(ctx.item)), []);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [value, setValue] = useState('');
  const [score, setScore] = useState({ hit: 0, miss: 0 });
  const next = useRef(0);
  const keyN = useRef(0);
  const done = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const finish = () => { if (!done.current) { done.current = true; onDone({ correct: score.hit, total: score.hit + score.miss }); } };
  const left = useCountdown(block.seconds, finish);
  const elapsed = block.seconds - left;

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    let raf = 0;
    let last = now();
    let spawnIn = 0;
    const loop = () => {
      const t = now();
      const dt = (t - last) / 1000;
      last = t;
      spawnIn -= dt;
      setDrops((ds) => {
        let out = ds.map((d) => (d.hit ? d : { ...d, y: d.y + d.speed * dt }));
        const landed = out.filter((d) => !d.hit && d.y > 350);
        if (landed.length) {
          sfx.wrong();
          landed.forEach((d) => ctx.answer({ itemId: d.item.id, format: 'rain', correct: false, shownAt: t, silent: true }));
          setScore((s) => ({ ...s, miss: s.miss + landed.length }));
          out = out.filter((d) => !landed.includes(d));
        }
        if (spawnIn <= 0 && out.filter((d) => !d.hit).length < 4 && !done.current) {
          const item = items[next.current++ % items.length];
          out = [...out, { key: keyN.current++, item, x: 15 + Math.random() * 70, y: 0, speed: 26 + Math.min(40, next.current * 2.2) }];
          spawnIn = Math.max(1.1, 2.6 - next.current * 0.08);
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
    const target = drops.find((d) => !d.hit && acceptedAnswers(d.item.target).some((a) => {
      const bare = splitArticle(a).word;
      return normalize(v) === normalize(a) || normalize(v) === normalize(bare);
    }));
    if (target) {
      ctx.answer({ itemId: target.item.id, format: 'rain', correct: true, shownAt: now() - 3000 });
      setScore((s) => ({ ...s, hit: s.hit + 1 }));
      setDrops((ds) => ds.map((d) => (d.key === target.key ? { ...d, hit: true } : d)));
      setTimeout(() => setDrops((ds) => ds.filter((d) => d.key !== target.key)), 350);
      setValue('');
    }
  };

  return (
    <div>
      <div className="timer"><i style={{ width: `${(left / block.seconds) * 100}%` }} /></div>
      <div className="row"><div className="blocktitle grow">Wortregen · {left}s</div><span className="pill">💥 {score.hit}</span><span className="pill">💧 {score.miss}</span></div>
      <div className="rain" style={{ marginTop: 8 }}>
        {drops.map((d) => (
          <div key={d.key} className={`drop ${d.hit ? 'hit' : ''}`} style={{ left: `${d.x}%`, top: d.y }}>{d.hit ? d.item.target : d.item.meaning}</div>
        ))}
        <div className="ground" />
      </div>
      <input ref={input} className="typed" style={{ marginTop: 12 }} value={value} onChange={(e) => tryType(e.target.value)} placeholder="Tippe das deutsche Wort…" spellCheck={false} autoComplete="off" />
      <div className="small muted" style={{ marginTop: 6 }}>Article optional here. Speed rises as you go ({elapsed}s in).</div>
    </div>
  );
}

/* ───────────── Boss battle: today's mistakes and your hardest words; three lives ───────────── */
export function Boss({ block, ctx, onDone }: G<'boss'>) {
  const ids = useMemo(() => [...new Set([...ctx.missed, ...block.itemIds])].filter((id) => ctx.item(id)?.kind !== 'grammar').slice(0, 8), []);
  const [i, setI] = useState(0);
  const [hp, setHp] = useState(ids.length);
  const [lives, setLives] = useState(block.lives);
  const [hit, setHit] = useState(false);
  const [over, setOver] = useState<null | boolean>(null);
  const correct = useRef(0);

  useEffect(() => { if (!ids.length) onDone({ correct: 0, total: 0, bossWon: null }); }, []);
  useKeys((e) => { if (over !== null && e.key === 'Enter') onDone({ correct: correct.current, total: i, bossWon: over }); });
  if (!ids.length) return null;

  const after = (r: { correct: boolean }) => {
    const h = r.correct ? hp - 1 : hp;
    const l = r.correct ? lives : lives - 1;
    if (r.correct) { correct.current++; sfx.hit(); setHit(true); setTimeout(() => setHit(false), 300); }
    setHp(h); setLives(l);
    if (h <= 0) { setOver(true); sfx.win(); ctx.teacher(T.bossWin()); return; }
    if (l <= 0) { setOver(false); ctx.teacher(T.bossLose()); return; }
    setI((x) => x + 1);
  };

  const item = ctx.item(ids[i % ids.length]);
  const ex = typedFor(item);
  return (
    <div>
      <div className="boss">
        <div className={`bossface ${hit ? 'hit' : ''}`}>{over === true ? '💀' : '👾'}</div>
        <div className="hp">
          <div className="row"><b className="grow">Endgegner</b><span className="lives">{'❤️'.repeat(Math.max(0, lives))}{'🖤'.repeat(Math.max(0, block.lives - lives))}</span></div>
          <div className="bar"><i style={{ width: `${(hp / ids.length) * 100}%` }} /></div>
        </div>
      </div>
      {over === null ? (
        <TypedEngine key={i} ctx={ctx} itemId={item.id} format="boss" accepted={ex.accepted} requireArticle={ex.requireArticle} hint={ex.hint}
          onNext={after}
          render={(input) => (<><div className="prompt">{ex.prompt}</div>{input}</>)} />
      ) : (
        <div className="card center">
          <div className="big" style={{ fontSize: 40, fontWeight: 900 }}>{over ? 'Besiegt! 🏆' : 'Noch nicht…'}</div>
          <p className="muted">{over ? `+30 XP bonus. ${correct.current} hits.` : 'These words come back tomorrow. No penalty.'}</p>
          <button className="btn primary" onClick={() => onDone({ correct: correct.current, total: i + 1, bossWon: over })}>Weiter <span className="kbd">Enter</span></button>
        </div>
      )}
    </div>
  );
}
