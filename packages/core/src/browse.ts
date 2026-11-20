// Card browser: find cards across decks and change many at once.
import type { Row } from './host';
import { getDb, tx, type DB } from './db';
import { getDeck } from './library';
import { stripHtml } from './text';
import { UserError } from './errors';

/** Mastery from which a card counts as known (the same line progress uses). */
export const KNOWN_MASTERY = 3;
/** The browser lists at most this many matches; narrow the search to see the rest. */
export const MAX_ROWS = 20_000;
const SNIPPET = 120;

export type CardState = 'new' | 'learning' | 'known' | 'suspended' | 'starred';
export const CARD_STATES: CardState[] = ['new', 'learning', 'known', 'suspended', 'starred'];

export type CardFilter = { deckId?: number | null; q?: string; tag?: string; state?: CardState };

/** One light row per card: enough to show and select it; the editor loads the full card. */
export type CardRow = {
  id: number;
  deckId: number;
  front: string;
  back: string;
  tags: string[];
  state: 'new' | 'learning' | 'known';
  suspended: boolean;
  starred: boolean;
  image: boolean;
  audio: boolean;
  video: boolean;
};

export type BulkAction =
  | { kind: 'tag'; tag: string }
  | { kind: 'untag'; tag: string }
  | { kind: 'move'; deckId: number }
  | { kind: 'suspend' }
  | { kind: 'unsuspend' }
  | { kind: 'star' }
  | { kind: 'unstar' }
  | { kind: 'delete' };

const STATE_SQL: Record<CardState, string> = {
  new: 's.item_id IS NULL',
  learning: `s.item_id IS NOT NULL AND COALESCE(st.mastery, 0) < ${KNOWN_MASTERY}`,
  known: `s.item_id IS NOT NULL AND COALESCE(st.mastery, 0) >= ${KNOWN_MASTERY}`,
  suspended: 'i.suspended = 1',
  starred: 'i.starred = 1',
};

/** Cards matching every given filter, in deck order. Text is plain and shortened. */
export function findCards(f: CardFilter, d: DB = getDb()): { total: number; rows: CardRow[] } {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.deckId) {
    where.push('i.deck_id = ?');
    args.push(f.deckId);
  }
  const q = f.q?.trim();
  if (q) {
    where.push('(i.target LIKE ? OR i.meaning LIKE ? OR i.tags LIKE ? OR i.sentence LIKE ?)');
    args.push(...Array<string>(4).fill(`%${q}%`));
  }
  const tag = f.tag?.trim();
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(i.tags) WHERE lower(value) = lower(?))');
    args.push(tag);
  }
  if (f.state) where.push(STATE_SQL[f.state]);
  const from = `FROM items i LEFT JOIN srs s ON s.item_id = i.id LEFT JOIN item_state st ON st.item_id = i.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const total = Number(d.prepare(`SELECT COUNT(*) AS n ${from}`).get(...args)!.n);
  const rows = d
    .prepare(
      `SELECT i.id, i.deck_id, i.target, i.meaning, i.tags, i.suspended, i.starred, i.image, i.audio, i.video,
        s.item_id AS scheduled, st.mastery ${from} ORDER BY i.deck_id, i.ord LIMIT ${MAX_ROWS}`,
    )
    .all(...args)
    .map(toRow);
  return { total, rows };
}

function toRow(r: Row): CardRow {
  const text = (html: unknown) => stripHtml(String(html ?? '')).slice(0, SNIPPET);
  return {
    id: Number(r.id),
    deckId: Number(r.deck_id),
    front: text(r.target),
    back: text(r.meaning),
    tags: JSON.parse(String(r.tags)) as string[],
    state: r.scheduled == null ? 'new' : Number(r.mastery ?? 0) >= KNOWN_MASTERY ? 'known' : 'learning',
    suspended: !!r.suspended,
    starred: !!r.starred,
    image: !!r.image,
    audio: !!r.audio,
    video: !!r.video,
  };
}

/** Apply one change to many cards in one transaction. Returns how many cards it touched. */
export function bulkCards(ids: number[], action: BulkAction, d: DB = getDb()): number {
  const target = action.kind === 'move' ? getDeck(action.deckId, d) : null;
  if (action.kind === 'move' && !target) throw new UserError('deck_not_found', 'Deck not found');
  return tx(d, () => {
    let n = 0;
    const get = d.prepare('SELECT id, tags FROM items WHERE id = ?');
    const setTags = d.prepare('UPDATE items SET tags = ?, updated_at = ? WHERE id = ?');
    const flag = (col: 'suspended' | 'starred', on: boolean) =>
      d.prepare(`UPDATE items SET ${col} = ${on ? 1 : 0} WHERE id = ?`);
    const now = new Date().toISOString();
    const simple = {
      suspend: flag('suspended', true),
      unsuspend: flag('suspended', false),
      star: flag('starred', true),
      unstar: flag('starred', false),
    };
    for (const id of ids) {
      const row = get.get(id);
      if (!row) continue;
      n++;
      if (action.kind === 'tag' || action.kind === 'untag') {
        const want = action.tag.trim();
        const tags = JSON.parse(String(row.tags)) as string[];
        const has = (t: string) => t.toLowerCase() === want.toLowerCase();
        const next =
          action.kind === 'untag' ? tags.filter((t) => !has(t)) : tags.some(has) || !want ? tags : [...tags, want];
        if (next !== tags) setTags.run(JSON.stringify(next), now, id);
      } else if (action.kind === 'move') {
        d.prepare('UPDATE items SET deck_id = ?, deck = ?, updated_at = ? WHERE id = ?').run(
          target!.id,
          target!.name,
          now,
          id,
        );
      } else if (action.kind === 'delete') {
        for (const t of ['srs', 'item_state']) d.prepare(`DELETE FROM ${t} WHERE item_id = ?`).run(id);
        d.prepare('DELETE FROM items WHERE id = ?').run(id);
      } else simple[action.kind].run(id);
    }
    return n;
  });
}
