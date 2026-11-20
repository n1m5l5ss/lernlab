// Choosing a system voice (Web Speech) for a card's language. Pure: the voice list is passed in, so it is testable.

/** The parts of a SpeechSynthesisVoice we use. */
export type VoiceLike = { name: string; lang: string; voiceURI: string; default?: boolean; localService?: boolean };

/** A deck's reading-aloud choices: a voice (its voiceURI) and a speed. Both optional. */
export type SpeechPref = { voice?: string; rate?: number };

export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;

/** Keep a speed in the range people can follow; anything odd becomes the normal speed. */
export function clampRate(rate: unknown): number {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, n));
}

/** The default region for a bare language code, so "de" asks for a German-from-Germany voice. */
const LOCALES: Record<string, string> = {
  de: 'de-DE',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-BR',
  nl: 'nl-NL',
  sv: 'sv-SE',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ar: 'ar-SA',
  hi: 'hi-IN',
  te: 'te-IN',
  en: 'en-US',
};

/** "de_de" and "DE-de" are the same tag; some systems use underscores. */
const norm = (tag: string) => tag.trim().replace(/_/g, '-').toLowerCase();
const primary = (tag: string) => norm(tag).split('-')[0];

/** The BCP-47 locale to ask the speech engine for. */
export function localeFor(lang: string): string {
  return LOCALES[norm(lang)] ?? lang;
}

/** Voices that speak this language: the exact locale first, then the same language in other regions. */
export function voicesFor(lang: string | null | undefined, voices: readonly VoiceLike[]): VoiceLike[] {
  if (!lang || !primary(lang)) return [];
  const want = norm(localeFor(lang));
  const exact = voices.filter((v) => norm(v.lang) === want);
  const sameLang = voices.filter((v) => norm(v.lang) !== want && primary(v.lang) === primary(lang));
  return [...exact, ...sameLang];
}

/** Voices that usually sound natural; they win when nobody chose a voice. */
const NICE = /Anna|Helena|Google|Premium|Enhanced|Natural|Neural/i;

/**
 * The voice to read a card in: the deck's chosen voice if it is installed and speaks the language,
 * else the best voice for the exact locale, else any voice for the language, else none.
 */
export function pickVoice(
  lang: string | null | undefined,
  voices: readonly VoiceLike[],
  preferred?: string | null,
): VoiceLike | null {
  const matching = voicesFor(lang, voices);
  if (!matching.length) return null;
  if (preferred) {
    const chosen = matching.find((v) => v.voiceURI === preferred) ?? matching.find((v) => v.name === preferred);
    if (chosen) return chosen;
  }
  const want = norm(localeFor(lang!));
  const exact = matching.filter((v) => norm(v.lang) === want);
  return exact.find((v) => NICE.test(v.name)) ?? exact[0] ?? matching.find((v) => NICE.test(v.name)) ?? matching[0];
}

/**
 * The reading-aloud choices for a card: its own deck's, else (a line not tied to one card, in a session
 * over several decks) the first deck's that chose anything.
 */
export function prefFor(prefs: Record<number, SpeechPref>, deckId?: number | null): SpeechPref {
  if (deckId != null && prefs[deckId]) return prefs[deckId];
  const all = Object.values(prefs).filter((p) => p.voice || p.rate);
  return all[0] ?? {};
}
