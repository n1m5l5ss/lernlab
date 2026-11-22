// The if-then study plan fields (#204), shared by Welcome and Settings. The screen part is StudyPlan.tsx.
import { cleanPlanMinutes, cleanPlanText } from '@lernlab/core/studyplan';

/** What is in the three fields while you type. */
export type PlanDraft = { after: string; minutes: number; backup: string };

type SavedPlan = { planAfter: string; planMinutes: number; planBackup: string };

export const planDraftOf = (s: SavedPlan): PlanDraft => ({
  after: s.planAfter,
  minutes: s.planMinutes,
  backup: s.planBackup,
});

/** The words for the "Your daily reminder will say" preview, cleaned as they will be saved; null without a plan. */
export function planPreview(p: PlanDraft): { after: string; count: number; backup: string } | null {
  const after = cleanPlanText(p.after);
  if (!after) return null;
  return { after, count: cleanPlanMinutes(p.minutes), backup: cleanPlanText(p.backup) };
}

/** The settings to save. Welcome passes onlyIfFilled, so an empty plan there changes nothing. */
export function planPatch(p: PlanDraft, opts: { onlyIfFilled?: boolean } = {}): SavedPlan | null {
  const planAfter = cleanPlanText(p.after);
  if (opts.onlyIfFilled && !planAfter) return null;
  return { planAfter, planMinutes: cleanPlanMinutes(p.minutes), planBackup: cleanPlanText(p.backup) };
}

/** "19:00" as a time today, so it can be shown in the learner's own clock format. */
export function timeOfDay(hhmm: string, now = new Date()): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
}

/** Days before an exam in which the deck list says that sleep is part of studying (#217). */
export const EXAM_SOON_DAYS = 3;
/** Is the exam ("YYYY-MM-DD") today or within the next few days? */
export function examSoon(examDate: string | undefined, now = new Date()): boolean {
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return false;
  const [y, m, d] = examDate.split('-').map(Number);
  const days = Math.round(
    (new Date(y, m - 1, d).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  return days >= 0 && days <= EXAM_SOON_DAYS;
}
