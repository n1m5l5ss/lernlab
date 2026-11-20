import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { T } from '../shared/teacher';
import { sfx } from './audio';
import { useKeys } from './ctx';
import type { SessionResult } from './Session';

const HOMEWORK = [
  ['Schau eine Folge „Nicos Weg“ (A1).', 'Watch one episode of Nicos Weg (A1) on DW.'],
  ['Schau ein „Easy German“-Video mit Untertiteln.', 'Watch one Easy German video with subtitles.'],
  ['3 Minuten Shadowing: sprich einen Satz 5× nach.', '3 minutes of shadowing: repeat one sentence 5 times.'],
  ['Sag 5 Sätze über deinen Tag – laut!', 'Say 5 sentences about your day – out loud!'],
];

export function Summary({ result, server, onAgain, onHome }: { result: SessionResult; server: any; onAgain: () => void; onHome: () => void }) {
  const acc = result.answers ? Math.round((result.correct / result.answers) * 100) : 0;
  const [done, doneEn] = T.done();
  const hw = HOMEWORK[new Date().getDate() % HOMEWORK.length];
  useEffect(() => {
    sfx.win();
    if (server?.goalMetNow || server?.unlocked?.length) confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
  }, []);
  useKeys((e) => { if (e.key === 'Enter') onHome(); if (e.key === ' ') { e.preventDefault(); onAgain(); } });
  return (
    <div className="wrap summary col" style={{ gap: 16 }}>
      <div className="teacher" style={{ justifyContent: 'center' }}>
        <div className="avatar">L</div>
        <div className="bubble" style={{ textAlign: 'left' }}><div>{done}</div><div className="en">{doneEn}</div></div>
      </div>
      <div className="big">+{result.xp + (server?.bonus ?? 0)} XP</div>
      <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat"><b>{acc}%</b><span>accuracy</span></div>
        <div className="stat"><b>{result.answers}</b><span>answers</span></div>
        <div className="stat"><b>{Math.max(1, Math.round(result.seconds / 60))}</b><span>minutes</span></div>
        <div className="stat"><b className="flame">🔥{server?.streak?.current ?? '–'}</b><span>day streak</span></div>
      </div>
      {server?.goalMetNow && <div className="card" style={{ borderColor: 'var(--good)' }}>✅ Daily goal reached (+25 XP)</div>}
      {server?.unlocked?.map((u: any) => <div key={u.key} className="card" style={{ borderColor: 'var(--accent)' }}>🏅 New badge: <b>{u.title}</b> – {u.desc}</div>)}
      {result.bossWon === true && <div className="card">👾 Boss defeated (+30 XP)</div>}
      <div className="card" style={{ textAlign: 'left' }}>
        <b>Hausaufgabe</b>
        <div style={{ marginTop: 6 }}>{hw[0]}</div><div className="small muted">{hw[1]}</div>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" onClick={onAgain}>Noch eine Mini-Runde <span className="kbd">Space</span></button>
        <button className="btn" onClick={onHome}>Fertig <span className="kbd">Enter</span></button>
      </div>
    </div>
  );
}
