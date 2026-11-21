// Pure rules of the session runner, kept apart from React so they can be tested.

/** How many other exercises come between a missed card and its next try (picked at random in this range). */
export const RETRY_GAP = { min: 4, max: 6 };
/** Correct recalls a new card needs in its first session before it counts as introduced. */
export const NEW_CARD_RECALLS = 2;
/** Most extra showings of one card in one session, so a hard card can't trap the learner. */
export const MAX_REPEATS = 3;

/** What an answered exercise was: meeting a new card, a real recall attempt, or anything else (recognition, games). */
export type AnswerKind = 'meet' | 'recall' | 'other';
type Track = { need: number; repeats: number; dueAt: number | null; missed: boolean };

/**
 * Successive relearning inside one session. A missed card comes back after 4–6 other exercises until it is
 * recalled once; a new card comes back until it has NEW_CARD_RECALLS correct recalls. Once a card meets its
 * target it is not brought back again, and no card is brought back more than MAX_REPEATS times.
 * The runner shows these extra showings as practice: only the first recall of the day changes the schedule.
 */
export class Relearn {
  /** Exercises answered so far in the session. */
  private step = 0;
  private cards = new Map<number, Track>();

  constructor(private rand: () => number = Math.random) {}

  private gap() {
    return RETRY_GAP.min + Math.floor(this.rand() * (RETRY_GAP.max - RETRY_GAP.min + 1));
  }

  /** One exercise was answered. `fresh`: a recall of a card met for the first time in this session. */
  answered(itemId: number, kind: AnswerKind, correct: boolean, { fresh = false }: { fresh?: boolean } = {}) {
    this.step++;
    let c = this.cards.get(itemId);
    if (kind === 'meet') {
      if (!c)
        this.cards.set(itemId, { need: NEW_CARD_RECALLS, repeats: 0, dueAt: this.step + this.gap(), missed: false });
      return;
    }
    if (kind !== 'recall') return;
    if (!c) {
      if (correct && !fresh) return; // known and recalled: nothing to relearn
      c = { need: fresh ? NEW_CARD_RECALLS : 0, repeats: 0, dueAt: null, missed: false };
      this.cards.set(itemId, c);
    }
    c.need = correct ? Math.max(0, c.need - 1) : Math.max(1, c.need);
    c.missed = !correct;
    c.dueAt = c.need > 0 && c.repeats < MAX_REPEATS ? this.step + this.gap() : null;
  }

  /** `n` answers in a game or another block that can't bring cards back: they still space the cards out. */
  skip(n: number) {
    this.step += Math.max(0, n);
  }

  /**
   * The card to bring back now, if any: the one waiting longest whose gap has passed. `planned` counts the
   * recalls of a card still ahead in the session plan: a card waits for them when they cover what it needs.
   * When the session is `ending`, a card whose last recall was wrong comes back early, but never straight after
   * itself (`last`); unmet new-card targets are let go.
   */
  due(planned: (itemId: number) => number = () => 0, end?: { ending: boolean; last: number }): number | null {
    let best: number | null = null;
    let at = Infinity;
    for (const [id, c] of this.cards) {
      if (c.dueAt === null || planned(id) >= c.need) continue;
      const ready = c.dueAt <= this.step || (end?.ending && c.missed && id !== end.last);
      if (ready && c.dueAt < at) {
        best = id;
        at = c.dueAt;
      }
    }
    return best;
  }

  /** The card was put back in front of the learner. */
  shown(itemId: number) {
    const c = this.cards.get(itemId);
    if (!c) return;
    c.repeats++;
    c.dueAt = null;
  }
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

type Playable = { type: string; itemId?: number };
/** Drop listening and dictation exercises the computer can't play (no recording and no voice for the language). */
export function playableOnly<T extends Playable>(exercises: T[], canHear: (itemId: number) => boolean): T[] {
  return exercises.filter((e) => !(e.type === 'listen' || e.type === 'dictation') || canHear(e.itemId ?? 0));
}

/** Exercise types that are real recall attempts (they can grade a card; recognition and games never do). */
const RECALL_TYPES = new Set(['typed', 'cloze', 'flip', 'mcq', 'order']);
export const answerKind = (type: string): AnswerKind =>
  type === 'intro' ? 'meet' : RECALL_TYPES.has(type) ? 'recall' : 'other';

/** How many recall exercises each card still has in these exercises. */
export function plannedRecalls(exercises: Playable[]): Map<number, number> {
  const n = new Map<number, number>();
  for (const e of exercises)
    if (e.itemId !== undefined && answerKind(e.type) === 'recall') n.set(e.itemId, (n.get(e.itemId) ?? 0) + 1);
  return n;
}

type RepeatCtx<A> = {
  timer: number;
  answer: (a: A) => number;
  override: (itemId: number, practice?: boolean) => void;
};
/**
 * The context for a card brought back: its answers are practice (they never grade the card a second time
 * today, and "I was right" leaves the real grade alone), and it is never timed.
 */
export function asRepeat<A extends { practice?: boolean }, C extends RepeatCtx<A>>(ctx: C): C {
  return {
    ...ctx,
    timer: 0,
    answer: (a: A) => ctx.answer({ ...a, practice: true }),
    override: (itemId: number) => ctx.override(itemId, true),
  };
}
