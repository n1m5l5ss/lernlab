// The first-run welcome (issue #31): shown once, to a brand-new user only. Kept in `meta`, so no migration.
import { getMeta, setMeta, type DB } from './db';

/** What the new user picked on the welcome screen, or that they skipped it. */
export const WELCOME_CHOICES = ['language', 'subject', 'own', 'skip'] as const;
export type WelcomeChoice = (typeof WELCOME_CHOICES)[number];

type Done = { choice: WelcomeChoice; at: string };
const KEY = 'welcome';

/** The choice that finished the welcome, or null while it has not been finished or skipped. */
export const welcomeChoice = (d: DB): WelcomeChoice | null => getMeta<Done | null>(d, KEY, null)?.choice ?? null;

/**
 * Show the welcome only to someone new: not finished or skipped before, no decks, and never studied.
 * People who used the app before this screen existed have decks or study days, so they never see it.
 */
export function needsWelcome(d: DB): boolean {
  if (welcomeChoice(d)) return false;
  if (d.prepare('SELECT 1 FROM decks LIMIT 1').get()) return false;
  return !d.prepare('SELECT 1 FROM days WHERE sessions > 0 LIMIT 1').get();
}

/** Finished or skipped: never shown again. */
export function finishWelcome(choice: WelcomeChoice, d: DB, now = new Date()) {
  setMeta(d, KEY, { choice, at: now.toISOString() } satisfies Done);
}
