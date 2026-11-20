// Pure rules of the session runner, kept apart from React so they can be tested.

/** How many other exercises come between a missed card and its second try. */
export const RETRY_GAP = 3;

/** Put `retry` back into the queue about RETRY_GAP exercises after position `i` (or at the end). */
export function requeue<T>(queue: T[], i: number, retry: T, gap = RETRY_GAP): T[] {
  const q = [...queue];
  q.splice(Math.min(q.length, i + 1 + gap), 0, retry);
  return q;
}

/** Under 60% right in a review block (of at least 3 answers) brings an easier rescue round. */
export const needsRescue = (r: { correct: number; total: number }) => r.total >= 3 && r.correct / r.total < 0.6;

/** Share of the current block already done, 0 to 1. */
export const blockProgress = (done: number, total: number) => (total > 0 ? Math.min(1, Math.max(0, done / total)) : 0);

/** Core's block titles ("Warm-up", "New cards") as language-file keys ("warm-up", "new-cards"). */
export const blockKey = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');
