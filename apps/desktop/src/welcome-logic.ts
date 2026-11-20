// What each answer on the first-run welcome leads to (issue #31). The screen is Welcome.tsx.
import type { WelcomeChoice } from '@lernlab/core/welcome';

export type Pick = Exclude<WelcomeChoice, 'skip'>;
export const PICKS: readonly Pick[] = ['language', 'subject', 'own'];

/** Where the app goes next: a 2-minute session, Home with its Start button, or the Decks import panel. */
export type Next = 'session' | 'home' | 'decks';

/**
 * Continue: a language or subject brings in its sample deck and lands on Home; "own cards" opens the import.
 * "Try a 2-minute sample": a mini session on the picked sample (the language one if "own cards" was picked).
 * Skip: nothing imported, Home (which then points at Decks).
 */
export function welcomeStep(action: 'continue' | 'sample' | 'skip', pick: Pick): { choice: WelcomeChoice; next: Next } {
  if (action === 'skip') return { choice: 'skip', next: 'home' };
  if (action === 'sample') return { choice: pick === 'own' ? 'language' : pick, next: 'session' };
  return { choice: pick, next: pick === 'own' ? 'decks' : 'home' };
}
