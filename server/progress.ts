// Progress: streaks, daily goal, achievements, stats, and the daily summary for the AI tutor / Notion.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_DIR, getDb, getMeta, setMeta, type DB } from './db';
import { addDays, BONUS, dayKey, levelFor, NEW_STREAK, recordSession, settleStreak, type StreakState } from '../shared/game';
import { dueItemIds, getSettings, introducedTodayCount, newItemIds } from './learn';

export const ACHIEVEMENTS: Record<string, { title: string; desc: string }> = {
  first: { title: 'Erste Schritte', desc: 'Finish your first session' },
  streak3: { title: 'Drei am Stück', desc: '3-day streak' },
  streak7: { title: 'Eine Woche!', desc: '7-day streak' },
  streak30: { title: 'Gewohnheit', desc: '30-day streak' },
  words50: { title: '50 Wörter', desc: 'Produce 50 words from memory' },
  words100: { title: '100 Wörter', desc: 'Produce 100 words from memory' },
  words250: { title: '250 Wörter', desc: 'Produce 250 words from memory' },
  words500: { title: '500 Wörter', desc: 'Produce 500 words from memory' },
  boss: { title: 'Bossbezwinger', desc: 'Win a boss battle' },
  gender15: { title: 'Artikel-Profi', desc: '15 articles right in a row' },
  perfect: { title: 'Fehlerlos', desc: 'A session of 20+ answers with no mistakes' },
  speaker: { title: 'Sprechmaschine', desc: 'Say 25 answers correctly out loud' },
  early: { title: 'Frühaufsteher', desc: 'Study before 9 a.m.' },
};

function metDays(d: DB): Set<string> {
  return new Set(d.prepare('SELECT day FROM days WHERE goal_met = 1').all().map((r: any) => r.day));
}

export function streakState(d: DB = getDb(), now = new Date()): StreakState {
  const today = dayKey(now);
  const s = settleStreak(getMeta(d, 'streak', NEW_STREAK), today, metDays(d));
  setMeta(d, 'streak', s);
  return s;
}

export function wordsProducible(d: DB = getDb()): number {
  return Number(d.prepare(`SELECT COUNT(*) AS n FROM item_state st JOIN items i ON i.id = st.item_id WHERE st.mastery >= 3 AND i.kind != 'grammar'`).get().n);
}

export function appState(d: DB = getDb(), now = new Date()) {
  const settings = getSettings(d);
  const today = dayKey(now);
  const streak = streakState(d, now);
  const totalXp = Number(d.prepare('SELECT COALESCE(SUM(xp), 0) AS n FROM days').get().n);
  const t = d.prepare('SELECT * FROM days WHERE day = ?').get(today) ?? { xp: 0, sessions: 0, seconds: 0, goal_met: 0 };
  const month = today.slice(0, 7);
  const studyDaysMonth = Number(d.prepare(`SELECT COUNT(*) AS n FROM days WHERE day LIKE ? AND sessions > 0`).get(`${month}%`).n);
  const itemCount = Number(d.prepare('SELECT COUNT(*) AS n FROM items').get().n);
  const introduced = Number(d.prepare('SELECT COUNT(*) AS n FROM srs').get().n);
  const goetheTotal = Number(d.prepare(`SELECT COUNT(*) AS n FROM items WHERE tags LIKE '%exam_goethe_b1%'`).get().n);
  const goetheKnown = Number(
    d.prepare(`SELECT COUNT(*) AS n FROM items i JOIN item_state st ON st.item_id = i.id WHERE i.tags LIKE '%exam_goethe_b1%' AND st.mastery >= 3`).get().n,
  );
  const lastDay = d.prepare('SELECT MAX(day) AS d FROM days WHERE sessions > 0 AND day < ?').get(today).d as string | null;
  return {
    imported: itemCount > 0,
    itemCount,
    introduced,
    due: dueItemIds(d, now).length,
    newLeftToday: Math.min(Math.max(0, settings.newPerDay - introducedTodayCount(d, now)), newItemIds(d, 1000).length),
    totalXp,
    level: levelFor(totalXp),
    streak,
    today: { xp: Number(t.xp), sessions: Number(t.sessions), minutes: Math.round(Number(t.seconds) / 60), goalMet: !!t.goal_met },
    studyDaysMonth,
    wordsProducible: wordsProducible(d),
    goethe: { known: goetheKnown, total: goetheTotal },
    achievements: getMeta<Record<string, string>>(d, 'achievements', {}),
    missedYesterday: !!lastDay && lastDay < addDays(today, -1) && Number(t.sessions) === 0,
    settings,
    lastImport: getMeta(d, 'lastImport', null),
  };
}

