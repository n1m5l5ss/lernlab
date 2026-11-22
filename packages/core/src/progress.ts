// Progress: streaks, daily goal, achievements, stats, and the daily summary for the AI tutor / Notion.
import type { Row, SqlValue } from './host';
import { getDb, getMeta, setMeta, whileUnchanged, type DB } from './db';
import { host } from './host';
import {
  addDays,
  BONUS,
  dayKey,
  daysBetween,
  levelFor,
  NEW_STREAK,
  recordSession,
  settleStreak,
  streakChange,
  type StreakState,
  weekDays,
  weekStart,
} from './game';
import {
  activeDeckId,
  currentSource,
  deckNewPerDay,
  deckStats,
  dueItemIds,
  freshPerDeck,
  getSettings,
  hardestCards,
  hardestCount,
  HARDEST_LIMIT,
  introducedTodayCount,
  newTodayFor,
  scopeFor,
} from './learn';
import { getDeck, listDecks, LANGUAGES } from './library';
import { KNOWN_MASTERY } from './browse';
import { stripHtml } from './text';
import { LEVELS, type Level } from './variants';
import { RECALL_FORMATS } from './types';
import { calibration, calibrationCounts } from './confidence';
import { WEEK_GOAL, weekCardTarget, weekSessionTarget } from './weekgoal';
import { spacingCounts, spacingReport } from './spacing';

/** Badge ids, in display order. Their names and descriptions live in locales/<code>.json under badges.<id>. */
export const ACHIEVEMENTS = [
  'first',
  'streak3',
  'streak7',
  'streak30',
  'words50',
  'words100',
  'words250',
  'words500',
  'boss',
  'gender15',
  'perfect',
  'speaker',
  'early',
] as const;
export type AchievementId = (typeof ACHIEVEMENTS)[number];

function metDays(d: DB): Set<string> {
  return new Set(
    d
      .prepare('SELECT day FROM days WHERE goal_met = 1')
      .all()
      .map((r: Row) => r.day as string),
  );
}

export function streakState(d: DB = getDb(), now = new Date()): StreakState {
  const today = dayKey(now);
  const before = getMeta(d, 'streak', NEW_STREAK);
  const s = settleStreak(before, today, metDays(d));
  // Write only a real change, so that reading the state leaves the data (and its cached counts) as they are.
  if (JSON.stringify(s) !== JSON.stringify(before)) setMeta(d, 'streak', s);
  return s;
}

