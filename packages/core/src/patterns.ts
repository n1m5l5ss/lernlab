// Pattern feedback (#213): the session summary says how the session went, not only the score. A few lines are
// worked out from the session's own answers on this computer: misses that were mix-ups between two cards, a tag
// that holds most of the misses, misses you were sure of, misses answered very fast, hints, and cards recalled
// after a miss. Each line is about the cards and the strategy, never about the learner, and at most one next
// step is suggested. Reading the patterns changes nothing: no schedule, no mastery, no XP.
import { getDb, type DB } from './db';
import { confusedWith } from './confusions';
import { ARCADE_FORMATS } from './game';
import { RECALL_FORMATS, type Format } from './types';

export const PATTERNS = {
  /** Most lines shown. */
  maxLines: 3,
  minMixups: 2,
  /** A tag is named from this many missed cards, when it holds at least half of all missed cards. */
  minTagMisses: 3,
  minConfident: 2,
  /** A wrong answer given faster than this (ms) was probably not read to the end. */
  fastMs: 1500,
  minFast: 3,
  /** Hints are named when used on at least this share of the answers that offer one, from `minHintAnswers` up. */
  hintShare: 0.4,
  minHintAnswers: 5,
  minComebacks: 2,
} as const;

/** One answer of the session, in the order given. */
export type PatternAnswer = {
  itemId: number;
  format: Format;
  correct: boolean;
  usedHint: boolean;
  responseMs: number;
  /** "How sure were you?" (1–5, #205), or null when it was not asked. */
  confidence: number | null;
  tags: string[];
  /** The wrong answer was exactly another card's answer (#200). */
  mixup: boolean;
};

export type Pattern =
  | { kind: 'mixups'; count: number }
  | { kind: 'tag'; tag: string; missed: number; cards: number }
  | { kind: 'confident'; count: number }
  | { kind: 'fast'; count: number }
  | { kind: 'hints'; used: number; answers: number }
  | { kind: 'comeback'; count: number };
/** `next`: the kind of the one line whose next step is suggested, or null. */
export type SessionPatterns = { lines: Pattern[]; next: Exclude<Pattern['kind'], 'comeback'> | null };

/** Formats that offer a hint. */
const HINTED: Format[] = ['typed', 'cloze'];
/** Answered in one go, so a very fast wrong answer means something (a flip is rated after reading; games are timed). */
const paced = (f: Format) => f !== 'flip' && f !== 'intro' && !ARCADE_FORMATS.includes(f);

/** The patterns in one session's answers, the most useful first. Pure. */
export function sessionPatterns(answers: PatternAnswer[]): SessionPatterns {
  const rows = answers.filter((a) => a.format !== 'intro');
  const misses = rows.filter((a) => !a.correct);
  const out: Pattern[] = [];

  const mixups = misses.filter((a) => a.mixup).length;
  if (mixups >= PATTERNS.minMixups) out.push({ kind: 'mixups', count: mixups });

  // The tag that holds most of the missed cards, unless every card of the session has it.
  const cards = new Set(rows.map((a) => a.itemId));
  const missed = new Set(misses.map((a) => a.itemId));
  const withTag = new Map<string, Set<number>>();
  for (const a of rows)
    for (const tag of a.tags) (withTag.get(tag) ?? withTag.set(tag, new Set()).get(tag)!).add(a.itemId);
  const top = [...withTag]
    .map(([tag, ids]) => ({ tag, cards: ids.size, missed: [...ids].filter((id) => missed.has(id)).length }))
    .filter((t) => t.missed >= PATTERNS.minTagMisses && t.missed * 2 >= missed.size && t.cards < cards.size)
    .sort((a, b) => b.missed - a.missed || a.tag.localeCompare(b.tag))[0];
  if (top) out.push({ kind: 'tag', ...top });

  const confident = misses.filter((a) => (a.confidence ?? 0) >= 4).length;
  if (confident >= PATTERNS.minConfident) out.push({ kind: 'confident', count: confident });

  const fast = misses.filter((a) => paced(a.format) && a.responseMs < PATTERNS.fastMs).length;
  if (fast >= PATTERNS.minFast) out.push({ kind: 'fast', count: fast });

  const hinted = rows.filter((a) => HINTED.includes(a.format));
  const used = hinted.filter((a) => a.usedHint).length;
  if (hinted.length >= PATTERNS.minHintAnswers && used / hinted.length >= PATTERNS.hintShare)
    out.push({ kind: 'hints', used, answers: hinted.length });

  // Effort: a card missed, then recalled from memory later in the same session.
  const slipped = new Set<number>();
  const back = new Set<number>();
  for (const a of rows) {
    if (!a.correct) slipped.add(a.itemId);
    else if (slipped.has(a.itemId) && RECALL_FORMATS.includes(a.format)) back.add(a.itemId);
  }
  if (back.size >= PATTERNS.minComebacks) out.push({ kind: 'comeback', count: back.size });

  const lines = out.slice(0, PATTERNS.maxLines);
  const first = lines.find((l) => l.kind !== 'comeback');
  return { lines, next: first ? (first.kind as SessionPatterns['next']) : null };
}

/** The patterns of one recorded session, from its answers. Reads only. */
export function patternsOf(sessionId: string, d: DB = getDb()): SessionPatterns {
  const rows = d
    .prepare(
      `SELECT a.item_id, a.format, a.correct, a.used_hint, a.response_ms, a.given, a.confidence,
              i.deck_id, i.kind, i.target, i.meaning, i.sentence_meaning, i.extra, i.tags
       FROM attempts a JOIN items i ON i.id = a.item_id WHERE a.session_id = ? ORDER BY a.id LIMIT 2000`,
    )
    .all(sessionId);
  return sessionPatterns(
    rows.map((r) => {
      const a = {
        itemId: Number(r.item_id),
        format: r.format as Format,
        correct: !!r.correct,
        given: (r.given as string | null) ?? undefined,
      };
      let tags: string[] = [];
      try {
        const parsed: unknown = JSON.parse(String(r.tags ?? '[]'));
        if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string');
      } catch {
        /* a card without readable tags has none */
      }
      return {
        ...a,
        usedHint: !!r.used_hint,
        responseMs: Number(r.response_ms),
        confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
        tags,
        mixup: !a.correct && confusedWith(d, r, a) !== null,
      };
    }),
  );
}