export type FinishInput = {
  sessionId: string;
  length: string;
  seconds: number;
  answers: number;
  correct: number;
  bossWon: boolean | null;
  bestGenderCombo: number;
  perfectBlocks: number;
  startedAt: string;
};

export function finishSession(f: FinishInput, d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const settings = getSettings(d);
  const before = d.prepare('SELECT * FROM days WHERE day = ?').get(today) ?? { sessions: 0, goal_met: 0 };
  const sessions = Number(before.sessions) + 1;
  const goalNow = sessions >= settings.dailyGoalSessions;
  let bonus = f.perfectBlocks * BONUS.perfectBlock + (f.bossWon ? BONUS.bossWin : 0);
  if (goalNow && !before.goal_met) bonus += BONUS.dailyGoal;

  d.prepare(
    `INSERT INTO days(day, xp, sessions, seconds, goal_met) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(day) DO UPDATE SET xp = xp + excluded.xp, sessions = sessions + 1, seconds = seconds + excluded.seconds,
       goal_met = MAX(goal_met, excluded.goal_met)`,
  ).run(today, bonus, Math.round(f.seconds), goalNow ? 1 : 0);
  const sessionXp = Number(d.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM attempts WHERE session_id = ?').get(f.sessionId).n) + bonus;
  d.prepare(
    `INSERT OR REPLACE INTO sessions(id, day, started_at, finished_at, length, xp, seconds, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(f.sessionId, today, f.startedAt, now.toISOString(), f.length, sessionXp, Math.round(f.seconds), JSON.stringify(f));

  const streak = recordSession(streakState(d, now), today, goalNow);
  setMeta(d, 'streak', streak);

  // Achievements
  const ach = getMeta<Record<string, string>>(d, 'achievements', {});
  const unlocked: string[] = [];
  const unlock = (k: string, cond: boolean) => {
    if (cond && !ach[k]) { ach[k] = today; unlocked.push(k); }
  };
  const words = wordsProducible(d);
  const spoken = Number(d.prepare(`SELECT COUNT(*) AS n FROM attempts WHERE format = 'speak' AND correct = 1`).get().n);
  unlock('first', true);
  unlock('streak3', streak.current >= 3);
  unlock('streak7', streak.current >= 7);
  unlock('streak30', streak.current >= 30);
  unlock('words50', words >= 50);
  unlock('words100', words >= 100);
  unlock('words250', words >= 250);
  unlock('words500', words >= 500);
  unlock('boss', !!f.bossWon);
  unlock('gender15', f.bestGenderCombo >= 15);
  unlock('perfect', f.answers >= 20 && f.correct === f.answers);
  unlock('speaker', spoken >= 25);
  unlock('early', new Date(f.startedAt).getHours() < 9 && new Date(f.startedAt).getHours() >= 4);
  setMeta(d, 'achievements', ach);

  const summary = dailySummary(d, now);
  try {
    const dir = resolve(DATA_DIR, 'progress');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${today}.json`), JSON.stringify(summary, null, 2));
  } catch { /* progress export is best-effort */ }

  return {
    bonus,
    sessionXp,
    goalMetNow: goalNow && !before.goal_met,
    streak,
    unlocked: unlocked.map((k) => ({ key: k, ...ACHIEVEMENTS[k] })),
    state: appState(d, now),
  };
}

