// The if-then study plan (#204): "After I finish dinner, I'll study for 5 minutes", with an optional backup
// ("If I'm tired, I'll do one 5-minute session"). If-then plans help people follow through (Gollwitzer &
// Sheeran 2006). The learner's words are kept in settings as plain text; the sentence around them is a
// translated template. LernLab can also suggest the hour you usually study, from the local study log only.
import type { Row } from './host';
import type { DB } from './db';

/** The most characters kept from each part of the plan. */
export const PLAN_TEXT_MAX = 80;
/** "I'll study for ___": one of the session lengths, in minutes. */
export const PLAN_MINUTES = [5, 10, 20] as const;
export const DEFAULT_PLAN_MINUTES = 5;

export type StudyPlan = { after: string; minutes: number; backup: string };

// Control characters (line breaks become spaces first) and bidi overrides that could flip the sentence.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

/**
 * What the learner typed, as plain text: one line, no markup characters, trimmed, capped at
 * PLAN_TEXT_MAX characters, without a trailing full stop (the sentence adds its own). Anything that is
 * not a string becomes ''.
 */
export function cleanPlanText(x: unknown): string {
  if (typeof x !== 'string') return '';
  const one = x.replace(/\s+/g, ' ').replace(CONTROL, '').replace(/[<>]/g, '').trim();
  return [...one]
    .slice(0, PLAN_TEXT_MAX)
    .join('')
    .replace(/[\s.,;:!?。]+$/u, '')
    .trim();
}

/** A session length in minutes (5, 10 or 20), or 5. */
export const cleanPlanMinutes = (x: unknown): number => {
  const n = Number(x);
  return (PLAN_MINUTES as readonly number[]).includes(n) ? n : DEFAULT_PLAN_MINUTES;
};

/** The plan in saved settings, cleaned, or null when the "After I ___" part is empty. */
export function studyPlanOf(s: { planAfter?: unknown; planMinutes?: unknown; planBackup?: unknown }): StudyPlan | null {
  const after = cleanPlanText(s.planAfter);
  if (!after) return null;
  return { after, minutes: cleanPlanMinutes(s.planMinutes), backup: cleanPlanText(s.planBackup) };
}

/** At least this many sessions before LernLab guesses a usual time. */
const MIN_SESSIONS = 3;
/** The usual hour must hold at least this share of the sessions, so a scattered pattern gives no guess. */
const MIN_SHARE = 0.25;

/**
 * The local time, "HH:00", at which you most often start studying, or null when there is no clear
 * pattern. Each start is rounded to the nearest hour (18:50 and 19:10 both count as 19:00); a tie goes to
 * the earlier hour. Pure: the caller passes the start times.
 */
export function usualStudyTime(starts: readonly Date[]): string | null {
  const counts = new Array<number>(24).fill(0);
  let total = 0;
  for (const s of starts) {
    const t = s.getTime();
    if (!Number.isFinite(t)) continue;
    counts[new Date(t + 30 * 60_000).getHours()]++;
    total++;
  }
  if (total < MIN_SESSIONS) return null;
  const best = counts.indexOf(Math.max(...counts));
  if (counts[best] < Math.max(2, Math.ceil(total * MIN_SHARE))) return null;
  return `${String(best).padStart(2, '0')}:00`;
}

/** When your latest sessions started (newest first), from the local log. One small query; bad rows are skipped. */
export function recentSessionStarts(d: DB, limit = 60): Date[] {
  return d
    .prepare('SELECT started_at FROM sessions ORDER BY started_at DESC LIMIT ?')
    .all(limit)
    .map((r: Row) => new Date(String(r.started_at)))
    .filter((x: Date) => Number.isFinite(x.getTime()));
}