export function wordsProducible(d: DB = getDb(), deckId?: number | null): number {
  return Number(
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM item_state st JOIN items i ON i.id = st.item_id WHERE st.mastery >= 3 AND i.kind != 'grammar'${deckId ? ` AND i.deck_id = ${Number(deckId)}` : ''}`,
      )
      .get()!.n,
  );
}

function goalProgress(deckId: number | null, d: DB, words?: number) {
  const deck = deckId ? getDeck(deckId, d) : null;
  const goal = deck?.settings.goal;
  if (!goal) return null;
  const known = goal.tag
    ? Number(
        d
          .prepare(
            `SELECT COUNT(*) AS n FROM items i JOIN item_state st ON st.item_id = i.id WHERE i.deck_id = ? AND i.tags LIKE ? AND st.mastery >= 3`,
          )
          .get(deckId, `%${goal.tag}%`)!.n,
      )
    : (words ?? wordsProducible(d, deckId));
  const total = goal.tag
    ? Number(
        d.prepare(`SELECT COUNT(*) AS n FROM items WHERE deck_id = ? AND tags LIKE ?`).get(deckId, `%${goal.tag}%`)!.n,
      )
    : goal.words;
  return { label: goal.label, known, total };
}

/** Every tag in use, sorted, for the "study a tag" choice. */
function allTags(d: DB): string[] {
  const seen = new Map<string, string>();
  for (const r of d.prepare("SELECT DISTINCT tags FROM items WHERE tags != '[]'").all())
    for (const t of JSON.parse(r.tags as string) as string[])
      if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  return [...seen.values()].sort((a, b) => a.localeCompare(b)).slice(0, 300);
}

/** Any study today (a finished session or answered cards), by the learning day that starts at 4 a.m. */
export function studiedToday(d: DB = getDb(), now = new Date()): boolean {
  const r = d.prepare('SELECT sessions, xp FROM days WHERE day = ?').get(dayKey(now));
  return !!r && (Number(r.sessions) > 0 || Number(r.xp) > 0);
}

export function appState(d: DB = getDb(), now = new Date()) {
  const settings = getSettings(d);
  const today = dayKey(now);
  const streak = streakState(d, now);
  const totalXp = Number(d.prepare('SELECT COALESCE(SUM(xp), 0) AS n FROM days').get()!.n);
  const t = d.prepare('SELECT * FROM days WHERE day = ?').get(today) ?? { xp: 0, sessions: 0, seconds: 0, goal_met: 0 };
  const month = today.slice(0, 7);
  const studyDaysMonth = Number(
    d.prepare(`SELECT COUNT(*) AS n FROM days WHERE day LIKE ? AND sessions > 0`).get(`${month}%`)!.n,
  );
  const deckId = activeDeckId(d);
  const source = currentSource(d);
  const scope = scopeFor(source, d);
  const where = deckId ? ` WHERE deck_id = ${Number(deckId)}` : '';
  const itemCount = Number(d.prepare(`SELECT COUNT(*) AS n FROM items${where}`).get()!.n);
  // Every deck's counts in one grouped query (#130), then the totals from them.
  const stats = whileUnchanged(d, `deckStats:${today}`, () => deckStats(d, now));
  const total = (key: 'introduced' | 'words') =>
    deckId ? (stats.get(deckId)?.[key] ?? 0) : [...stats.values()].reduce((n, s) => n + s[key], 0);
  const introduced = total('introduced');
  const newPerDay = (dk: { settings: { newPerDay?: unknown } }) =>
    typeof dk.settings.newPerDay === 'number' ? dk.settings.newPerDay : settings.newPerDay;
  const decks = listDecks(d).map((dk) => {
    const s = stats.get(dk.id);
    return {
      ...dk,
      cards: s?.cards ?? 0,
      fresh: s?.fresh ?? 0,
      learned: s?.learned ?? 0,
      due: Math.min(2000, s?.due ?? 0),
      newToday: newTodayFor(s, newPerDay(dk)),
      languageName: dk.language ? (LANGUAGES[dk.language] ?? dk.language) : null,
    };
  });
  const oneDeck = typeof scope === 'number' && scope ? decks.find((dk) => dk.id === scope) : undefined;
  const lastDay = d.prepare('SELECT MAX(day) AS d FROM days WHERE sessions > 0 AND day < ?').get(today)!.d as
    string | null;
  return {
    imported: decks.length > 0,
    decks,
    activeDeck: deckId,
    itemCount,
    introduced,
    // Due and new counts follow what the next session covers (a deck, all decks, a tag, starred, hardest).
    source,
    due: oneDeck ? oneDeck.due : dueItemIds(d, now, 2000, scope).length,
    newLeftToday: oneDeck ? oneDeck.newToday : freshPerDeck(d, now, scope, 1000).length,
    tags: whileUnchanged(d, 'tags', () => allTags(d)),
    starredCount: Number(d.prepare('SELECT COUNT(*) AS n FROM items WHERE starred = 1 AND suspended = 0').get()!.n),
    hardestCount: hardestCount(d),
    totalXp,
    level: levelFor(totalXp),
    streak,
    today: {
      xp: Number(t.xp),
      sessions: Number(t.sessions),
      minutes: Math.round(Number(t.seconds) / 60),
      goalMet: !!t.goal_met,
    },
    studyDaysMonth,
    week: weekDays(
      today,
      new Set(
        d
          .prepare('SELECT day FROM days WHERE sessions > 0 AND day BETWEEN ? AND ?')
          .all(addDays(today, -6), addDays(today, 6))
          .map((r: Row) => r.day as string),
      ),
    ),
    wordsProducible: total('words'),
    goal: goalProgress(deckId, d, total('words')),
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
  const sessionXp =
    Number(d.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM attempts WHERE session_id = ?').get(f.sessionId)!.n) + bonus;
  d.prepare(
    `INSERT OR REPLACE INTO sessions(id, day, started_at, finished_at, length, xp, seconds, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    f.sessionId,
    today,
    f.startedAt,
    now.toISOString(),
    f.length,
    sessionXp,
    Math.round(f.seconds),
    JSON.stringify(f),
  );

  const streakBefore = streakState(d, now);
  const streak = recordSession(streakBefore, today, goalNow);
  setMeta(d, 'streak', streak);

  // Achievements
  const ach = getMeta<Record<string, string>>(d, 'achievements', {});
  const unlocked: string[] = [];
  const unlock = (k: AchievementId, cond: boolean) => {
    if (cond && !ach[k]) {
      ach[k] = today;
      unlocked.push(k);
    }
  };
  const words = wordsProducible(d);
  const spoken = Number(
    d.prepare(`SELECT COUNT(*) AS n FROM attempts WHERE format = 'speak' AND correct = 1`).get()!.n,
  );
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
    host().saveProgressSnapshot(today, JSON.stringify(summary, null, 2));
  } catch {
    /* progress export is best-effort */
  }

  return {
    bonus,
    sessionXp,
    goalMetNow: goalNow && !before.goal_met,
    streak,
    streakChange: streakChange(streakBefore, streak),
    unlocked: unlocked.map((k) => ({ key: k })),
    state: appState(d, now),
  };
}

