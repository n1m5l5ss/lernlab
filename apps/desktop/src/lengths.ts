import type { SessionLength } from '@lernlab/core/types';

/** Session lengths offered on Home and in Settings (docs/PLAN.md: 5, 10 or 20 minutes). */
export const LENGTHS: { key: SessionLength; minutes: number }[] = [
  { key: 'mini', minutes: 5 },
  { key: 'standard', minutes: 10 },
  { key: 'long', minutes: 20 },
];
