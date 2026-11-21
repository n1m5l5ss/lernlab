// Image occlusion editor logic (#44): boxes as fractions of the image, moved by pointer or keyboard,
// and the cards they save (one per box, sharing a group).
import { clampBox, formatBox, parseBox, type Box } from '@lernlab/core/occlusion';
import type { Item } from '@lernlab/core/types';

/** A box being edited. `id` is its saved card, when it has one. */
export type Shape = { id?: number; box: Box; label: string };
export type Point = { x: number; y: number };

/** How far one arrow key press moves or resizes a box (a fraction of the image). */
export const STEP = 0.01;
/** A box drawn smaller than this (a click, not a drag) is not kept. */
export const MIN_DRAWN = 0.02;
/** The box "Add box" puts in the middle of the image. */
export const NEW_BOX: Box = { x: 0.4, y: 0.45, w: 0.2, h: 0.1 };

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** An arrow key moves the box; with Shift it resizes it. Null for any other key. */
export function nudge(b: Box, key: string, resize: boolean): Box | null {
  const d = KEYS[key];
  if (!d) return null;
  const [dx, dy] = d.map((v) => v * STEP);
  return clampBox(resize ? { ...b, w: b.w + dx, h: b.h + dy } : { ...b, x: b.x + dx, y: b.y + dy });
}

/** The box between two points (drawn in any direction). */
export const spanBox = (a: Point, b: Point): Box =>
  clampBox({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** A box dragged from one point to another: moved whole, or resized from its bottom-right corner. */
export function dragBox(b: Box, from: Point, to: Point, how: 'move' | 'resize'): Box {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return clampBox(how === 'move' ? { ...b, x: b.x + dx, y: b.y + dy } : { ...b, w: b.w + dx, h: b.h + dy });
}

/** The boxes an editor starts with: a saved card's whole group (its own box from the card), or none. */
export function shapesFor(item: Item | undefined): Shape[] {
  if (!item || item.kind !== 'occlusion') return [];
  const own = parseBox(item.extra.occlusion);
  const group = item.occlusionBoxes?.length ? item.occlusionBoxes : own ? [{ id: item.id, box: own, label: '' }] : [];
  return group.map((b) => (b.id === item.id ? { id: b.id, box: own ?? b.box, label: item.meaning } : { ...b }));
}

/** Ready to save: an image, at least one box, and a label on every box. */
export const shapesReady = (image: string, shapes: Shape[]) =>
  !!image && shapes.length > 0 && shapes.every((s) => s.label.trim());

/**
 * The cards to save. A new picture saves one card per box, all in one new group; a saved card saves only
 * itself (its siblings keep their own boxes, labels and schedules).
 */
export function occlusionCards<F extends object>(
  fields: F,
  shapes: Shape[],
  ownId: number | undefined,
  group: string,
): (F & { back: string; occlusion: string; occlusionGroup?: string })[] {
  const card = (s: Shape) => ({ ...fields, back: s.label.trim(), occlusion: formatBox(s.box) });
  if (ownId !== undefined) {
    const own = shapes.find((s) => s.id === ownId);
    return own ? [card(own)] : [];
  }
  return shapes.map((s) => ({ ...card(s), occlusionGroup: group }));
}

/** A new group id: unique enough within a deck, and never shown. */
export const newGroupId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