export function stats(d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const since = addDays(today, -119);
  const heatmap = d.prepare('SELECT day, xp, sessions, seconds FROM days WHERE day >= ? ORDER BY day').all(since);
  const byFormat = d
    .prepare(
      `SELECT format, COUNT(*) AS n, SUM(correct) AS ok, AVG(response_ms) AS ms FROM attempts WHERE day >= ? GROUP BY format`,
    )
    .all(addDays(today, -29))
    .map((r: Row) => ({
      format: r.format,
      n: Number(r.n),
      accuracy: Number(r.ok) / Number(r.n),
      avgMs: Math.round(Number(r.ms)),
    }));
  const weak = d
    .prepare(
      `SELECT i.id, i.target, i.meaning, COUNT(*) AS misses FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.correct = 0 AND a.day >= ? GROUP BY i.id ORDER BY misses DESC LIMIT 12`,
    )
    .all(addDays(today, -13))
    .map((r: Row) => ({ id: Number(r.id), target: r.target, meaning: r.meaning, misses: Number(r.misses) }));
  const mastery = d
    .prepare(
      `SELECT st.mastery, COUNT(*) AS n FROM item_state st JOIN srs s ON s.item_id = st.item_id GROUP BY st.mastery ORDER BY st.mastery`,
    )
    .all()
    .map((r: Row) => ({ level: Number(r.mastery), n: Number(r.n) }));
  const forecast: { day: string; n: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(now.getTime() + i * 86400000);
    forecast.push({ day: dayKey(dayStart), n: 0 });
  }
  const dueRows = d.prepare('SELECT due FROM srs WHERE reps > 0').all();
  for (const r of dueRows) {
    const k = dayKey(new Date(r.due as string));
    const slot = forecast.find((f) => f.day === k) ?? (k < forecast[0].day ? forecast[0] : null);
    if (slot) slot.n++;
  }
  return { heatmap, byFormat, weak, mastery, forecast };
}

