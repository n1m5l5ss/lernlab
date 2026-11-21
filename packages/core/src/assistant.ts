// What an AI assistant the user connects (MCP, issue #148) may read. Every function here only reads: the
// assistant's process opens the database read-only, so a write would fail anyway. Streaks are settled in
// memory (settleStreak) instead of through streakState, which saves the settled state.
import type { Row, SqlValue } from './host';
import { getMeta, type DB } from './db';
import { addDays, daysBetween, dayKey, NEW_STREAK, settleStreak, weekStart, type StreakState } from './game';
import { deckStats, getSettings, ITEM_SELECT, newTodayFor, rowToItem } from './learn';
import { getDeck, LANGUAGES, listDecks } from './library';
import { KNOWN_MASTERY } from './browse';
import { stripHtml } from './text';
import { examSettings } from './exam';
import { recallProbability, type CardInput } from './scheduler';

/** Periods the assistant can ask about. "day" needs a date; week, month and year may take one (else the current one). */
export const PERIODS = ['today', 'day', 'week', 'month', 'year', 'all'] as const;
export type Period = (typeof PERIODS)[number];
export type Range = { period: Period; from: string; to: string };

/** A card counts as a leech from this many lapses (forgotten after it was learned). */
export const LEECH_LAPSES = 4;
/** At most this many rows in any list the assistant gets. */
export const LIST_MAX = 200;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: string) => DATE.test(s) && addDays(s, 0) === s;
/** Text from the database as plain, capped text: card and deck fields can come from untrusted deck files. */
export const plain = (html: unknown, max = 500) => stripHtml(String(html ?? '')).slice(0, max);
const plainOrNull = (html: unknown, max: number) => plain(html, max) || null;
/** Tags as plain text, at most 50 of 100 characters each. */
export const plainTags = (tags: unknown) =>
  (Array.isArray(tags) ? tags : [])
    .slice(0, 50)
    .map((t) => plain(t, 100))
    .filter(Boolean);

/** The settings an assistant may see. An allow-list, so a setting added later is not shared by accident. */
export const SHARED_SETTINGS = [
  'newPerDay',
  'dailyGoalSessions',
  'sessionLength',
  'retention',
  'sound',
  'teacherVoice',
  'blitzSeconds',
  'questionTimer',
  'uiLanguage',
  'theme',
  'textSize',
  'reducedMotion',
] as const;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

