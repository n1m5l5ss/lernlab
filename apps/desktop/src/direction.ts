// Text direction per interface language. Arabic, Hebrew, Persian, Urdu and friends lay the screen out
// right to left: <html dir="rtl"> flips every logical CSS property (margin-inline-start, inset-inline…).

/** Pseudo-locale that turns the layout right to left with readable (mirrored) English, for testing. */
export const PSEUDO_RTL = 'ar-XB';

/** Languages written right to left (primary subtags). */
const RTL = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ks', 'ku', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi']);

export function directionOf(code: string | undefined | null): 'ltr' | 'rtl' {
  const lang = (code ?? '').toLowerCase().split(/[-_]/)[0];
  return RTL.has(lang) ? 'rtl' : 'ltr';
}
