// Core learning state: items, spaced repetition (FSRS), attempts, mastery, days.
import type { Row } from './host';
import type { ItemRow } from './schema';
import { fsrs, generatorParameters, createEmptyCard, type Card, type Grade as FsrsGrade } from 'ts-fsrs';
import { getDb, getMeta, tx, type DB } from './db';
import { gradeFor, dayKey } from './game';
import { FORMAT_LEVEL, RECALL_FORMATS, type Attempt, type Item } from './types';
import { qa } from './cards';

export type Settings = {
  deck: string;
  newPerDay: number;
  dailyGoalSessions: number;
  sessionLength: 'mini' | 'standard' | 'long';
  retention: number;
  sound: boolean;
  teacherVoice: boolean;
  /** Seconds per question in Blitz rounds (timed answering). */
  blitzSeconds?: number;
  /** Optional per-question timer for every multiple-choice/true-false question (0 = off). */
  questionTimer?: number;
  /** Interface language code from locales/ (e.g. 'en'), or the pseudo-locale 'en-XA' for testing. */
  uiLanguage: string;
};

export const DEFAULT_SETTINGS: Settings = {
  deck: 'Lang::German',
  newPerDay: 10,
  dailyGoalSessions: 1,
  sessionLength: 'standard',
  retention: 0.9,
  sound: true,
  teacherVoice: true,
  blitzSeconds: 8,
  questionTimer: 0,
  uiLanguage: 'en',
};

export const getSettings = (d: DB = getDb()): Settings => ({ ...DEFAULT_SETTINGS, ...getMeta(d, 'settings', {}) });

/** Settings that can differ per deck (new cards per day), falling back to the global ones. */
export function deckNewPerDay(deckId: number | null | undefined, d: DB = getDb()): number {
  const g = getSettings(d).newPerDay;
  if (!deckId) return g;
  const r = d.prepare('SELECT settings FROM decks WHERE id = ?').get(deckId);
  const s = r ? JSON.parse(r.settings as string) : {};
  return typeof s.newPerDay === 'number' ? s.newPerDay : g;
}

export const activeDeckId = (d: DB = getDb()): number | null => getMeta<number | null>(d, 'activeDeck', null);

const scheduler = (retention: number) =>
  fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, enable_short_term: false }));

export const ITEM_SELECT = 'SELECT i.*, dk.language AS lang FROM items i JOIN decks dk ON dk.id = i.deck_id';
const dk = (deckId?: number | null, alias = 'i') => (deckId ? ` AND ${alias}.deck_id = ${Number(deckId)}` : '');

export function rowToItem(row: Row): Item {
  const r = row as unknown as ItemRow;
  return {
    id: Number(r.id),
    deckId: Number(r.deck_id),
    lang: r.lang ?? null,
    image: r.image ?? null,
    video: r.video ?? null,
    category: r.category ?? null,
    extra: (() => {
      try {
        return JSON.parse(r.extra ?? '{}');
      } catch {
        return {};
      }
    })(),
    deck: r.deck,
    kind: r.kind as Item['kind'],
    target: r.target,
    article: r.article as Item['article'],
    word: r.word,
    meaning: r.meaning,
    sentenceHtml: r.sentence_html,
    sentence: r.sentence,
    sentenceMeaning: r.sentence_meaning,
    grammar: r.grammar,
    notes: r.notes,
    audio: r.audio,
    rank: Number(r.rank),
    tags: JSON.parse(r.tags),
    group: r.grp,
  };
}

export function introduce(itemId: number, d: DB = getDb(), now = new Date()) {
  const card = createEmptyCard(now);
  d.prepare(`INSERT OR IGNORE INTO srs(item_id, card, due, introduced_day) VALUES (?, ?, ?, ?)`).run(
    itemId,
    JSON.stringify(card),
    card.due.toISOString(),
    dayKey(now),
  );
  d.prepare(`INSERT OR IGNORE INTO item_state(item_id) VALUES (?)`).run(itemId);
}

