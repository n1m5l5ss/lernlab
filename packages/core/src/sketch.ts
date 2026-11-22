// The sketch pad (#220): when first meeting a card the learner may draw its meaning; the drawing is kept as
// their own picture cue and shown with the answer on later reviews (the drawing effect: drawing a word's
// meaning is remembered better than writing it [Wammes et al. 2016; Fernandes et al. 2018]).
// A sketch is the learner's, not the deck's: it lives in its own table, never in a deck export, and never
// changes a grade or the schedule. The picture arrives from the screen, so it is checked like any other file.
import { getDb, tx, type DB } from './db';
import { UserError } from './errors';
import { dayKey } from './game';
import { host } from './host';
import type { Item, Sketch } from './types';

export const SKETCH = {
  /** The pad's drawing area in pixels; the saved PNG has this size. */
  width: 480,
  height: 320,
  /** A line drawing of that size is a few tens of KB as a PNG; anything far bigger is not from the pad. */
  maxBytes: 512 * 1024,
  maxSide: 1024,
  /** Longest description ("what did you draw?"). */
  maxText: 200,
};

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = [0x49, 0x48, 0x44, 0x52];
const IEND = [0x49, 0x45, 0x4e, 0x44];
const has = (b: Uint8Array, at: number, sig: number[]) => sig.every((x, i) => b[at + i] === x);
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

/** Why these bytes can't be kept as a sketch (an error code), or null when they are a small enough PNG. */
export function sketchProblem(data: Uint8Array): 'unsupported_media' | 'sketch_too_big' | null {
  // Signature, then the header chunk (length 13, "IHDR", width, height …), and the end chunk last.
  if (data.length < 8 + 25 + 12 || !has(data, 0, PNG) || u32(data, 8) !== 13 || !has(data, 12, IHDR))
    return 'unsupported_media';
  if (!has(data, data.length - 8, IEND)) return 'unsupported_media';
  if (data.length > SKETCH.maxBytes) return 'sketch_too_big';
  const [w, h] = [u32(data, 16), u32(data, 20)];
  if (w < 1 || h < 1 || w > SKETCH.maxSide || h > SKETCH.maxSide) return 'sketch_too_big';
  return null;
}

/** The description as one line of plain text. Screens show it as text, never as HTML. */
export const cleanSketchText = (text: string | undefined): string =>
  (text ?? '').replace(/\s+/g, ' ').trim().slice(0, SKETCH.maxText);

const row = (r: { file?: unknown; text?: unknown } | undefined): Sketch | null =>
  r ? { file: String(r.file ?? ''), text: String(r.text ?? '') } : null;

export function sketchOf(itemId: number, d: DB = getDb()): Sketch | null {
  return row(d.prepare('SELECT file, text FROM sketches WHERE item_id = ?').get(itemId));
}

/** Add each card's sketch, if it has one. One small query: the table holds only cards the learner drew for. */
export function withSketches<T extends Item>(items: T[], d: DB = getDb()): T[] {
  if (!items.length) return items;
  const rows = d.prepare('SELECT item_id, file, text FROM sketches').all();
  if (!rows.length) return items;
  const byId = new Map(rows.map((r) => [Number(r.item_id), row(r)!]));
  for (const i of items) if (byId.has(i.id)) i.sketch = byId.get(i.id);
  return items;
}

/**
 * Keep a drawing (a PNG from the pad), a description, or both as the card's cue; it replaces an earlier one.
 * Nothing else changes: no answer is logged and no grade is set.
 */
export function saveSketch(
  itemId: number,
  data: Uint8Array | null,
  text: string | undefined,
  d: DB = getDb(),
  now = new Date(),
): Sketch {
  const clean = cleanSketchText(text);
  const picture = data && data.length ? data : null;
  if (!picture && !clean) throw new UserError('invalid_input', 'Nothing drawn or described');
  if (!d.prepare('SELECT 1 FROM items WHERE id = ?').get(itemId))
    throw new UserError('card_not_found', 'Card not found');
  const problem = picture && sketchProblem(picture);
  if (problem)
    throw new UserError(problem, problem === 'sketch_too_big' ? 'Sketch too big' : 'Not a PNG picture', {
      kb: Math.round(SKETCH.maxBytes / 1024),
    });
  const old = sketchOf(itemId, d);
  const file = picture ? `sketch-${host().randomId()}.png` : '';
  if (picture) host().media.write(file, picture);
  tx(d, () =>
    d
      .prepare(
        `INSERT INTO sketches (item_id, file, text, created_day) VALUES (?, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET file = excluded.file, text = excluded.text, created_day = excluded.created_day`,
      )
      .run(itemId, file, clean, dayKey(now)),
  );
  if (old?.file) host().media.remove?.(old.file);
  return { file, text: clean };
}

/** Take the learner's cue off a card and delete its picture. */
export function removeSketch(itemId: number, d: DB = getDb()): { ok: true } {
  const old = sketchOf(itemId, d);
  d.prepare('DELETE FROM sketches WHERE item_id = ?').run(itemId);
  if (old?.file) host().media.remove?.(old.file);
  return { ok: true };
}