export function stats(d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const since = addDays(today, -119);
  const heatmap = d.prepare('SELECT day, xp, sessions, seconds FROM days WHERE day >= ? ORDER BY day').all(since);
  const byFormat = d
    .prepare(`SELECT format, COUNT(*) AS n, SUM(correct) AS ok, AVG(response_ms) AS ms FROM attempts WHERE day >= ? GROUP BY format`)
    .all(addDays(today, -29))
    .map((r: any) => ({ format: r.format, n: Number(r.n), accuracy: Number(r.ok) / Number(r.n), avgMs: Math.round(Number(r.ms)) }));
  const weak = d
    .prepare(
      `SELECT i.id, i.target, i.meaning, COUNT(*) AS misses FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.correct = 0 AND a.day >= ? GROUP BY i.id ORDER BY misses DESC LIMIT 12`,
    )
    .all(addDays(today, -13))
    .map((r: any) => ({ id: Number(r.id), target: r.target, meaning: r.meaning, misses: Number(r.misses) }));
  const mastery = d
    .prepare(`SELECT st.mastery, COUNT(*) AS n FROM item_state st JOIN srs s ON s.item_id = st.item_id GROUP BY st.mastery ORDER BY st.mastery`)
    .all()
    .map((r: any) => ({ level: Number(r.mastery), n: Number(r.n) }));
  const forecast: { day: string; n: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(now.getTime() + i * 86400000);
    forecast.push({ day: dayKey(dayStart), n: 0 });
  }
  const dueRows = d.prepare('SELECT due FROM srs WHERE reps > 0').all();
  for (const r of dueRows as any[]) {
    const k = dayKey(new Date(r.due));
    const slot = forecast.find((f) => f.day === k) ?? (k < forecast[0].day ? forecast[0] : null);
    if (slot) slot.n++;
  }
  return { heatmap, byFormat, weak, mastery, forecast };
}

/** Machine-readable daily summary for the AI tutor and the Notion Session Log. */
export function dailySummary(d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const st = appState(d, now);
  const att = d.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(correct),0) AS ok FROM attempts WHERE day = ?`).get(today);
  const byFormat = d
    .prepare(`SELECT format, COUNT(*) AS n, SUM(correct) AS ok FROM attempts WHERE day = ? GROUP BY format`)
    .all(today)
    .map((r: any) => ({ format: r.format, answers: Number(r.n), accuracy: Math.round((Number(r.ok) / Number(r.n)) * 100) }));
  const errors = d
    .prepare(
      `SELECT i.target, i.meaning, a.format, a.given, a.article_error FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.day = ? AND (a.correct = 0 OR a.article_error = 1) ORDER BY a.id DESC LIMIT 15`,
    )
    .all(today)
    .map((r: any) => ({ target: r.target, meaning: r.meaning, format: r.format, given: r.given, type: r.article_error ? 'gender' : 'vocab' }));
  const r7 = d.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(grade = 1),0) AS again FROM attempts WHERE grade IS NOT NULL AND day >= ?`).get(addDays(today, -6));
  return {
    date: today,
    minutes: st.today.minutes,
    sessions: st.today.sessions,
    xp: st.today.xp,
    streak: st.streak.current,
    freezesLeft: st.streak.freezes,
    studyDaysThisMonth: st.studyDaysMonth,
    answers: Number(att.n),
    accuracy: Number(att.n) ? Math.round((Number(att.ok) / Number(att.n)) * 100) : null,
    byFormat,
    newIntroducedToday: introducedTodayCount(d, now),
    wordsProducible: st.wordsProducible,
    goetheB1: st.goethe,
    reviews7d: Number(r7.n),
    again7d: Number(r7.again),
    retention7d: Number(r7.n) ? Math.round((1 - Number(r7.again) / Number(r7.n)) * 100) : null,
    errors,
  };
}

