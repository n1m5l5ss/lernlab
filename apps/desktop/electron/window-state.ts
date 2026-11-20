// Remembers the window's size and position between starts, and never reopens it off-screen
// (for example after a monitor was unplugged).
export type Rect = { x: number; y: number; width: number; height: number };
export type WindowState = { bounds: Rect; maximized: boolean };
export type Restored = { x?: number; y?: number; width: number; height: number; maximized: boolean };

export const DEFAULT_SIZE = { width: 1200, height: 860 };
export const MIN_SIZE = { width: 720, height: 560 };
/** How much of the window's top edge must be on a screen so it can still be grabbed and moved. */
const GRAB = { width: 120, height: 40 };

const isRect = (r: unknown): r is Rect =>
  !!r &&
  typeof r === 'object' &&
  ['x', 'y', 'width', 'height'].every((k) => Number.isFinite((r as Record<string, unknown>)[k]));

const overlap = (a: Rect, b: Rect) => ({
  width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
});

/** Where to open the window, given what was saved last time and the screens' work areas now. */
export function restoreWindow(saved: unknown, screens: Rect[]): Restored {
  const s = saved as Partial<WindowState> | undefined;
  const maximized = s?.maximized === true;
  if (!isRect(s?.bounds) || !screens.length) return { ...DEFAULT_SIZE, maximized };
  const largest = screens.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  const width = Math.round(Math.min(Math.max(s.bounds.width, MIN_SIZE.width), Math.max(largest.width, MIN_SIZE.width)));
  const height = Math.round(
    Math.min(Math.max(s.bounds.height, MIN_SIZE.height), Math.max(largest.height, MIN_SIZE.height)),
  );
  const top: Rect = { x: s.bounds.x, y: s.bounds.y, width, height: GRAB.height };
  const visible = screens.some((screen) => {
    const o = overlap(top, screen);
    return o.width >= GRAB.width && o.height >= GRAB.height;
  });
  // Off every screen: keep the size, let the system centre it.
  return visible
    ? { x: Math.round(s.bounds.x), y: Math.round(s.bounds.y), width, height, maximized }
    : { width, height, maximized };
}