/** Machine-readable daily summary for the AI tutor and the Notion Session Log. */
export function dailySummary(d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const st = appState(d, now);
  const att = d.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(correct),0) AS ok FROM attempts WHERE day = ?`).get(today)!;
  const byFormat = d
    .prepare(`SELECT format, COUNT(*) AS n, SUM(correct) AS ok FROM attempts WHERE day = ? GROUP BY format`)
    .all(today)
    .map((r: Row) => ({
      format: r.format,
      answers: Number(r.n),
      accuracy: Math.round((Number(r.ok) / Number(r.n)) * 100),
    }));
  const errors = d
    .prepare(
      `SELECT i.target, i.meaning, a.format, a.given, a.article_error FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.day = ? AND (a.correct = 0 OR a.article_error = 1) ORDER BY a.id DESC LIMIT 15`,
    )
    .all(today)
    .map((r: Row) => ({
      target: r.target,
      meaning: r.meaning,
      format: r.format,
      given: r.given,
      type: r.article_error ? 'gender' : 'vocab',
    }));
  const r7 = d
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(grade = 1),0) AS again FROM attempts WHERE grade IS NOT NULL AND day >= ?`,
    )
    .get(addDays(today, -6))!;
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
    goal: st.goal,
    reviews7d: Number(r7.n),
    again7d: Number(r7.again),
    retention7d: Number(r7.n) ? Math.round((1 - Number(r7.again) / Number(r7.n)) * 100) : null,
    errors,
  };
}

/** Long-term progress: how far, how fast, how much is left, and a projected finish date. */
export function progressReport(d: DB = getDb(), now = new Date(), deckIdArg?: number | null) {
  const today = dayKey(now);
  const deckId = deckIdArg === undefined ? activeDeckId(d) : deckIdArg;
  const deck = deckId ? getDeck(deckId, d) : null;
  const D = deckId ? ` AND i.deck_id = ${Number(deckId)}` : '';
  const n = (sql: string, ...p: SqlValue[]) => Number(d.prepare(sql).get(...p)!.n);
  const vocabTotal = n(`SELECT COUNT(*) AS n FROM items i WHERE i.kind != 'grammar' AND i.suspended = 0${D}`);
  const introduced = n(
    `SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.kind != 'grammar'${D}`,
  );
  const producible = wordsProducible(d, deckId);
  const spoken = n(
    `SELECT COUNT(*) AS n FROM item_state st JOIN items i ON i.id = st.item_id WHERE st.mastery >= 5 AND i.kind != 'grammar'${D}`,
  );
  const groupsTotal = n(
    `SELECT COUNT(DISTINCT i.grp) AS n FROM items i WHERE i.kind = 'grammar' AND i.grp IS NOT NULL${D}`,
  );
  const groupsDone = n(
    `SELECT COUNT(DISTINCT i.grp) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.kind = 'grammar'${D}`,
  );
  const seconds = n(`SELECT COALESCE(SUM(seconds), 0) AS n FROM days`);
  const studyDays = n(`SELECT COUNT(*) AS n FROM days WHERE sessions > 0`);
  const firstDay = (d.prepare(`SELECT MIN(day) AS d FROM days WHERE sessions > 0`).get()!.d as string | null) ?? today;

  // Day by day: minutes, new words met, and words first recalled correctly (cumulative = words learned).
  const since = addDays(today, -59);
  const days = new Map<string, { day: string; minutes: number; xp: number; newWords: number; learned: number }>();
  for (let i = 59; i >= 0; i--) {
    const k = addDays(today, -i);
    days.set(k, { day: k, minutes: 0, xp: 0, newWords: 0, learned: 0 });
  }
  for (const r of d.prepare(`SELECT day, seconds, xp FROM days WHERE day >= ?`).all(since) as Row[]) {
    const x = days.get(r.day as string);
    if (x) {
      x.minutes = Math.round(Number(r.seconds) / 60);
      x.xp = Number(r.xp);
    }
  }
  for (const r of d
    .prepare(
      `SELECT s.introduced_day AS day, COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.kind != 'grammar' AND s.introduced_day >= ?${D} GROUP BY s.introduced_day`,
    )
    .all(since) as Row[]) {
    const x = days.get(r.day as string);
    if (x) x.newWords = Number(r.n);
  }
  const firstRecall = d
    .prepare(
      `SELECT first_day AS day, COUNT(*) AS n FROM (
       SELECT a.item_id, MIN(a.day) AS first_day FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.correct = 1 AND a.article_error = 0 AND a.format IN ('typed','cloze','dictation','speak','boss','flip') AND i.kind != 'grammar'${D}
       GROUP BY a.item_id) GROUP BY first_day`,
    )
    .all() as Row[];
  let before = 0;
  for (const r of firstRecall) {
    const x = days.get(r.day as string);
    if (x) x.learned = Number(r.n);
    else if ((r.day as string) < since) before += Number(r.n);
  }
  let cum = before;
  const series = [...days.values()].map((x) => ({ ...x, cumulative: (cum += x.learned) }));

  // Pace over the last 7 calendar days (missed days count, so the forecast stays honest).
  const last7 = series.slice(-7);
  const wordsPerDay = last7.reduce((s, x) => s + x.learned, 0) / 7;
  const minutesPerDay = last7.reduce((s, x) => s + x.minutes, 0) / 7;
  const remainingDeck = Math.max(0, vocabTotal - producible);
  const goal = deck?.settings.goal ?? null;
  const goalWords = goal?.words ?? vocabTotal;
  const remainingB1 = Math.max(0, goalWords - producible);
  const eta = (left: number, perDay: number) => (perDay > 0 ? addDays(today, Math.ceil(left / perDay)) : null);

  return {
    today,
    deck: deck ? { id: deck.id, name: deck.name } : null,
    since: firstDay,
    totals: {
      vocabTotal,
      introduced,
      producible,
      spoken,
      remainingDeck,
      grammar: { done: groupsDone, total: groupsTotal },
      hours: Math.round((seconds / 3600) * 10) / 10,
      studyDays,
    },
    pace: {
      wordsPerDay: Math.round(wordsPerDay * 10) / 10,
      minutesPerDay: Math.round(minutesPerDay),
      newPerDaySetting: deckNewPerDay(deckId, d),
    },
    forecast: {
      deckAtCurrentPace: eta(remainingDeck, wordsPerDay),
      deckAtSetting: eta(remainingDeck, deckNewPerDay(deckId, d)),
      goal: goal
        ? {
            label: goal.label,
            target: goalWords,
            remaining: remainingB1,
            atCurrentPace: eta(remainingB1, wordsPerDay),
            at30PerDay: eta(remainingB1, 30),
            hours: goal.hoursLow
              ? {
                  low: goal.hoursLow,
                  high: goal.hoursHigh ?? goal.hoursLow,
                  done: Math.round((seconds / 3600) * 10) / 10,
                }
              : null,
          }
        : null,
    },
    series,
  };
}

