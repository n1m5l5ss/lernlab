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

/** Right-to-left override and its end, plus right-to-left marks, as used by Android's pseudo-bidi locale. */
const RLM = '\u200F';
const RLO = '\u202E';
const PDF = '\u202C';

/** Pseudo-RTL: each word shown mirrored inside a right-to-left override, placeholders and tags untouched. */
export function pseudoRtlString(s: string): string {
  return (
    s
      .split(/(\{\{[^}]*\}\}|<[^>]*>)/)
      // Numbers stay as they are (they run left to right in Arabic and Hebrew too).
      .map((part, i) =>
        i % 2 ? part : part.replace(/\S+/g, (w) => (/\p{L}/u.test(w) ? `${RLM}${RLO}${w}${PDF}${RLM}` : w)),
      )
      .join('')
  );
}

type Tree = { [k: string]: string | string[] | Tree };

/** Pseudo-translate a whole resource tree (same keys and arrays, values run through `fn`). */
export function pseudoize<T extends Tree>(tree: T, fn: (s: string) => string = pseudoString): T {
  const out: Tree = {};
  for (const [k, v] of Object.entries(tree))
    out[k] = typeof v === 'string' ? fn(v) : Array.isArray(v) ? v.map(fn) : pseudoize(v, fn);
  return out as T;
}

/**
 * Add the plural forms `lng` needs (Arabic: zero, one, two, few, many, other) by copying each `_other`
 * text, so a pseudo-locale never falls back to English for "3 cards".
 */
export function withPluralForms<T extends Tree>(tree: T, lng: string): T {
  const forms = new Intl.PluralRules(lng).resolvedOptions().pluralCategories;
  const out: Tree = {};
  for (const [k, v] of Object.entries(tree))
    out[k] = typeof v === 'object' && !Array.isArray(v) ? withPluralForms(v, lng) : v;
  for (const [k, v] of Object.entries(tree)) {
    if (!k.endsWith('_other')) continue;
    const base = k.slice(0, -'_other'.length);
    for (const form of forms) out[`${base}_${form}`] ??= v;
  }
  return out as T;
}