export function recordAttempt(a: Attempt, d: DB = getDb(), now = new Date()) {
  const day = dayKey(now);
  return tx(d, () => {
    const item = d.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(a.itemId);
    if (!item) return { grade: null };
    d.prepare(`INSERT OR IGNORE INTO item_state(item_id) VALUES (?)`).run(a.itemId);

    // Intro introduces a card; so does a first attempt on a question card (a pretest – guessing first helps).
    if (a.format === 'intro' || (['mcq', 'order', 'flip'].includes(a.format) && !a.genderOnly))
      introduce(a.itemId, d, now);

    // Mastery ladder and counters
    const st = d.prepare('SELECT * FROM item_state WHERE item_id = ?').get(a.itemId)!;
    if (a.genderOnly) {
      d.prepare(
        'UPDATE item_state SET gender_seen = gender_seen + 1, gender_right = gender_right + ? WHERE item_id = ?',
      ).run(a.correct ? 1 : 0, a.itemId);
    } else if (a.format !== 'intro') {
      const lvl = FORMAT_LEVEL[a.format] ?? 0;
      const mastery = a.correct && !a.articleError ? Math.max(Number(st.mastery), lvl) : Number(st.mastery);
      let spoken: string[] = JSON.parse(st.spoken_days as string);
      if (a.format === 'speak' && a.correct && !spoken.includes(day)) spoken = [...spoken, day].slice(-10);
      d.prepare(
        `UPDATE item_state SET mastery = ?, seen = seen + 1, right = right + ?, wrong = wrong + ?,
           last_wrong_day = CASE WHEN ? THEN ? ELSE last_wrong_day END, spoken_days = ? WHERE item_id = ?`,
      ).run(mastery, a.correct ? 1 : 0, a.correct ? 0 : 1, a.correct ? 0 : 1, day, JSON.stringify(spoken), a.itemId);
      if (a.articleError) {
        d.prepare('UPDATE item_state SET gender_seen = gender_seen + 1 WHERE item_id = ?').run(a.itemId);
      } else if (item.kind === 'noun' && (a.format === 'typed' || a.format === 'boss') && a.correct) {
        d.prepare(
          'UPDATE item_state SET gender_seen = gender_seen + 1, gender_right = gender_right + 1 WHERE item_id = ?',
        ).run(a.itemId);
      }
    }

    // One spaced-repetition grade per item per day, from the first recall attempt.
    let grade: number | null = null;
    const srs = d.prepare('SELECT * FROM srs WHERE item_id = ?').get(a.itemId);
    // Sentence building counts as recall for grammar patterns (word order is the skill being tested).
    const recall = RECALL_FORMATS.includes(a.format) || (a.format === 'unscramble' && item.kind === 'grammar');
    if (srs && recall && !a.genderOnly && srs.last_graded_day !== day) {
      const answerLength = qa(rowToItem(item)).answer.length;
      grade = gradeFor({
        ...a,
        format: a.format === 'unscramble' ? 'cloze' : a.format,
        answerLength,
        reps: Number(srs.reps),
      });
      if (grade) {
        const settings = getSettings(d);
        const card: Card = reviveCard(JSON.parse(srs.card as string));
        const next = scheduler(settings.retention).next(card, now, grade as FsrsGrade).card;
        d.prepare(
          `UPDATE srs SET prev_card = card, prev_due = due, card = ?, due = ?, last_graded_day = ?, reps = reps + 1, lapses = lapses + ? WHERE item_id = ?`,
        ).run(JSON.stringify(next), next.due.toISOString(), day, grade === 1 ? 1 : 0, a.itemId);
      }
    }

    d.prepare(
      `INSERT INTO attempts(ts, day, session_id, item_id, format, correct, near_miss, article_error, used_hint,
         response_ms, given, xp, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      now.toISOString(),
      day,
      a.sessionId,
      a.itemId,
      a.genderOnly ? 'gender' : a.format,
      a.correct ? 1 : 0,
      a.nearMiss ? 1 : 0,
      a.articleError ? 1 : 0,
      a.usedHint ? 1 : 0,
      Math.round(a.responseMs),
      a.given ?? null,
      a.xp,
      grade,
    );
    d.prepare(`INSERT INTO days(day, xp) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET xp = xp + excluded.xp`).run(
      day,
      a.xp,
    );
    return { grade };
  });
}

/**
 * "I was right": the answer checker was too strict. Undo today's grade and grade the card Good instead.
 * Only works for the card's grade from today (the previous state is kept for exactly this).
 */
export function overrideToCorrect(itemId: number, d: DB = getDb(), now = new Date()) {
  const day = dayKey(now);
  return tx(d, () => {
    const srs = d.prepare('SELECT * FROM srs WHERE item_id = ?').get(itemId);
    const last = d
      .prepare('SELECT * FROM attempts WHERE item_id = ? AND day = ? AND grade IS NOT NULL ORDER BY id DESC LIMIT 1')
      .get(itemId, day);
    if (!srs || !last || srs.last_graded_day !== day || !srs.prev_card || Number(last.grade) >= 3) return { ok: false };
    const prev = reviveCard(JSON.parse(srs.prev_card as string));
    const next = scheduler(getSettings(d).retention).next(prev, now, 3 as FsrsGrade).card;
    d.prepare('UPDATE srs SET card = ?, due = ?, lapses = MAX(0, lapses - ?) WHERE item_id = ?').run(
      JSON.stringify(next),
      next.due.toISOString(),
      Number(last.grade) === 1 ? 1 : 0,
      itemId,
    );
    d.prepare('UPDATE attempts SET correct = 1, grade = 3 WHERE id = ?').run(last.id);
    d.prepare(
      'UPDATE item_state SET right = right + 1, wrong = MAX(0, wrong - 1), mastery = MAX(mastery, 3) WHERE item_id = ?',
    ).run(itemId);
    return { ok: true, due: next.due.toISOString() };
  });
}

function reviveCard(c: Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string }): Card {
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined };
}

export function allItems(d: DB = getDb(), deckId?: number | null): Item[] {
  return d
    .prepare(`${ITEM_SELECT} WHERE i.suspended = 0${dk(deckId)} ORDER BY i.ord`)
    .all()
    .map(rowToItem);
}

/** End of the current learning day (4 a.m. next morning), used as the "due" cutoff. */
export function endOfDay(now = new Date()): Date {
  const key = dayKey(now);
  const [y, m, dd] = key.split('-').map(Number);
  return new Date(y, m - 1, dd + 1, 4, 0, 0);
}

export function dueItemIds(d: DB = getDb(), now = new Date(), limit = 500, deckId?: number | null): number[] {
  return d
    .prepare(
      `SELECT s.item_id FROM srs s JOIN items i ON i.id = s.item_id
       WHERE i.suspended = 0 AND s.reps > 0 AND s.due <= ? AND (s.last_graded_day IS NULL OR s.last_graded_day != ?)${dk(deckId)}
       ORDER BY s.due LIMIT ?`,
    )
    .all(endOfDay(now).toISOString(), dayKey(now), limit)
    .map((r: Row) => Number(r.item_id));
}

/** Introduced today but not yet graded: these must be recalled before the session ends. */
export function learningTodayIds(d: DB = getDb(), now = new Date(), deckId?: number | null): number[] {
  return d
    .prepare(
      `SELECT s.item_id FROM srs s JOIN items i ON i.id = s.item_id WHERE s.reps = 0 AND s.introduced_day = ?${dk(deckId)}`,
    )
    .all(dayKey(now))
    .map((r: Row) => Number(r.item_id));
}

export function introducedTodayCount(d: DB = getDb(), now = new Date(), deckId?: number | null): number {
  return Number(
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE s.introduced_day = ?${dk(deckId)}`,
      )
      .get(dayKey(now))!.n,
  );
}

export function newItemIds(d: DB = getDb(), limit: number, kinds?: string[], deckId?: number | null): number[] {
  const kindFilter = kinds ? `AND i.kind IN (${kinds.map(() => '?').join(',')})` : `AND i.kind != 'grammar'`;
  return d
    .prepare(
      `SELECT i.id FROM items i LEFT JOIN srs s ON s.item_id = i.id
       WHERE s.item_id IS NULL AND i.suspended = 0 ${kindFilter}${dk(deckId)} ORDER BY i.ord LIMIT ?`,
    )
    .all(...(kinds ?? []), limit)
    .map((r: Row) => Number(r.id));
}

export function learnedIds(d: DB = getDb(), limit = 200, deckId?: number | null): number[] {
  return d
    .prepare(
      `SELECT s.item_id FROM srs s JOIN items i ON i.id = s.item_id WHERE i.suspended = 0${dk(deckId)}
       ORDER BY s.reps DESC, s.item_id LIMIT ?`,
    )
    .all(limit)
    .map((r: Row) => Number(r.item_id));
}

export function leechIds(d: DB = getDb(), limit = 6, deckId?: number | null): number[] {
  return d
    .prepare(
      `SELECT st.item_id FROM item_state st JOIN srs s ON s.item_id = st.item_id JOIN items i ON i.id = st.item_id
       WHERE st.wrong > 0${dk(deckId)} ORDER BY (st.wrong * 1.0 / (st.seen + 1)) DESC, s.lapses DESC LIMIT ?`,
    )
    .all(limit)
    .map((r: Row) => Number(r.item_id));
}

/** Next grammar group to teach: the first group with untaught items, at most one new group per day. */
export function nextGrammarGroup(d: DB = getDb(), now = new Date(), deckId?: number | null): string | null {
  const taughtToday = d
    .prepare(
      `SELECT COUNT(*) AS n FROM srs s JOIN items i ON i.id = s.item_id WHERE i.grp IS NOT NULL AND s.introduced_day = ?${dk(deckId)}`,
    )
    .get(dayKey(now))!.n;
  if (Number(taughtToday) > 0) return null;
  const row = d
    .prepare(
      `SELECT i.grp FROM items i LEFT JOIN srs s ON s.item_id = i.id
       WHERE i.kind = 'grammar' AND s.item_id IS NULL AND i.grp IS NOT NULL AND i.suspended = 0${dk(deckId)}
       ORDER BY i.ord LIMIT 1`,
    )
    .get();
  return row ? (row.grp as string | null) : null;
}

export function grammarItemIds(group: string, d: DB = getDb(), deckId?: number | null): number[] {
  return d
    .prepare(
      `SELECT i.id FROM items i WHERE i.grp = ? AND i.kind = 'grammar' AND i.suspended = 0${dk(deckId)} ORDER BY i.ord`,
    )
    .all(group)
    .map((r: Row) => Number(r.id));
}

export function itemsByIds(ids: number[], d: DB = getDb()): Record<number, Item> {
  if (!ids.length) return {};
  const rows = d.prepare(`${ITEM_SELECT} WHERE i.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  return Object.fromEntries(rows.map((r: Row) => [Number(r.id), rowToItem(r)]));
}

export function srsInfo(ids: number[], d: DB = getDb()): Record<number, { reps: number; mastery: number }> {
  if (!ids.length) return {};
  const rows = d
    .prepare(
      `SELECT i.id, COALESCE(s.reps, -1) AS reps, COALESCE(st.mastery, 0) AS mastery FROM items i
       LEFT JOIN srs s ON s.item_id = i.id LEFT JOIN item_state st ON st.item_id = i.id
       WHERE i.id IN (${ids.map(() => '?').join(',')})`,
    )
    .all(...ids);
  return Object.fromEntries(rows.map((r: Row) => [Number(r.id), { reps: Number(r.reps), mastery: Number(r.mastery) }]));
}
