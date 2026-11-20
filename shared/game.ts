// Game rules: XP, levels, SRS grade mapping. Pure functions so the client can show results instantly
// and the server can apply the same rules.
import { RECALL_FORMATS, type Format } from './types';

export const XP_WEIGHT: Record<Format, number> = {
  intro: 0.3,
  mc: 0.5,
  match: 0.5,
  listen: 0.8,
  gender: 0.3,
  unscramble: 1,
  cloze: 1.2,
  dictation: 1.2,
  typed: 1.5,
  rain: 1,
  boss: 1.5,
  speak: 2,
  flip: 1.2,
  truefalse: 0.4,
  blitz: 0.5,
  mcq: 1.5,
  order: 1.5,
};

/** XP for one answer. Errors never cost XP; combos add a little (capped). */
export function xpFor(format: Format, correct: boolean, combo: number): number {
  if (!correct) return 1; // showing up still counts a little
  const base = Math.round(10 * XP_WEIGHT[format]);
  // Timed arcade rounds pay a flat rate: speed-tapping must never out-earn real recall.
  if (format === 'gender' || format === 'rain' || format === 'match' || format === 'truefalse' || format === 'blitz') return base;
  const comboBonus = Math.min(10, Math.max(0, combo - 1) * 2);
  return base + comboBonus;
}

export const BONUS = { perfectBlock: 20, dailyGoal: 25, bossWin: 30 };

/** Level n needs 100·n^1.5 cumulative XP: early levels come fast, later ones roughly weekly. */
export function levelFor(totalXp: number): { level: number; into: number; span: number } {
  let level = 0;
  while (100 * Math.pow(level + 1, 1.5) <= totalXp) level++;
  const floor = level === 0 ? 0 : 100 * Math.pow(level, 1.5);
  const next = 100 * Math.pow(level + 1, 1.5);
  return { level: level + 1, into: Math.round(totalXp - floor), span: Math.round(next - floor) };
}

/** FSRS grades: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Grade = 1 | 2 | 3 | 4;

/**
 * Map the FIRST recall attempt of the day on an item to an FSRS grade.
 * Wrong → Again. Right with a hint, typo, umlaut or article slip → Hard. Right → Good.
 * Easy only for fast answers on production formats for items already reviewed before.
 */
export function gradeFor(a: {
  format: Format;
  correct: boolean;
  nearMiss?: boolean;
  articleError?: boolean;
  usedHint?: boolean;
  responseMs: number;
  answerLength: number;
  reps: number;
}): Grade | null {
  if (!RECALL_FORMATS.includes(a.format)) return null;
  if (a.articleError) return 2;
  if (!a.correct) return 1;
  if (a.usedHint || a.nearMiss) return 2;
  const fastMs = 2500 + 150 * a.answerLength;
  if ((a.format === 'typed' || a.format === 'speak') && a.reps >= 2 && a.responseMs < fastMs) return 4;
  return 3;
}

/** The learning day starts at 4 a.m. local time, so a late-night session counts for the day before. */
export function dayKey(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() - 4 * 3600 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export type StreakState = {
  current: number;
  longest: number;
  freezes: number;
  lastCountedDay: string | null;
  lastSettledDay: string | null;
  frozenDays: string[];
  repair: { value: number; deadline: string; sessionsDone: number } | null;
};

export const NEW_STREAK: StreakState = {
  current: 0,
  longest: 0,
  freezes: 2,
  lastCountedDay: null,
  lastSettledDay: null,
  frozenDays: [],
  repair: null,
};

/**
 * Walk through every fully-past day since the last settle. A missed day uses a freeze silently;
 * with no freeze left, the streak breaks but can be repaired with 2 sessions within 2 days.
 */
export function settleStreak(s: StreakState, today: string, metDays: Set<string>): StreakState {
  const st: StreakState = { ...s, frozenDays: [...s.frozenDays], repair: s.repair ? { ...s.repair } : null };
  const yesterday = addDays(today, -1);
  let d = st.lastSettledDay ? addDays(st.lastSettledDay, 1) : yesterday;
  if (!st.lastSettledDay && !st.lastCountedDay) {
    st.lastSettledDay = yesterday;
    return st;
  }
  while (daysBetween(d, yesterday) >= 0) {
    const met = metDays.has(d) || d === st.lastCountedDay;
    if (!met && st.current > 0) {
      if (st.freezes > 0) {
        st.freezes -= 1;
        st.frozenDays.push(d);
      } else {
        st.repair = { value: st.current, deadline: addDays(d, 2), sessionsDone: 0 };
        st.current = 0;
      }
    }
    d = addDays(d, 1);
  }
  st.lastSettledDay = yesterday;
  if (st.repair && daysBetween(st.repair.deadline, today) > 0) st.repair = null;
  return st;
}

/** Called when a session finishes. Counts today once the daily goal is met; handles repair quests. */
export function recordSession(s: StreakState, today: string, goalMetNow: boolean): StreakState {
  const st: StreakState = { ...s, frozenDays: [...s.frozenDays], repair: s.repair ? { ...s.repair } : null };
  if (st.repair && daysBetween(today, st.repair.deadline) >= 0) {
    st.repair.sessionsDone += 1;
    if (st.repair.sessionsDone >= 2) {
      st.current = st.repair.value + st.current;
      st.repair = null;
    }
  }
  if (goalMetNow && st.lastCountedDay !== today) {
    st.current += 1;
    st.lastCountedDay = today;
    if (st.current > 0 && st.current % 7 === 0) st.freezes = Math.min(3, st.freezes + 1);
  }
  st.longest = Math.max(st.longest, st.current);
  return st;
}