/** How the Progress screen measures the journey. */
export const JOURNEY = {
  /** Pace is the average over this many weeks, so one busy or missed week doesn't swing the forecast. */
  paceWeeks: 4,
  retentionWeeks: 12,
  /** A year of study days, in whole weeks. */
  heatmapWeeks: 53,
  hardest: HARDEST_LIMIT,
} as const;

/**
 * The Progress screen: per deck learned vs remaining, pace and forecast; study days; retention; hardest cards.
 * A card is learned once it is known (mastery ≥ KNOWN_MASTERY). Pace counts the cards first recalled in a real
 * review (graded, not practice) over the last few weeks. Retention is the share of real reviews recalled.
 */
export function journey(d: DB = getDb(), now = new Date()) {
  const today = dayKey(now);
  const thisWeek = weekStart(today);

  const counts = new Map(
    d
      .prepare(
        `SELECT i.deck_id, COUNT(*) AS cards, COALESCE(SUM(COALESCE(st.mastery, 0) >= ${KNOWN_MASTERY}), 0) AS learned
         FROM items i LEFT JOIN item_state st ON st.item_id = i.id WHERE i.suspended = 0 GROUP BY i.deck_id`,
      )
      .all()
      .map((r: Row) => [Number(r.deck_id), { cards: Number(r.cards), learned: Number(r.learned) }]),
  );
  const paceSince = addDays(today, -7 * JOURNEY.paceWeeks + 1);
  const recent = new Map(
    d
      .prepare(
        `SELECT deck_id, COUNT(*) AS n, COALESCE(SUM(first >= ?), 0) AS week FROM (
           SELECT i.deck_id, MIN(a.day) AS first FROM attempts a JOIN items i ON i.id = a.item_id
           WHERE a.practice = 0 AND a.grade >= 2 GROUP BY a.item_id)
         WHERE first >= ? GROUP BY deck_id`,
      )
      .all(thisWeek, paceSince)
      .map((r: Row) => [Number(r.deck_id), { n: Number(r.n), week: Number(r.week) }]),
  );
  const newPerDay = getSettings(d).newPerDay;
  // The mix of question levels answered per deck (#198), over the retention window. Only recall answers and
  // variant questions count (games are not questions); a deck shows it once one of its variants was asked.
  const levelRows = d
    .prepare(
      `SELECT i.deck_id, COALESCE(a.level, 'recall') AS level, COUNT(*) AS n FROM attempts a
       JOIN items i ON i.id = a.item_id
       WHERE a.day >= ? AND (a.level IS NOT NULL OR a.format IN (${RECALL_FORMATS.map((f) => `'${f}'`).join(',')}))
       GROUP BY i.deck_id, COALESCE(a.level, 'recall')`,
    )
    .all(addDays(thisWeek, -7 * (JOURNEY.retentionWeeks - 1)));
  const levelsOf = (deckId: number): Record<Level, number> | null => {
    const rows = levelRows.filter((r: Row) => Number(r.deck_id) === deckId);
    if (!rows.some((r: Row) => r.level !== 'recall')) return null;
    const out: Record<Level, number> = { recall: 0, apply: 0, analyse: 0 };
    for (const r of rows) if (LEVELS.includes(r.level as Level)) out[r.level as Level] = Number(r.n);
    return out;
  };
  const perWeekOf = (n: number) => Math.round((n / JOURNEY.paceWeeks) * 10) / 10;
  const decks = listDecks(d).map((dk) => {
    const { cards, learned } = counts.get(dk.id) ?? { cards: 0, learned: 0 };
    const goal = dk.settings.goal?.words ? { label: dk.settings.goal.label, target: dk.settings.goal.words } : null;
    const left = Math.max(0, (goal?.target ?? cards) - learned);
    const perWeek = perWeekOf(recent.get(dk.id)?.n ?? 0);
    const weekDone = recent.get(dk.id)?.week ?? 0;
    return {
      /** This week's share of the weekly goal (#214): new cards to learn, and how many are done. */
      week: {
        done: weekDone,
        target: weekCardTarget({
          left,
          done: weekDone,
          examDate: dk.settings.examDate,
          week: thisWeek,
          perWeek,
          newPerDay: typeof dk.settings.newPerDay === 'number' ? dk.settings.newPerDay : newPerDay,
        }),
      },
      id: dk.id,
      name: dk.name,
      cards,
      learned,
      remaining: Math.max(0, cards - learned),
      perWeek,
      goal,
      examDate: dk.settings.examDate ?? null,
      reached: cards > 0 && left === 0,
      /** Answers per question level over the last weeks, or null while none of the deck's variants was asked. */
      levels: levelsOf(dk.id),
      /** The day the goal (or the whole deck) is reached at this pace; null without a pace. */
      forecast: left > 0 && perWeek > 0 ? addDays(today, Math.ceil((left / perWeek) * 7)) : null,
    };
  });

  const heatmapSince = addDays(thisWeek, -7 * (JOURNEY.heatmapWeeks - 1));
  const studyDays = d
    .prepare('SELECT day, seconds FROM days WHERE sessions > 0 AND day >= ? AND day <= ? ORDER BY day')
    .all(heatmapSince, today)
    .map((r: Row) => ({ day: r.day as string, minutes: Math.round(Number(r.seconds) / 60) }));

  const weeks = Array.from({ length: JOURNEY.retentionWeeks }, (_, i) => ({
    week: addDays(thisWeek, -7 * (JOURNEY.retentionWeeks - 1 - i)),
    reviews: 0,
    recalled: 0,
  }));
  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  for (const r of d
    .prepare(
      `SELECT day, COUNT(*) AS n, SUM(grade >= 2) AS ok FROM attempts
       WHERE practice = 0 AND grade >= 1 AND day >= ? AND day <= ? GROUP BY day`,
    )
    .all(weeks[0].week, today)) {
    const w = byWeek.get(weekStart(r.day as string));
    if (!w) continue;
    w.reviews += Number(r.n);
    w.recalled += Number(r.ok);
  }

  // This week's goal (#214): the decks' card goals added up, and sessions from the weeks before.
  const sessionsSince = addDays(thisWeek, -7 * WEEK_GOAL.historyWeeks);
  const sessionsByWeek = new Map<string, number>();
  for (const r of d.prepare('SELECT day, sessions FROM days WHERE day >= ? AND day <= ?').all(sessionsSince, today)) {
    const w = weekStart(r.day as string);
    sessionsByWeek.set(w, (sessionsByWeek.get(w) ?? 0) + Number(r.sessions));
  }
  const earlier = Array.from(
    { length: WEEK_GOAL.historyWeeks },
    (_, i) => sessionsByWeek.get(addDays(thisWeek, -7 * (i + 1))) ?? 0,
  );
  const daysThisWeek = studyDays.filter((s) => s.day >= thisWeek);
  const nextExam = decks
    .filter((x) => x.examDate && x.examDate >= today)
    .sort((a, b) => a.examDate!.localeCompare(b.examDate!))[0];
  const week = {
    start: thisWeek,
    cards: {
      target: decks.reduce((s, x) => s + x.week.target, 0),
      done: decks.reduce((s, x) => s + x.week.done, 0),
    },
    sessions: { target: weekSessionTarget(earlier), done: sessionsByWeek.get(thisWeek) ?? 0 },
    /** Days studied and minutes since Monday, for the progress card. */
    days: daysThisWeek.length,
    minutes: daysThisWeek.reduce((s, x) => s + x.minutes, 0),
    /** The next exam among the decks, if any. */
    exam: nextExam
      ? { deck: nextExam.name, date: nextExam.examDate!, days: daysBetween(today, nextExam.examDate!) }
      : null,
  };

  const hard = hardestCards(JOURNEY.hardest, d);
  const text = new Map(
    (hard.length
      ? d
          .prepare(
            `SELECT i.id, i.target, i.meaning, dk.language FROM items i JOIN decks dk ON dk.id = i.deck_id
             WHERE i.id IN (${hard.map((h) => Number(h.id)).join(',')})`,
          )
          .all()
      : []
    ).map((r: Row) => [Number(r.id), r]),
  );
  const plain = (html: unknown) => stripHtml(String(html ?? '')).slice(0, 120);

  return {
    today,
    decks,
    week,
    totals: {
      learned: decks.reduce((s, x) => s + x.learned, 0),
      remaining: decks.reduce((s, x) => s + x.remaining, 0),
      perWeek: perWeekOf([...recent.values()].reduce((s, r) => s + r.n, 0)),
    },
    heatmapSince,
    studyDays,
    retention: {
      weeks,
      reviews: weeks.reduce((s, w) => s + w.reviews, 0),
      recalled: weeks.reduce((s, w) => s + w.recalled, 0),
      target: getSettings(d).retention,
    },
    /** How sure you were (1–5) against how often you were right at the next review (#205). */
    calibration: calibration(calibrationCounts(d)),
    /** Recall after days, weeks and months away, next to repeats on the same day (#215). */
    spacing: spacingReport(spacingCounts(d, now)),
    hardest: hard.map((h) => ({
      ...h,
      front: plain(text.get(h.id)?.target),
      back: plain(text.get(h.id)?.meaning),
      lang: (text.get(h.id)?.language as string | null | undefined) ?? null,
    })),
  };
}
