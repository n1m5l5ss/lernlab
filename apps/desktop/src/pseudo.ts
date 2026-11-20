// Pseudo-locale: every English string accented, padded and bracketed, so text that skipped
// the translation system stands out as plain English on screen.
const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FANCY = [...'áƀçďéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÁƁÇĎÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ'];
const ACCENTS: Record<string, string> = Object.fromEntries([...PLAIN].map((ch, i) => [ch, FANCY[i]]));

/** Accent one string, leaving {{placeholders}} and <tags> untouched. */
export function pseudoString(s: string): string {
  const out = s
    .split(/(\{\{[^}]*\}\}|<[^>]*>)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[A-Za-z]/g, (ch) => ACCENTS[ch] ?? ch)))
    .join('');
  // Translations run about 30% longer than English; pad so cramped layouts show up too.
  const pad = '~'.repeat(Math.ceil(s.length * 0.3));
  return `[!! ${out}${pad} !!]`;
}

type Tree = { [k: string]: string | string[] | Tree };

/** Pseudo-translate a whole resource tree (same keys and arrays, accented values). */
export function pseudoize<T extends Tree>(tree: T): T {
  const out: Tree = {};
  for (const [k, v] of Object.entries(tree))
    out[k] = typeof v === 'string' ? pseudoString(v) : Array.isArray(v) ? v.map(pseudoString) : pseudoize(v);
  return out as T;
}
