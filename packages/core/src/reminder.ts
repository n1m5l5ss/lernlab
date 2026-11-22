// The optional daily reminder (off by default): when it is due. Pure functions on local wall-clock time,
// so they can be tested without a clock, Electron or a database. The desktop main process asks
// `reminderDue` about once a minute and checks with the data process whether you studied today.

/** "HH:MM", 24-hour, local time. */
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DEFAULT_REMINDER_TIME = '19:00';
/** A reminder this late is not shown any more (the computer was asleep or LernLab was closed). */
export const REMINDER_GRACE_MINUTES = 60;

/** A valid "HH:MM" time, or the default. */
export const cleanReminderTime = (x: unknown): string =>
  typeof x === 'string' && TIME.test(x) ? x : DEFAULT_REMINDER_TIME;

/** The calendar date in local time, e.g. "2026-03-29": the reminder is shown at most once per date. */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The moment the reminder time falls on the local date of `now`. Built from local date parts, so it
 * follows daylight-saving changes: on the day the clocks go forward, a time inside the gap (02:30) moves
 * forward by the gap (03:30); on the day they go back, the first of the two 02:30s is used.
 */
export function reminderMoment(time: string, now: Date): Date {
  const [h, m] = cleanReminderTime(time).split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
}

/**
 * Should the reminder show now? Only when it is on, the time has come today (within the grace period),
 * and it has not been shown on this date yet. Whether you already studied today is checked separately,
 * just before showing it, because that needs the database.
 */
export function reminderDue(r: { enabled: boolean; time: string; lastShown?: string | null }, now: Date): boolean {
  if (!r.enabled || r.lastShown === localDate(now)) return false;
  const late = now.getTime() - reminderMoment(r.time, now).getTime();
  return late >= 0 && late < REMINDER_GRACE_MINUTES * 60_000;
}

/** Sleep bridge (#217, sleep.ts): when the reminder offers the morning check of last night's cards. */
export const DEFAULT_MORNING_TIME = '08:00';
/** A valid "HH:MM" time for the morning check, or the default. */
export const cleanMorningTime = (x: unknown): string =>
  typeof x === 'string' && TIME.test(x) ? x : DEFAULT_MORNING_TIME;
