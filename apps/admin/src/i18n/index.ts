import { de } from './de';

export type Locale = 'en' | 'de';
export const LOCALE_COOKIE = 'botworks_lang';
export const LOCALES: Locale[] = ['en', 'de'];

const dictionaries: Record<Locale, Record<string, string>> = { en: {}, de };

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === 'de' ? 'de' : 'en';
}

/**
 * gettext-style lookup: the English source string is the key. Anything
 * missing from a dictionary falls back to English, so a new string never
 * breaks the UI.
 */
export function translate(locale: Locale, text: string): string {
  if (locale === 'en') return text;
  return dictionaries[locale][text] ?? text;
}

export type TFunction = (text: string) => string;
