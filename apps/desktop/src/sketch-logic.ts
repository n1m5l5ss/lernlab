// The sketch pad's rules (#220), kept apart from the canvas so they can be tested: where a pointer lands,
// how strokes grow, undo, and drawing the strokes onto any 2D context.

export type Point = [x: number, y: number];
export type Stroke = Point[];

/** A drawing stops taking points here: plenty for a sketch, and it bounds memory and redraw time. */
export const MAX_POINTS = 20_000;
/** Line thickness in drawing pixels. */
export const INK_WIDTH = 3;

type Box = { left: number; top: number; width: number; height: number };

/** A pointer position (client pixels) as a point in the drawing, held inside it. */
export function padPoint(clientX: number, clientY: number, box: Box, width: number, height: number): Point {
  if (box.width <= 0 || box.height <= 0) return [0, 0];
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  return [
    clamp(((clientX - box.left) / box.width) * width, width),
    clamp(((clientY - box.top) / box.height) * height, height),
  ];
}

const count = (strokes: Stroke[]) => strokes.reduce((n, s) => n + s.length, 0);

export function startStroke(strokes: Stroke[], p: Point): Stroke[] {
  return count(strokes) >= MAX_POINTS ? strokes : [...strokes, [p]];
}

/** Add a point to the stroke being drawn. */
export function addPoint(strokes: Stroke[], p: Point): Stroke[] {
  const last = strokes[strokes.length - 1];
  if (!last || count(strokes) >= MAX_POINTS) return strokes;
  const end = last[last.length - 1];
  if (end[0] === p[0] && end[1] === p[1]) return strokes;
  return [...strokes.slice(0, -1), [...last, p]];
}

export const undoStroke = (strokes: Stroke[]): Stroke[] => strokes.slice(0, -1);

/** Something to keep: at least one stroke, or a description in words. */
export const canSaveSketch = (strokes: Stroke[], text: string) => strokes.length > 0 || text.trim().length > 0;

/** The part of a canvas 2D context the pad uses. */
export type Pen = {
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  strokeStyle: unknown;
  fillStyle: unknown;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
};

/**
 * Draw every stroke. With `paper` the background is filled first (the saved picture, readable in light and
 * dark); without it the area is cleared and the page shows through (the pad on screen).
 */
export function drawStrokes(
  ctx: Pen,
  strokes: Stroke[],
  o: { width: number; height: number; ink: string; paper?: string },
) {
  if (o.paper) {
    ctx.fillStyle = o.paper;
    ctx.fillRect(0, 0, o.width, o.height);
  } else ctx.clearRect(0, 0, o.width, o.height);
  ctx.lineWidth = INK_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = o.ink;
  for (const s of strokes) {
    ctx.beginPath();
    ctx.moveTo(s[0][0], s[0][1]);
    for (const p of s.length > 1 ? s.slice(1) : s) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  }
}
