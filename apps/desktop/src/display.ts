// Applies the text size and reduced-motion settings as data attributes on the root element.
// styles.css (Settings block) maps them to a scale and to zero-length animations.
export const TEXT_SIZES = ['normal', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

type Root = { dataset: DOMStringMap };
const doc = (): Root => document.documentElement;

export function applyDisplay(s: { textSize: unknown; reducedMotion: unknown }, root: Root = doc()) {
  if (s.textSize !== 'normal' && TEXT_SIZES.includes(s.textSize as TextSize))
    root.dataset.textSize = String(s.textSize);
  else delete root.dataset.textSize;
  if (s.reducedMotion === true) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
}

/** True when the setting or the computer asks for less motion (for effects CSS can't reach, like confetti). */
export function motionReduced(
  root: Root = doc(),
  system = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  return root.dataset.motion === 'reduce' || system;
}
