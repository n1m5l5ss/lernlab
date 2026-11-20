// Interface translations. Every visible string lives in locales/<code>.json and is shown through t().
// Plurals use i18next's built-in rules (Intl.PluralRules): keys like "cards_one" / "cards_other".
// Numbers and dates go through Intl with the current language.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../../locales/en.json';
import { pseudoize } from './pseudo';

/** Languages offered in Settings. Add one here when its locales/<code>.json lands. */
export const LANGUAGES: { code: string; name: string }[] = [{ code: 'en', name: 'English' }];
/** Pseudo-locale for spotting text that bypasses the translation system. */
export const PSEUDO = 'en-XA';

export const resources = {
  en: { translation: en },
  [PSEUDO]: { translation: pseudoize(en) },
};

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
  interpolation: { escapeValue: false }, // React escapes already.
  initAsync: false,
});

export const isSupported = (code: string) => code === PSEUDO || LANGUAGES.some((l) => l.code === code);

/** Switch the interface language (unknown codes fall back to English). */
export async function setLanguage(code: string | undefined | null) {
  const lng = code && isSupported(code) ? code : 'en';
  document.documentElement.lang = lng;
  if (i18next.language !== lng) await i18next.changeLanguage(lng);
}

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(i18next.language, opts).format(n);
export const formatPercent = (fraction: number) => formatNumber(fraction, { style: 'percent' });
export const formatDate = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(i18next.language, opts).format(new Date(d));

export default i18next;
