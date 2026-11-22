// Study together (#224): two people take turns on one deck. Each has their own session plan, from their own
// schedule; a turn is one round (60–90 s) of the person whose turn it is. Nothing here compares the two.
import type { SessionPlan } from '@lernlab/core/types';
import type { SessionResult } from './Session';

/** One turn: a learner (null is this computer's first learner) and a plan holding just that round. */
export type Turn = { learner: string | null; plan: SessionPlan };

/**
 * The turns of a session: the two plans' rounds in alternation, the first learner first. When one plan has
 * more rounds, its extra rounds follow one by one, so nobody's due cards are left out.
 */
export function turnsOf(mine: SessionPlan, theirs: SessionPlan, partner: string): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < Math.max(mine.blocks.length, theirs.blocks.length); i++) {
    if (mine.blocks[i]) turns.push({ learner: null, plan: { ...mine, blocks: [mine.blocks[i]] } });
    if (theirs.blocks[i]) turns.push({ learner: partner, plan: { ...theirs, blocks: [theirs.blocks[i]] } });
  }
  return turns;
}

/** What session.finish needs for one learner. */
export type FinishBody = Pick<
  SessionResult,
  | 'sessionId'
  | 'length'
  | 'seconds'
  | 'answers'
  | 'correct'
  | 'bossWon'
  | 'bestGenderCombo'
  | 'perfectBlocks'
  | 'startedAt'
>;

/** One learner's turns so far as one session: times and answers added up, the earliest start. */
export function addTurn(total: FinishBody | undefined, r: SessionResult): FinishBody {
  return {
    sessionId: r.sessionId,
    length: r.length,
    seconds: (total?.seconds ?? 0) + r.seconds,
    answers: (total?.answers ?? 0) + r.answers,
    correct: (total?.correct ?? 0) + r.correct,
    bossWon: r.bossWon ?? total?.bossWon ?? null,
    bestGenderCombo: Math.max(total?.bestGenderCombo ?? 0, r.bestGenderCombo),
    perfectBlocks: (total?.perfectBlocks ?? 0) + r.perfectBlocks,
    startedAt: total?.startedAt ?? r.startedAt,
  };
}
