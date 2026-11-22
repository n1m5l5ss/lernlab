// Learn from your own mix-ups (#200). When a wrong answer is the answer of another card in the deck (typed, or
// picked as a wrong choice), the two cards are logged as a confusion pair. A pair's cards become each other's
// preferred wrong choice (plausible wrong choices make multiple choice almost as good as recall [Little et al.
// 2012]) and are asked next to each other (mixing helps most for look-alikes [Brunmair & Richter 2019]). After
// TWIN_AFTER mix-ups the app offers a compare card (twin.ts). Kept on this computer; logging a pair never
// changes the schedule (FSRS), the mastery ladder or XP.
import { getDb, type DB } from './db';
import type { Row } from './host';
import { clozeText } from './cards';
import { UserError } from './errors';
import { dayKey } from './game';
import { getDeck, stableId, upsertCards } from './library';
import { isMyth } from './misconceptions';
import { acceptedAnswers, normalize, stripHtml } from './text';
import { isTwin, twinSide } from './twin';
import type { Attempt, Format } from './types';

/** Mix-ups of one pair before the compare card is offered. */
export const TWIN_AFTER = 3;
/** Answers that name a card: typed ones, and the choices of recognition rounds (which never grade a card). */
const FORMATS = new Set<Format>(['typed', 'boss', 'rain', 'mc', 'listen', 'blitz']);
/** Card kinds that are a term and its answer (the ones wrong choices are made from). */
const NOT_PAIRED = new Set(['grammar', 'mcq', 'order', 'code', 'occlusion']);
/** The learner's own answer on a compare card is at most this long. */
export const ANSWER_MAX = 2000;
/** Longer answers are sentences, not another card's answer. */
const GIVEN_MAX = 200;

const extraOf = (r: Row): Record<string, string> => JSON.parse((r.extra as string | null) ?? '{}');
const ownWay = (r: Row) => {
  const extra = extraOf(r);
  return isMyth({ extra }) || isTwin({ extra }) || !!extra.keyPoints;
};
const front = (r: Row) => (r.kind === 'cloze' ? clozeText(stripHtml(String(r.target))) : stripHtml(String(r.target)));
/** Everything that counts as naming this card: its front, back, their alternatives and its sentence's meaning. */
const names = (r: Row): Set<string> =>
  new Set(
    [
      front(r),
      ...acceptedAnswers(String(r.target)),
      ...acceptedAnswers(String(r.meaning)),
      ...(extraOf(r).alt ?? '').split('|'),
      String(r.sentence_meaning ?? ''),
    ]
      .map(normalize)
      .filter(Boolean),
  );

/**
 * A wrong answer was given to `item`: when it names exactly another card of the deck, count the pair.
 * Called for every logged answer, practice included.
 */
export function noteConfusion(d: DB, item: Row, a: Attempt, now: Date): void {
  const given = normalize(a.given ?? '');
  if (a.correct || a.genderOnly || !FORMATS.has(a.format) || !given || given.length > GIVEN_MAX) return;
  if (ownWay(item) || names(item).has(given)) return;
  // Only cards that hold the answer's longest plain run of letters are read in full (large decks stay quick).
  const needle = (given.match(/[a-z0-9]{2,}/g) ?? []).sort((x, y) => y.length - x.length)[0] ?? '';
  const rows = d
    .prepare(
      `SELECT id, kind, target, meaning, sentence_meaning, extra FROM items WHERE deck_id = ? AND id != ?
         AND (? = '' OR instr(lower(target), ?) OR instr(lower(meaning), ?) OR instr(lower(sentence_meaning), ?)
           OR instr(lower(COALESCE(extra, '')), ?))
       ORDER BY id LIMIT 2000`,
    )
    .all(item.deck_id as number, a.itemId, needle, needle, needle, needle, needle);
  const other = rows.find((r) => !NOT_PAIRED.has(String(r.kind)) && !ownWay(r) && names(r).has(given));
  if (!other) return;
  const [x, y] = [a.itemId, Number(other.id)].sort((m, n) => m - n);
  d.prepare(
    `INSERT INTO confusions(a, b, count, last_day) VALUES (?, ?, 1, ?)
     ON CONFLICT(a, b) DO UPDATE SET count = count + 1, last_day = excluded.last_day`,
  ).run(x, y, dayKey(now));
}

