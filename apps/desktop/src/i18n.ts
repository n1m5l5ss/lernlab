// Interface translations. Every visible string lives in locales/<code>.json and is shown through t().
// Plurals use i18next's built-in rules (Intl.PluralRules): keys like "cards_one" / "cards_other".
// Numbers and dates go through Intl with the current language.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../../locales/en.json';
import { PSEUDO_RTL, directionOf } from './direction';
import { pseudoRtlString, pseudoize, withPluralForms } from './pseudo';

/** Languages offered in Settings. Add one here when its locales/<code>.json lands. */
export const LANGUAGES: { code: string; name: string }[] = [{ code: 'en', name: 'English' }];
/** Pseudo-locale for spotting text that bypasses the translation system. */
export const PSEUDO = 'en-XA';
export { PSEUDO_RTL };

export const resources = {
  en: { translation: en },
  [PSEUDO]: { translation: pseudoize(en) },
  [PSEUDO_RTL]: { translation: withPluralForms(pseudoize(en, pseudoRtlString), PSEUDO_RTL) },
};

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
  interpolation: { escapeValue: false }, // React escapes already.
  initAsync: false,
});

export const isSupported = (code: string) =>
  code === PSEUDO || code === PSEUDO_RTL || LANGUAGES.some((l) => l.code === code);

/** Switch the interface language (unknown codes fall back to English). */
export async function setLanguage(code: string | undefined | null) {
  const lng = code && isSupported(code) ? code : 'en';
  document.documentElement.lang = lng;
  document.documentElement.dir = directionOf(lng);
  if (i18next.language !== lng) await i18next.changeLanguage(lng);
}

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(i18next.language, opts).format(n);
export const formatPercent = (fraction: number) => formatNumber(fraction, { style: 'percent' });
export const formatDate = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(i18next.language, opts).format(new Date(d));
/** A language's name, e.g. "German" for "de" (in the app's language, or `inLanguage`, e.g. "Deutsch"). */
export function formatLanguage(code: string, inLanguage = i18next.language): string {
  try {
    return new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default i18next;