/** First and last learning day (YYYY-MM-DD, both included) of a period around `date` (default today). */
export function periodRange(period: Period, date: string | undefined, d: DB, now = new Date()): Range {
  const today = dayKey(now);
  const at = date ?? today;
  if (!isDate(at)) throw new RangeError('date must be YYYY-MM-DD');
  if (period === 'day' && !date) throw new RangeError('"day" needs a date');
  switch (period) {
    case 'today':
      return { period, from: today, to: today };
    case 'day':
      return { period, from: at, to: at };
    case 'week': {
      const from = weekStart(at);
      return { period, from, to: addDays(from, 6) };
    }
    case 'month': {
      const from = `${at.slice(0, 7)}-01`;
      const [y, m] = from.split('-').map(Number);
      const next = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}-01`;
      return { period, from, to: addDays(next, -1) };
    }
    case 'year':
      return { period, from: `${at.slice(0, 4)}-01-01`, to: `${at.slice(0, 4)}-12-31` };
    case 'all': {
      const first = d
        .prepare('SELECT MIN(day) AS d FROM (SELECT MIN(day) AS day FROM attempts UNION ALL SELECT MIN(day) FROM days)')
        .get()!.d;
      return { period, from: (first as string | null) ?? today, to: today };
    }
  }
}

/**
 * Study numbers for a range of learning days. Reviews are real recall attempts (graded, not practice);
 * retention is the share of them recalled. Answers count every exercise, games included. Time and
 * sessions are for all decks (the app records them per day, not per deck).
 */
export function periodStats(d: DB, range: Range, deckId?: number) {
  const { from, to } = range;
  const deck = deckId ? ' AND a.item_id IN (SELECT id FROM items WHERE deck_id = ?)' : '';
  const args: SqlValue[] = deckId ? [from, to, deckId] : [from, to];
  const a = d
    .prepare(
      `SELECT COUNT(*) AS answers, COALESCE(SUM(correct), 0) AS correct, COALESCE(SUM(practice), 0) AS practice,
         COALESCE(SUM(practice = 0 AND grade >= 1), 0) AS reviews, COALESCE(SUM(practice = 0 AND grade >= 2), 0) AS recalled
       FROM attempts a WHERE day BETWEEN ? AND ?${deck}`,
    )
    .get(...args)!;
  const t = d
    .prepare(
      `SELECT COALESCE(SUM(seconds), 0) AS s, COALESCE(SUM(sessions), 0) AS n, COALESCE(SUM(xp), 0) AS xp,
         COALESCE(SUM(sessions > 0), 0) AS days FROM days WHERE day BETWEEN ? AND ?`,
    )
    .get(from, to)!;
  const introduced = Number(
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE s.introduced_day BETWEEN ? AND ?${deckId ? ' AND i.deck_id = ?' : ''}`,
      )
      .get(...args)!.n,
  );
  // Learned: first recalled in a real review within the range (the Progress screen's measure).
  const learned = Number(
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM (SELECT a.item_id, MIN(a.day) AS first FROM attempts a
           WHERE a.practice = 0 AND a.grade >= 2${deck} GROUP BY a.item_id) WHERE first BETWEEN ? AND ?`,
      )
      .get(...(deckId ? [deckId, from, to] : [from, to]))!.n,
  );
  const byFormat = d
    .prepare(
      `SELECT format, COUNT(*) AS n, SUM(correct) AS ok FROM attempts a WHERE day BETWEEN ? AND ?${deck} GROUP BY format ORDER BY n DESC`,
    )
    .all(...args)
    .map((r: Row) => ({ format: String(r.format), answers: Number(r.n), accuracy: pct(Number(r.ok), Number(r.n)) }));
  const answers = Number(a.answers);
  const reviews = Number(a.reviews);
  return {
    ...range,
    deck: deckId ? plainOrNull(getDeck(deckId, d)?.name, 200) : null,
    reviews,
    recalled: Number(a.recalled),
    retentionPercent: pct(Number(a.recalled), reviews),
    answers,
    accuracyPercent: pct(Number(a.correct), answers),
    practiceAnswers: Number(a.practice),
    minutesStudied: Math.round(Number(t.s) / 60),
    sessions: Number(t.n),
    studyDays: Number(t.days),
    xp: Number(t.xp),
    cardsIntroduced: introduced,
    cardsLearned: learned,
    byFormat,
    /** Day by day for ranges up to a year, otherwise month by month. */
    series: series(d, from, to),
  };
}

function series(d: DB, from: string, to: string) {
  const byMonth = daysBetween(from, to) > 366;
  const key = byMonth ? 'substr(day, 1, 7)' : 'day';
  const rows = d
    .prepare(
      `SELECT ${key} AS k, SUM(n) AS answers, SUM(reviews) AS reviews, SUM(recalled) AS recalled, SUM(seconds) AS seconds FROM (
         SELECT day, COUNT(*) AS n, SUM(practice = 0 AND grade >= 1) AS reviews, SUM(practice = 0 AND grade >= 2) AS recalled, 0 AS seconds
           FROM attempts WHERE day BETWEEN ? AND ? GROUP BY day
         UNION ALL SELECT day, 0, 0, 0, seconds FROM days WHERE day BETWEEN ? AND ?)
       GROUP BY k ORDER BY k`,
    )
    .all(from, to, from, to);
  return rows
    .map((r: Row) => ({
      [byMonth ? 'month' : 'day']: String(r.k),
      answers: Number(r.answers),
      reviews: Number(r.reviews),
      retentionPercent: pct(Number(r.recalled), Number(r.reviews)),
      minutes: Math.round(Number(r.seconds) / 60),
    }))
    .filter((r) => r.answers > 0 || r.minutes > 0);
}

/** FSRS's chance of recalling a card now (0–1), or null when the stored state can't be read. */
function retrievability(card: CardInput, now: Date): number | null {
  try {
    return recallProbability(card, now);
  } catch {
    return null;
  }
}

/** The FSRS memory state of a card: next due date and the chance of recalling it now. Null for a new card. */
export function memoryForecast(d: DB, id: number, now = new Date()) {
  const r = d
    .prepare('SELECT card, due, reps, lapses, introduced_day, last_graded_day FROM srs WHERE item_id = ?')
    .get(id);
  if (!r) return null;
  const card = JSON.parse(String(r.card)) as CardInput & { stability?: number; difficulty?: number };
  const recall = Number(r.reps) > 0 ? retrievability(card, now) : null;
  return {
    due: String(r.due),
    reps: Number(r.reps),
    lapses: Number(r.lapses),
    stabilityDays: typeof card.stability === 'number' ? Math.round(card.stability * 10) / 10 : null,
    difficulty: typeof card.difficulty === 'number' ? Math.round(card.difficulty * 100) / 100 : null,
    recallProbabilityPercent: recall === null || !Number.isFinite(recall) ? null : Math.round(recall * 1000) / 10,
    introducedDay: String(r.introduced_day),
    lastReviewedDay: (r.last_graded_day as string | null) ?? null,
  };
}

/** Everything about one card: its fields, tags, star, media, schedule and the exact wrong answers given. */
export function cardDetails(d: DB, id: number, now = new Date()) {
  const r = d.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id);
  if (!r) return null;
  const item = rowToItem(r);
  const st = d.prepare('SELECT mastery, seen, right, wrong FROM item_state WHERE item_id = ?').get(id);
  const memory = memoryForecast(d, id, now);
  const wrong = d
    .prepare(
      `SELECT ts, format, given, practice FROM attempts WHERE item_id = ? AND correct = 0 ORDER BY id DESC LIMIT 20`,
    )
    .all(id)
    .map((a: Row) => ({
      at: String(a.ts),
      format: String(a.format),
      given: plainOrNull(a.given, 500),
      practice: !!a.practice,
    }));
  return {
    id,
    deckId: item.deckId,
    deck: plain(getDeck(item.deckId, d)?.name ?? item.deck, 200),
    language: item.lang,
    kind: item.kind,
    front: plain(item.target, 5000),
    back: plain(item.meaning, 5000),
    example: plainOrNull(item.sentence, 2000),
    exampleTranslation: plainOrNull(item.sentenceMeaning, 2000),
    explanation: plainOrNull(item.grammar, 5000),
    notes: plainOrNull(item.notes, 5000),
    category: plainOrNull(item.category, 100),
    tags: plainTags(item.tags),
    starred: !!r.starred,
    suspended: !!r.suspended,
    media: {
      image: plainOrNull(item.image, 300),
      imageAlt: plainOrNull(item.extra.imageAlt, 500),
      audio: plainOrNull(item.audio, 300),
      video: plainOrNull(item.video, 300),
    },
    state: !memory ? 'new' : Number(st?.mastery ?? 0) >= KNOWN_MASTERY ? 'known' : 'learning',
    mastery: Number(st?.mastery ?? 0),
    answers: { seen: Number(st?.seen ?? 0), right: Number(st?.right ?? 0), wrong: Number(st?.wrong ?? 0) },
    memory,
    wrongAnswers: wrong,
  };
}

/** Cards that are hard to keep: most lapses, then most wrong answers. Each with accuracy and recall chance. */
export function weakCards(d: DB, opts: { deckId?: number; limit?: number } = {}, now = new Date()) {
  const limit = Math.min(LIST_MAX, opts.limit ?? 30);
  const args: SqlValue[] = opts.deckId ? [opts.deckId, limit] : [limit];
  return d
    .prepare(
      `SELECT i.id, i.deck_id, i.target, i.meaning, s.lapses, s.reps, s.due, COALESCE(st.right, 0) AS right, COALESCE(st.wrong, 0) AS wrong
       FROM srs s JOIN items i ON i.id = s.item_id LEFT JOIN item_state st ON st.item_id = s.item_id
       WHERE i.suspended = 0 AND (s.lapses > 0 OR COALESCE(st.wrong, 0) > 0)${opts.deckId ? ' AND i.deck_id = ?' : ''}
       ORDER BY s.lapses DESC, COALESCE(st.wrong, 0) DESC, i.id LIMIT ?`,
    )
    .all(...args)
    .map((r: Row) => {
      const right = Number(r.right);
      const wrong = Number(r.wrong);
      return {
        id: Number(r.id),
        deckId: Number(r.deck_id),
        front: plain(r.target, 200),
        back: plain(r.meaning, 200),
        lapses: Number(r.lapses),
        wrong,
        accuracyPercent: pct(right, right + wrong),
        leech: Number(r.lapses) >= LEECH_LAPSES,
        due: String(r.due),
        recallProbabilityPercent: memoryForecast(d, Number(r.id), now)?.recallProbabilityPercent ?? null,
      };
    });
}

/** Every deck with its card, new, due and learned counts (as on the deck list), its language and goal. */
export function deckOverview(d: DB, now = new Date()) {
  const settings = getSettings(d);
  const stats = deckStats(d, now);
  return listDecks(d).map((dk) => {
    const s = stats.get(dk.id);
    const perDay = typeof dk.settings.newPerDay === 'number' ? dk.settings.newPerDay : settings.newPerDay;
    return {
      id: dk.id,
      name: plain(dk.name, 200),
      language: dk.language,
      languageName: dk.language ? (LANGUAGES[dk.language] ?? dk.language) : null,
      description: plain(dk.description, 2000),
      cards: s?.cards ?? 0,
      newCards: s?.fresh ?? 0,
      learned: s?.learned ?? 0,
      dueToday: s?.due ?? 0,
      newToday: newTodayFor(s, perDay),
      newPerDay: perDay,
      goal: dk.settings.goal ? { label: plain(dk.settings.goal.label, 100), words: dk.settings.goal.words } : null,
      examDate: dk.settings.examDate ?? null,
    };
  });
}

/** Sessions in a range, newest first: when, how long, and which exercise formats (modes and games) were used. */
export function sessionHistory(d: DB, range: Range, limit = 50) {
  const sessions = d
    .prepare(
      `SELECT id, day, started_at, finished_at, length, xp, seconds FROM sessions
       WHERE day BETWEEN ? AND ? ORDER BY started_at DESC LIMIT ?`,
    )
    .all(range.from, range.to, Math.min(LIST_MAX, limit));
  const formats = d.prepare(
    `SELECT format, COUNT(*) AS n, SUM(correct) AS ok, SUM(practice) AS practice FROM attempts WHERE session_id = ? GROUP BY format ORDER BY n DESC`,
  );
  return sessions.map((s: Row) => {
    const f = formats.all(s.id).map((r: Row) => ({
      format: String(r.format),
      answers: Number(r.n),
      correct: Number(r.ok),
    }));
    const practice = formats.all(s.id).reduce((n: number, r: Row) => n + Number(r.practice), 0);
    return {
      day: String(s.day),
      startedAt: String(s.started_at),
      finishedAt: (s.finished_at as string | null) ?? null,
      length: String(s.length),
      minutes: Math.round(Number(s.seconds) / 60),
      xp: Number(s.xp),
      practice: practice > 0,
      formats: f,
    };
  });
}

/** Streak (settled in memory, not saved), today's progress toward the daily goal, languages and settings. */
export function learnerOverview(d: DB, now = new Date()) {
  const today = dayKey(now);
  const settings = getSettings(d);
  const met = new Set(
    d
      .prepare('SELECT day FROM days WHERE goal_met = 1')
      .all()
      .map((r: Row) => String(r.day)),
  );
  const streak = settleStreak(getMeta<StreakState>(d, 'streak', NEW_STREAK), today, met);
  const t = d.prepare('SELECT xp, sessions, seconds, goal_met FROM days WHERE day = ?').get(today);
  const languages = [
    ...new Set(
      listDecks(d)
        .map((dk) => dk.language)
        .filter((l): l is string => !!l),
    ),
  ].map((code) => ({ code, name: LANGUAGES[code] ?? code }));
  const shared = Object.fromEntries(SHARED_SETTINGS.map((k) => [k, settings[k] ?? null]));
  return {
    today,
    streak: { current: streak.current, longest: streak.longest, freezesLeft: streak.freezes, repair: streak.repair },
    todayProgress: {
      sessions: Number(t?.sessions ?? 0),
      minutes: Math.round(Number(t?.seconds ?? 0) / 60),
      xp: Number(t?.xp ?? 0),
      dailyGoalSessions: settings.dailyGoalSessions,
      goalMet: !!t?.goal_met,
    },
    totalXp: Number(d.prepare('SELECT COALESCE(SUM(xp), 0) AS n FROM days').get()!.n),
    studyLanguages: languages,
    interfaceLanguage: settings.uiLanguage,
    settings: shared,
    mockExams: mockExams(d, { limit: 10 }),
  };
}

/**
 * Mock exams handed in (#43), newest first: when, which deck, the score, and the score by topic (the cards'
 * tags), weakest first. Each exam's answers are stored as attempts in a session whose id starts with "exam-";
 * the pass mark is the deck's current one, as the exam screen does not save it (nor the mode).
 */
export function mockExams(d: DB, opts: { deckId?: number; limit?: number } = {}) {
  const limit = Math.min(LIST_MAX, opts.limit ?? 20);
  const rows = d
    .prepare(
      `SELECT a.session_id, MIN(a.ts) AS at, MIN(i.deck_id) AS deck_id, COUNT(*) AS questions,
         SUM(a.correct) AS correct
       FROM attempts a JOIN items i ON i.id = a.item_id
       WHERE a.session_id LIKE 'exam-%'
       GROUP BY a.session_id
       ${opts.deckId ? 'HAVING MIN(i.deck_id) = ?' : ''}
       ORDER BY at DESC LIMIT ?`,
    )
    .all(...(opts.deckId ? [opts.deckId, limit] : [limit]));
  const answers = d.prepare(
    'SELECT a.correct, i.tags FROM attempts a JOIN items i ON i.id = a.item_id WHERE a.session_id = ?',
  );
  return rows.map((r: Row) => {
    const deck = getDeck(Number(r.deck_id), d);
    const passMark = examSettings(deck?.settings.exam).passMark;
    const questions = Number(r.questions);
    const percent = Math.round((Number(r.correct) / questions) * 100);
    const topics = new Map<string, { correct: number; total: number }>();
    for (const a of answers.all(String(r.session_id))) {
      const tags = JSON.parse(String(a.tags ?? '[]')) as string[];
      for (const topic of tags.length ? plainTags(tags) : ['']) {
        const t = topics.get(topic) ?? { correct: 0, total: 0 };
        t.total++;
        if (a.correct) t.correct++;
        topics.set(topic, t);
      }
    }
    return {
      at: String(r.at),
      deckId: Number(r.deck_id),
      deck: deck ? plain(deck.name, 200) : null,
      questions,
      correct: Number(r.correct),
      percent,
      passMark,
      passed: percent >= passMark,
      byTopic: [...topics]
        .map(([topic, t]) => ({ topic, ...t, percent: Math.round((t.correct / t.total) * 100) }))
        .sort((a, b) => a.percent - b.percent || a.topic.localeCompare(b.topic)),
    };
  });
}

/** Cards for a quiz in the chat. Reading them changes nothing: the assistant's answers are never recorded. */
export function quizCards(
  d: DB,
  opts: { deckId?: number; from: 'due' | 'weak' | 'random'; count: number },
  now = new Date(),
) {
  const count = Math.min(50, Math.max(1, opts.count));
  const deck = opts.deckId ? ' AND i.deck_id = ?' : '';
  const args: SqlValue[] = opts.deckId ? [opts.deckId] : [];
  const order =
    opts.from === 'due'
      ? `AND s.reps > 0 AND s.due <= ? ORDER BY s.due`
      : opts.from === 'weak'
        ? 'AND (s.lapses > 0 OR COALESCE(st.wrong, 0) > 0) ORDER BY s.lapses DESC, COALESCE(st.wrong, 0) DESC'
        : 'ORDER BY random()';
  const join = opts.from === 'random' ? 'LEFT JOIN' : 'JOIN';
  const rows = d
    .prepare(
      `SELECT i.id, i.target, i.meaning, dk.language FROM items i JOIN decks dk ON dk.id = i.deck_id
       ${join} srs s ON s.item_id = i.id LEFT JOIN item_state st ON st.item_id = i.id
       WHERE i.suspended = 0${deck} ${order} LIMIT ?`,
    )
    .all(...args, ...(opts.from === 'due' ? [now.toISOString()] : []), count);
  return rows.map((r: Row) => ({
    id: Number(r.id),
    front: plain(r.target, 1000),
    back: plain(r.meaning, 1000),
    language: (r.language as string | null) ?? null,
  }));
}