/** For each card, the cards it was mixed up with, the most often first. */
export function confusionMap(d: DB = getDb()): Map<number, number[]> {
  const map = new Map<number, number[]>();
  const add = (k: number, v: number) => void (map.get(k)?.push(v) ?? map.set(k, [v]));
  for (const r of d.prepare('SELECT a, b FROM confusions ORDER BY count DESC, last_day DESC LIMIT 5000').all()) {
    add(Number(r.a), Number(r.b));
    add(Number(r.b), Number(r.a));
  }
  return map;
}

/** The same cards with each mixed-up card moved right after its partner; everything else keeps its order. */
export function keepClose(ids: number[], partners: Map<number, number[]>): number[] {
  const left = new Set(ids);
  const out: number[] = [];
  for (const id of ids) {
    if (!left.delete(id)) continue;
    out.push(id);
    const p = (partners.get(id) ?? []).find((x) => left.has(x));
    if (p !== undefined && left.delete(p)) out.push(p);
  }
  return out;
}

type Side = { id: number; front: string; back: string };
const side = (d: DB, id: number): Side | null => {
  const r = d.prepare('SELECT id, kind, target, meaning FROM items WHERE id = ?').get(id);
  return r ? { id, front: front(r), back: stripHtml(String(r.meaning)) } : null;
};

/** The pair to offer a compare card for: the one mixed up most (at least TWIN_AFTER times), not offered before. */
export function twinOffer(d: DB = getDb()): { a: Side; b: Side; count: number } | null {
  const r = d
    .prepare(`SELECT a, b, count FROM confusions WHERE count >= ? AND twin = '' ORDER BY count DESC, last_day DESC`)
    .get(TWIN_AFTER);
  const [a, b] = r ? [side(d, Number(r.a)), side(d, Number(r.b))] : [null, null];
  return r && a && b ? { a, b, count: Number(r.count) } : null;
}

const pairOf = (d: DB, x: number, y: number) => {
  const [a, b] = [x, y].sort((m, n) => m - n);
  const row = d.prepare('SELECT twin FROM confusions WHERE a = ? AND b = ?').get(a, b);
  return row ? { a, b, twin: String(row.twin) } : null;
};

/** "Not now": this pair is not offered again. */
export function dismissTwin(x: number, y: number, d: DB = getDb()) {
  const p = pairOf(d, x, y);
  if (p && !p.twin) d.prepare(`UPDATE confusions SET twin = 'dismissed' WHERE a = ? AND b = ?`).run(p.a, p.b);
  return { ok: true };
}

/**
 * Add the compare card for a pair to the first card's deck: both cards side by side, with the learner's own
 * answer (what they share, the key difference) as its back. One card per pair: asking again returns it.
 */
export function makeTwin(x: number, y: number, answer: string, d: DB = getDb()): { id: number } {
  const p = pairOf(d, x, y);
  const [a, b] = p ? [side(d, p.a), side(d, p.b)] : [null, null];
  const row = p && d.prepare('SELECT deck_id, deck FROM items WHERE id = ?').get(p.a);
  const deck = row && getDeck(Number(row.deck_id), d);
  if (!p || !a || !b || !deck) throw new UserError('invalid_input', 'These two cards were not mixed up');
  const sourceId = `twin-${p.a}-${p.b}`;
  const id = stableId(`${deck.name}\u0000${sourceId}`);
  if (p.twin === 'made' && d.prepare('SELECT 1 FROM items WHERE id = ?').get(id)) return { id };
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  upsertCards(
    deck,
    [
      {
        sourceId,
        type: 'twin',
        front: escape(twinSide(a.front, a.back)),
        twin: twinSide(b.front, b.back),
        back: escape(answer.slice(0, ANSWER_MAX)),
        subdeck: String(row!.deck),
      },
    ],
    d,
  );
  d.prepare(`UPDATE confusions SET twin = 'made' WHERE a = ? AND b = ?`).run(p.a, p.b);
  return { id };
}