/** Long-term progress: how far, how fast, how much is left, and a projected finish date. */
export function progressReport(d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const settings = getSettings(d);
  const n = (sql: string, ...p: any[]) => Number(d.prepare(sql).get(...p).n);
  const vocabTotal = n(`SELECT COUNT(*) AS n FROM items WHERE kind != 'grammar' AND suspended = 0`);
  const introduced = n(`SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.kind != 'grammar'`);
  const producible = wordsProducible(d);
  const spoken = n(`SELECT COUNT(*) AS n FROM item_state st JOIN items i ON i.id = st.item_id WHERE st.mastery >= 5 AND i.kind != 'grammar'`);
  const groupsTotal = n(`SELECT COUNT(DISTINCT grp) AS n FROM items WHERE kind = 'grammar' AND grp IS NOT NULL`);
  const groupsDone = n(`SELECT COUNT(DISTINCT i.grp) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.kind = 'grammar'`);
  const seconds = n(`SELECT COALESCE(SUM(seconds), 0) AS n FROM days`);
  const studyDays = n(`SELECT COUNT(*) AS n FROM days WHERE sessions > 0`);
  const firstDay = (d.prepare(`SELECT MIN(day) AS d FROM days WHERE sessions > 0`).get().d as string | null) ?? today;

  // Day by day: minutes, new words met, and words first recalled correctly (cumulative = words learned).
  const since = addDays(today, -59);
  const days = new Map<string, { day: string; minutes: number; xp: number; newWords: number; learned: number }>();
  for (let i = 59; i >= 0; i--) { const k = addDays(today, -i); days.set(k, { day: k, minutes: 0, xp: 0, newWords: 0, learned: 0 }); }
  for (const r of d.prepare(`SELECT day, seconds, xp FROM days WHERE day >= ?`).all(since) as any[]) {
    const x = days.get(r.day); if (x) { x.minutes = Math.round(Number(r.seconds) / 60); x.xp = Number(r.xp); }
  }
  for (const r of d.prepare(`SELECT s.introduced_day AS day, COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.kind != 'grammar' AND s.introduced_day >= ? GROUP BY s.introduced_day`).all(since) as any[]) {
    const x = days.get(r.day); if (x) x.newWords = Number(r.n);
  }
  const firstRecall = d.prepare(
    `SELECT first_day AS day, COUNT(*) AS n FROM (
       SELECT a.item_id, MIN(a.day) AS first_day FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.correct = 1 AND a.article_error = 0 AND a.format IN ('typed','cloze','dictation','speak','boss') AND i.kind != 'grammar'
       GROUP BY a.item_id) GROUP BY first_day`,
  ).all() as any[];
  let before = 0;
  for (const r of firstRecall) { const x = days.get(r.day); if (x) x.learned = Number(r.n); else if (r.day < since) before += Number(r.n); }
  let cum = before;
  const series = [...days.values()].map((x) => ({ ...x, cumulative: (cum += x.learned) }));

  // Pace over the last 7 calendar days (missed days count, so the forecast stays honest).
  const last7 = series.slice(-7);
  const wordsPerDay = last7.reduce((s, x) => s + x.learned, 0) / 7;
  const minutesPerDay = last7.reduce((s, x) => s + x.minutes, 0) / 7;
  const remainingDeck = Math.max(0, vocabTotal - producible);
  const B1_WORDS = 2400; // Goethe-Zertifikat B1 Wortliste: about 2,400 lexical units
  const remainingB1 = Math.max(0, B1_WORDS - producible);
  const eta = (left: number, perDay: number) => (perDay > 0 ? addDays(today, Math.ceil(left / perDay)) : null);

  return {
    today,
    since: firstDay,
    totals: {
      vocabTotal, introduced, producible, spoken, remainingDeck,
      grammar: { done: groupsDone, total: groupsTotal },
      hours: Math.round((seconds / 3600) * 10) / 10,
      studyDays,
    },
    pace: {
      wordsPerDay: Math.round(wordsPerDay * 10) / 10,
      minutesPerDay: Math.round(minutesPerDay),
      newPerDaySetting: settings.newPerDay,
    },
    forecast: {
      deckAtCurrentPace: eta(remainingDeck, wordsPerDay),
      deckAtSetting: eta(remainingDeck, settings.newPerDay),
      b1Words: { target: B1_WORDS, remaining: remainingB1, atCurrentPace: eta(remainingB1, wordsPerDay), at30PerDay: eta(remainingB1, 30) },
      // Goethe-Institut estimate for B1 from zero: about 260–490 hours of guided study.
      b1Hours: { low: 260, high: 490, done: Math.round((seconds / 3600) * 10) / 10 },
    },
    series,
  };
}
