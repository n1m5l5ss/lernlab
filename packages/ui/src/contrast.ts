// WCAG 2.2 contrast between two colours, as `#RRGGBB` or `rgba(r,g,b,a)` (a translucent colour is laid over its background).

type Rgb = [number, number, number];

function parse(colour: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = hex[1];
    return { rgb: [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as Rgb, alpha: 1 };
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(colour);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], alpha: rgba[4] === undefined ? 1 : +rgba[4] };
  throw new Error(`Not a colour: ${colour}`);
}

const hexOf = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** The opaque colour seen when `colour` is drawn on the opaque `background`. */
export function over(colour: string, background: string): string {
  return tint(colour, 1, background);
}

/** `colour` at `alpha` (times its own alpha) over the opaque `background`, like `color-mix(in srgb, colour N%, background)`. */
export function tint(colour: string, alpha: number, background: string): string {
  const top = parse(colour);
  const a = top.alpha * alpha;
  const base = parse(background).rgb;
  return hexOf(top.rgb.map((c, i) => Math.round(c * a + base[i] * (1 - a))));
}

/** Relative luminance (WCAG 2.2, 1.4.3). */
export function luminance(colour: string): number {
  const [r, g, b] = parse(colour).rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio from 1 to 21. A translucent foreground is laid over the background first. */
export function contrast(foreground: string, background: string): number {
  const fg = parse(foreground).alpha < 1 ? over(foreground, background) : foreground;
  const a = luminance(fg);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
