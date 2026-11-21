// Image occlusion (#44): boxes drawn over a picture. Each box is its own card (its label is the back);
// siblings share the image and a group id, and each card keeps its own schedule. A box is stored as
// fractions of the image size ("x,y,w,h", 0–1), so it fits the picture at any size.
import { getDb, type DB } from './db';
import type { Item } from './types';

export type Box = { x: number; y: number; w: number; h: number };
/** one: only the asked box is hidden (the others show their labels); all: every box is hidden. */
export type OcclusionMode = 'one' | 'all';
/** One box of a group as an exercise draws it. */
export type OcclusionBox = { id: number; box: Box; label: string };

/** The smallest box side, as a fraction of the image. */
export const MIN_BOX = 0.01;
const round = (n: number) => Math.round(n * 10000) / 10000;
const within = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The box kept inside the image and never smaller than MIN_BOX. */
export function clampBox(b: Box): Box {
  const w = within(b.w, MIN_BOX, 1);
  const h = within(b.h, MIN_BOX, 1);
  return { x: round(within(b.x, 0, 1 - w)), y: round(within(b.y, 0, 1 - h)), w: round(w), h: round(h) };
}

/** "x,y,w,h" as a box, or null when it does not read as four numbers with a positive size. */
export function parseBox(s: string | undefined): Box | null {
  const n = (s ?? '').split(',').map((x) => (x.trim() ? Number(x) : NaN));
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[2] <= 0 || n[3] <= 0) return null;
  return clampBox({ x: n[0], y: n[1], w: n[2], h: n[3] });
}

export const formatBox = (b: Box) => {
  const c = clampBox(b);
  return [c.x, c.y, c.w, c.h].join(',');
};

export const modeOf = (s: string | undefined): OcclusionMode => (s?.trim().toLowerCase() === 'all' ? 'all' : 'one');

/** What an occlusion card shows: its group's boxes (its own from the card itself) and which one is asked. */
export function occlusionOf(item: Item): { mode: OcclusionMode; boxes: OcclusionBox[]; asked: number } | null {
  const own = item.kind === 'occlusion' && item.image ? parseBox(item.extra?.occlusion) : null;
  if (!own) return null;
  const self: OcclusionBox = { id: item.id, box: own, label: item.meaning };
  const group = item.occlusionBoxes ?? [];
  const boxes = group.some((b) => b.id === item.id) ? group.map((b) => (b.id === item.id ? self : b)) : [self];
  return { mode: modeOf(item.extra.occlusionMode), boxes, asked: boxes.findIndex((b) => b.id === item.id) };
}

/**
 * Give each occlusion card its group's boxes (suspended siblings too: their box is still on the picture).
 * One query for all the decks involved.
 */
export function withOcclusionBoxes<T extends Item>(items: T[], d: DB): T[] {
  const cards = items.filter((i) => i.kind === 'occlusion');
  if (!cards.length) return items;
  const decks = [...new Set(cards.map((i) => i.deckId))];
  const key = (deckId: number, group: string | undefined) => `${deckId}\u0000${group ?? ''}`;
  const groups = new Map<string, OcclusionBox[]>();
  const rows = d
    .prepare(
      `SELECT id, deck_id, meaning, extra FROM items WHERE kind = 'occlusion' AND deck_id IN (${decks.map(() => '?').join(',')}) ORDER BY ord`,
    )
    .all(...decks);
  for (const r of rows) {
    let extra: Record<string, string>;
    try {
      extra = JSON.parse(String(r.extra ?? '{}'));
    } catch {
      continue;
    }
    const box = parseBox(extra.occlusion);
    if (!box) continue;
    const k = key(Number(r.deck_id), extra.occlusionGroup);
    groups.set(k, [...(groups.get(k) ?? []), { id: Number(r.id), box, label: String(r.meaning) }]);
  }
  for (const i of cards) i.occlusionBoxes = groups.get(key(i.deckId, i.extra.occlusionGroup)) ?? [];
  return items;
}

/** Set the hide-one / hide-all mode of a card's whole group (only the mode: each card keeps its own box and label). */
export function setOcclusionMode(itemId: number, mode: string, d: DB = getDb()) {
  const r = d
    .prepare(
      `SELECT deck_id, json_extract(extra, '$.occlusionGroup') AS g FROM items WHERE id = ? AND kind = 'occlusion'`,
    )
    .get(itemId);
  if (!r || r.g == null) return;
  d.prepare(
    `UPDATE items SET extra = json_set(extra, '$.occlusionMode', ?) WHERE deck_id = ? AND kind = 'occlusion' AND json_extract(extra, '$.occlusionGroup') = ?`,
  ).run(modeOf(mode), r.deck_id, r.g);
}
