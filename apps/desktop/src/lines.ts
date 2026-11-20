// Turning core's teacher lines (keys, plus an optional line in the deck's language) into text.
import type { Line, Teacher } from '@lernlab/core/teacher';
import type { SessionPlan } from '@lernlab/core/types';
import type { TFunction } from 'i18next';

/** What the speech bubble shows: the main line, and a translation under it for language decks. */
export type Bubble = { main: string; gloss: string };

export function bubbleFor(line: Line, t: TFunction): Bubble {
  const text = t(line.key, line.params ?? {});
  return line.target ? { main: line.target, gloss: text } : { main: text, gloss: '' };
}

/** The teacher with every line already turned into the text to show (the main line). */
export type TextTeacher = { [K in keyof Teacher]: (...args: Parameters<Teacher[K]>) => string };

export function textTeacher(teacher: Teacher, t: TFunction): TextTeacher {
  const out: Record<string, (...args: never[]) => string> = {};
  for (const [name, fn] of Object.entries(teacher) as [string, (...args: never[]) => Line][])
    out[name] = (...args) => bubbleFor(fn(...args), t).main;
  return out as unknown as TextTeacher;
}

/** "Deck · Today: 12 reviews, 5 new cards and one lesson." in the interface language. */
export function agendaText(plan: SessionPlan, t: TFunction, language: string): string {
  const parts: string[] = [];
  if (plan.counts.due) parts.push(t('teacher.agenda.reviews', { count: plan.counts.due }));
  if (plan.counts.fresh) parts.push(t('teacher.agenda.newCards', { count: plan.counts.fresh }));
  if (plan.counts.grammar) parts.push(t('teacher.agenda.lesson'));
  if (!parts.length) parts.push(t('teacher.agenda.games'));
  const list = new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(parts);
  return plan.deckName
    ? t('teacher.agenda.todayDeck', { deck: plan.deckName, parts: list })
    : t('teacher.agenda.today', { parts: list });
}
