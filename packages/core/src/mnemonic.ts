// Fading mnemonics (#221): a card can hold a mnemonic, the learner's own memory aid. It is support, not the
// way to learn the card: keyword mnemonics are rated low utility and their benefit fades over time [Dunlosky
// et al. 2013; Wang et al. 1992]. So it is never shown before a recall attempt. It shows by itself after a
// miss, and on the answers that follow until the card has been recalled twice in a row; a learner can also
// ask for it as a hint. Showing it changes nothing about the grade or the schedule.
// Stored in the card's extra fields as plain text (no migration); CSV and .lernpack carry it as `mnemonic`.
import { correctionHtml } from './misconceptions';
import { getDb, type DB } from './db';
import { stripHtml } from './text';
import { RECALL_FORMATS, type Format, type Item } from './types';

/** A mnemonic is at most this long (deck files are untrusted). */
export const MNEMONIC_MAX_LENGTH = 300;
/** After this many correct recalls in a row the mnemonic no longer shows by itself. */
export const MNEMONIC_FADES_AFTER = 2;

/** The mnemonic as stored: plain text that stays the same when read again. */
export function cleanMnemonic(text: string | undefined): string {
  let s = stripHtml(text ?? '');
  for (let next = stripHtml(s); next !== s; next = stripHtml(s)) s = next;
  return stripHtml(s.slice(0, MNEMONIC_MAX_LENGTH));
}

export const mnemonicOf = (item: Pick<Item, 'extra'>): string => item.extra?.mnemonic ?? '';

/** A mnemonic as safe HTML to show: its text escaped, with **bold**, *italic* and `code`. */
export const mnemonicHtml = correctionHtml;

/**
 * A card's run: its correct recalls in a row since its last miss, or undefined while it was never missed.
 * After an answer the run is one longer, or 0 after a miss. Games and recognition rounds don't count.
 */
export function nextRun(run: number | undefined, format: Format, correct: boolean): number | undefined {
  if (!RECALL_FORMATS.includes(format)) return run;
  return correct ? (run === undefined ? undefined : run + 1) : 0;
}

/**
 * Does the mnemonic show now? Only once an answer is given or shown (`attempted`), or when the learner asked
 * for a hint; and by itself only while the card was missed and not yet recalled twice in a row since.
 */
export function showsMnemonic(
  item: Pick<Item, 'extra'>,
  run: number | undefined,
  now: { attempted: boolean; asked?: boolean },
): boolean {
  if (!mnemonicOf(item)) return false;
  if (now.asked) return true;
  return now.attempted && run !== undefined && run < MNEMONIC_FADES_AFTER;
}

/** Add each card's run to the cards that have a mnemonic (one query, and none for decks without mnemonics). */
export function withMnemonicRuns<T extends Item>(items: T[], d: DB = getDb()): T[] {
  const cards = items.filter((i) => mnemonicOf(i));
  const formats = RECALL_FORMATS.map((f) => `'${f}'`).join(',');
  for (let at = 0; at < cards.length; at += 500) {
    const part = cards.slice(at, at + 500);
    const rows = d
      .prepare(
        `WITH miss AS (
           SELECT item_id, MAX(id) AS last FROM attempts
           WHERE correct = 0 AND format IN (${formats}) AND item_id IN (${part.map(() => '?').join(',')})
           GROUP BY item_id)
         SELECT m.item_id AS id,
           (SELECT COUNT(*) FROM attempts a
            WHERE a.item_id = m.item_id AND a.id > m.last AND a.correct = 1 AND a.format IN (${formats})) AS run
         FROM miss m`,
      )
      .all(...part.map((i) => i.id));
    const runs = new Map(rows.map((r) => [Number(r.id), Number(r.run)]));
    for (const i of part) if (runs.has(i.id)) i.mnemonicRun = runs.get(i.id);
  }
  return items;
}
